import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import LiveQuizManager from '../utils/liveQuizManager';

const LiveSessionManagement = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [liveQuizManager] = useState(() => new LiveQuizManager());
  
  // Editing state
  const [editingQuestion, setEditingQuestion] = useState('');
  const [editingOptions, setEditingOptions] = useState(['', '', '', '']);
  const [editingCorrectAnswerIndex, setEditingCorrectAnswerIndex] = useState(0);

  // Auth check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        navigate('/admin-login');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // Fetch initial data and set up listeners
  useEffect(() => {
    if (!user || !sessionId) return;

    const setupSession = async () => {
      try {
        // Set up real-time session listener
        liveQuizManager.listenToSession(sessionId, (sessionData) => {
          console.log('Session updated:', sessionData);
          setSession(sessionData);
          
          if (sessionData && sessionData.quizId && !quiz) {
            fetchQuizData(sessionData.quizId);
          }
        });

        // Set up real-time participants listener
        liveQuizManager.listenToParticipants(sessionId, (participantsData) => {
          console.log('Participants updated:', participantsData);
          setParticipants(participantsData);
        });

        setLoading(false);
      } catch (error) {
        console.error('Error setting up session:', error);
        setError('Failed to load session');
        setLoading(false);
      }
    };

    setupSession();

    // Cleanup listeners on unmount
    return () => {
      liveQuizManager.cleanup(sessionId);
    };
  }, [user, sessionId]);

  // Timer effect for admin
  useEffect(() => {
    if (!session || (session.status !== 'active' && session.status !== 'editing') || !session.questionStartTime) {
      setTimeRemaining(0);
      return;
    }

    const updateTimer = () => {
      const now = new Date().getTime();
      const questionStart = session.questionStartTime.toDate?.()?.getTime() || session.questionStartTime;
      const elapsed = Math.floor((now - questionStart) / 1000);
      const remaining = Math.max(0, session.questionTimeLimit - elapsed);
      setTimeRemaining(remaining);
    };

    updateTimer(); // Initial update
    const timer = setInterval(updateTimer, 1000);

    return () => clearInterval(timer);
  }, [session]);

  const fetchQuizData = async (quizId) => {
    try {
      const quizDoc = await getDoc(doc(db, 'quizzes', quizId));
      if (quizDoc.exists()) {
        setQuiz({ id: quizDoc.id, ...quizDoc.data() });
      }
    } catch (error) {
      console.error('Error fetching quiz:', error);
    }
  };

  const handleStartQuiz = async () => {
    try {
      const result = await liveQuizManager.startQuiz(sessionId);
      if (!result.success) {
        alert(`Failed to start quiz: ${result.error}`);
      }
    } catch (error) {
      console.error('Error starting quiz:', error);
      alert('Failed to start quiz');
    }
  };

  const handleNextQuestion = async () => {
    try {
      const result = await liveQuizManager.nextQuestion(sessionId, session.currentQuestionIndex);
      if (!result.success) {
        alert(`Failed to move to next question: ${result.error}`);
      }
    } catch (error) {
      console.error('Error moving to next question:', error);
      alert('Failed to move to next question');
    }
  };

  const handleEditQuestion = async () => {
    try {
      // Initialize editing state with current question data
      const currentQuestion = quiz?.questions?.[session.currentQuestionIndex];
      
      if (currentQuestion) {
        const questionText = currentQuestion.question || '';
        const originalOptions = currentQuestion.options || currentQuestion.choices || [];
        
        // Ensure we always have 4 options for editing
        const options = [...originalOptions];
        while (options.length < 4) {
          options.push('');
        }
        options.length = 4; // Trim to exactly 4 options
        
        setEditingQuestion(questionText);
        setEditingOptions([...options]); // Create new array to ensure state update
        
        // Find the index of the correct answer
        const correctAnswerIndex = typeof currentQuestion.answer === 'number' 
          ? currentQuestion.answer 
          : originalOptions.findIndex(opt => opt === currentQuestion.answer);
        const finalIndex = Math.max(0, correctAnswerIndex);
        
        setEditingCorrectAnswerIndex(finalIndex);
      }
      
      // Add a small delay to ensure state updates are processed
      setTimeout(async () => {
        const result = await liveQuizManager.startQuestionEdit(sessionId, session.currentQuestionIndex);
        if (!result.success) {
          alert(`Failed to start editing: ${result.error}`);
        }
      }, 100);
      
    } catch (error) {
      console.error('Error starting question edit:', error);
      alert('Failed to start editing');
    }
  };

  const handleSaveEditedQuestion = async (exitEditMode = false) => {
    try {
      // Validate edited data
      if (!editingQuestion.trim()) {
        alert('Question text cannot be empty');
        return false;
      }
      
      const validOptions = editingOptions.filter(opt => opt.trim() !== '');
      if (validOptions.length < 2) {
        alert('At least 2 options are required');
        return false;
      }
      
      if (editingCorrectAnswerIndex < 0 || editingCorrectAnswerIndex >= validOptions.length) {
        alert('Please select a valid correct answer from the options');
        return false;
      }
      
      // Update the quiz data in Firebase
      const updatedQuestion = {
        ...quiz.questions[session.currentQuestionIndex],
        question: editingQuestion.trim(),
        options: validOptions,
        answer: validOptions[editingCorrectAnswerIndex] // Save the actual text of the correct option
      };
      
      // Update local quiz state
      const updatedQuestions = [...quiz.questions];
      updatedQuestions[session.currentQuestionIndex] = updatedQuestion;
      setQuiz({ ...quiz, questions: updatedQuestions });
      
      // Save to Firebase (update the quiz document)
      await updateDoc(doc(db, 'quizzes', quiz.id), {
        questions: updatedQuestions
      });
      
      // If requested, exit editing mode
      if (exitEditMode) {
        try {
          const result = await liveQuizManager.finishQuestionEdit(sessionId, session.currentQuestionIndex);
          if (!result.success) {
            alert(`Failed to finish editing: ${result.error}`);
            return false;
          }
        } catch (error) {
          console.error('Error finishing edit:', error);
          alert('Failed to finish editing');
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error saving edited question:', error);
      alert('Failed to save changes');
      return false;
    }
  };

  const handleEndSession = async () => {
    if (window.confirm('Are you sure you want to end this live session?')) {
      try {
        const result = await liveQuizManager.endSession(sessionId);
        if (result.success) {
          alert('Session ended successfully');
          navigate('/admin-dashboard');
        } else {
          alert(`Failed to end session: ${result.error}`);
        }
      } catch (error) {
        console.error('Error ending session:', error);
        alert('Failed to end session');
      }
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div style={styles.outer}>
        <div style={styles.container}>
          <div style={styles.loading}>Loading live session...</div>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div style={styles.outer}>
        <div style={styles.container}>
          <div style={styles.error}>{error || 'Session not found'}</div>
          <button style={styles.backBtn} onClick={() => navigate('/admin-dashboard')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = quiz?.questions?.[session.currentQuestionIndex];
  const isQuizStarted = session.status === 'active' || session.status === 'editing';
  const isQuizCompleted = session.status === 'completed';
  const isEditing = session.status === 'editing' || session.isEditing;
  const canMoveNext = currentQuestion && session.currentQuestionIndex < (quiz?.questions?.length || 0) - 1;

  return (
    <div style={styles.outer}>
      <div style={styles.container}>
        {/* Header */}
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            <h1 style={styles.title}>Live Quiz Session</h1>
            <div style={styles.sessionInfo}>
              <span style={styles.quizName}>Quiz: {quiz?.name || 'Loading...'}</span>
              <span style={styles.sessionCode}>Code: {session.sessionCode}</span>
              <span style={{
                ...styles.status,
                ...(isEditing ? styles.statusEditing : {})
              }}>
                Status: {isEditing ? 'EDITING' : session.status}
              </span>
              {isQuizStarted && timeRemaining > 0 && !isEditing && (
                <span style={{
                  ...styles.timer,
                  ...(timeRemaining <= 5 ? styles.timerCritical : {})
                }}>
                  Time: {formatTime(timeRemaining)}
                </span>
              )}
            </div>
          </div>
          <button style={styles.backBtn} onClick={() => navigate('/admin-dashboard')}>
            Back to Dashboard
          </button>
        </header>

        <div style={styles.content}>
          {/* Quiz Controls Panel */}
          {!isQuizStarted && !isQuizCompleted && (
            <section style={styles.section}>
              <h3 style={styles.sectionTitle}>Quiz Controls</h3>
              <div style={styles.startQuizContainer}>
                <p style={styles.startQuizText}>
                  Ready to start the quiz? {participants.length} participant(s) have joined.
                </p>
                <button style={styles.startBtn} onClick={handleStartQuiz}>
                  🚀 Start Quiz
                </button>
              </div>
            </section>
          )}

          {/* Panel 1: Current Question & Controls */}
          {isQuizStarted && currentQuestion && (
            <section style={styles.section}>
              <div style={styles.questionHeader}>
                <h3 style={styles.sectionTitle}>
                  Question {session.currentQuestionIndex + 1} of {quiz?.questions?.length || 0}
                  {isEditing && <span style={styles.editingBadge}>🔒 EDITING MODE</span>}
                </h3>
                
                {/* Timer Display - Hidden during editing */}
                {!isEditing && (
                  <div style={styles.timerSection}>
                    <div style={styles.timerLabel}>Time Remaining:</div>
                    <div style={{
                      ...styles.bigTimer,
                      ...(timeRemaining <= 5 ? styles.bigTimerCritical : {})
                    }}>
                      {formatTime(timeRemaining)}
                    </div>
                    <div style={styles.timerProgress}>
                      <div 
                        style={{
                          ...styles.timerProgressBar,
                          width: `${(timeRemaining / session.questionTimeLimit) * 100}%`,
                          backgroundColor: timeRemaining <= 5 ? '#f44336' : '#4caf50'
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Question Content */}
              <div style={styles.questionDisplay}>
                {isEditing ? (
                  // Editing Mode - Editable Interface
                  <div style={styles.editingInterface}>
                    
                    <div style={styles.editField}>
                      <label style={styles.editLabel}>Question:</label>
                      <textarea
                        style={styles.editTextarea}
                        value={editingQuestion}
                        onChange={(e) => setEditingQuestion(e.target.value)}
                        placeholder="Enter question text..."
                        rows={3}
                      />
                    </div>
                    
                    <div style={styles.editField}>
                      <label style={styles.editLabel}>Options:</label>
                      <div style={styles.editOptionsGrid}>
                        {editingOptions.map((option, index) => (
                          <div key={index} style={styles.editOptionRow}>
                            <span style={styles.optionLetter}>{String.fromCharCode(65 + index)}</span>
                            <input
                              style={styles.editOptionInput}
                              type="text"
                              value={option}
                              onChange={(e) => {
                                const newOptions = [...editingOptions];
                                newOptions[index] = e.target.value;
                                setEditingOptions(newOptions);
                              }}
                              placeholder={`Option ${String.fromCharCode(65 + index)}`}
                            />
                            <input
                              type="radio"
                              name="correctAnswer"
                              checked={editingCorrectAnswerIndex === index}
                              onChange={() => setEditingCorrectAnswerIndex(index)}
                              style={styles.correctRadio}
                            />
                            <span style={styles.correctLabel}>Correct</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div style={styles.editActions}>
                      <button style={styles.saveBtn} onClick={() => handleSaveEditedQuestion(true)}>
                        💾 Save & Exit
                      </button>
                      <button style={styles.cancelBtn} onClick={() => {
                        if (window.confirm('Cancel editing? Changes will be lost.')) {
                          liveQuizManager.finishQuestionEdit(sessionId, session.currentQuestionIndex);
                        }
                      }}>
                        ❌ Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  // View Mode - Regular Display
                  <div>
                    <div style={styles.questionText}>
                      {currentQuestion.question}
                    </div>
                    {(currentQuestion.options || currentQuestion.choices) && (
                      <div style={styles.optionsGrid}>
                        {(currentQuestion.options || currentQuestion.choices || []).map((option, index) => (
                          <div key={index} style={{
                            ...styles.optionCard,
                            ...(option === currentQuestion.answer ? styles.correctOption : {})
                          }}>
                            <span style={styles.optionLetter}>{String.fromCharCode(65 + index)}</span>
                            <span>{option}</span>
                            {option === currentQuestion.answer && <span style={styles.correctBadge}>✓</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Question Controls - Hidden during editing */}
              {!isEditing && (
                <div style={styles.questionControls}>
                  {isQuizStarted && !isQuizCompleted && (
                    <>
                      <button style={styles.editBtn} onClick={handleEditQuestion}>
                        ✏️ Edit Question
                      </button>
                      
                      {canMoveNext && (
                        <button style={styles.nextBtn} onClick={handleNextQuestion}>
                          ⏭️ Next Question
                        </button>
                      )}
                      
                      {!canMoveNext && session.currentQuestionIndex >= 0 && (
                        <button style={styles.endBtn} onClick={handleEndSession}>
                          🏁 End Quiz
                        </button>
                      )}
                    </>
                  )}
                  
                  <button style={styles.forceEndBtn} onClick={handleEndSession}>
                    ⛔ Force End Session
                  </button>
                </div>
              )}
            </section>
          )}

          {/* Panel 2: Participants List */}
          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>Participants ({participants.length})</h3>
            <div style={styles.participantsList}>
              {participants.length === 0 ? (
                <div style={styles.noParticipants}>No participants joined yet</div>
              ) : (
                participants.map(participant => (
                  <div key={participant.id} style={styles.participantCard}>
                    <div style={styles.participantInfo}>
                      <span style={styles.participantName}>{participant.userName}</span>
                      <span style={styles.participantScore}>
                        Score: {participant.currentScore || 0}/{
                          isQuizCompleted 
                            ? quiz?.questions?.length || 0 
                            : (session.currentQuestionIndex >= 0 ? session.currentQuestionIndex + 1 : 0)
                        }
                      </span>
                    </div>
                    <div style={styles.participantStatus}>
                      {participant.status === 'active' ? '🟢 Active' : '🔴 Disconnected'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

const styles = {
  outer: {
    minHeight: '100vh',
    minWidth: '100vw',
    width: '100vw',
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f5f6fa',
    boxSizing: 'border-box',
    margin: 0,
    padding: '1rem',
  },
  container: {
    width: '100%',
    maxWidth: '1200px',
    fontFamily: 'Inter, Arial, sans-serif',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: '100%',
  },
  header: {
    backgroundColor: '#fff',
    padding: '1.5rem 2rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    maxWidth: '1000px',
    borderRadius: '12px',
    marginBottom: '1.5rem',
    boxSizing: 'border-box',
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  title: {
    margin: 0,
    fontSize: 'clamp(20px, 4vw, 28px)',
    fontWeight: 700,
    color: '#3f51b5',
  },
  sessionInfo: {
    display: 'flex',
    gap: '1rem',
    fontSize: 14,
    color: '#666',
    flexWrap: 'wrap',
  },
  quizName: {
    backgroundColor: '#e3f2fd',
    padding: '0.25rem 0.5rem',
    borderRadius: 4,
    fontWeight: 600,
    color: '#1976d2',
  },
  sessionCode: {
    backgroundColor: '#e3f2fd',
    padding: '0.25rem 0.5rem',
    borderRadius: 4,
    fontWeight: 600,
    color: '#1976d2',
  },
  status: {
    textTransform: 'capitalize',
  },
  statusEditing: {
    color: '#f44336',
    fontWeight: 600,
  },
  timer: {
    backgroundColor: '#fff3e0',
    padding: '0.25rem 0.5rem',
    borderRadius: 4,
    fontWeight: 600,
    color: '#f57c00',
  },
  timerCritical: {
    backgroundColor: '#ffebee',
    color: '#f44336',
  },
  backBtn: {
    backgroundColor: '#fff',
    color: '#3f51b5',
    border: '1px solid #3f51b5',
    borderRadius: 6,
    padding: '0.5rem 1rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: 'clamp(12px, 2vw, 14px)',
  },
  content: {
    width: '100%',
    maxWidth: '1000px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 'clamp(1rem, 3vw, 1.5rem)',
    boxShadow: '0 2px 12px rgba(63,81,181,0.08)',
    width: '100%',
    boxSizing: 'border-box',
    minHeight: '120px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
  },
  sectionTitle: {
    margin: 0,
    marginBottom: '1rem',
    fontSize: 'clamp(16px, 3vw, 18px)',
    fontWeight: 600,
    color: '#222',
  },
  questionControls: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: '1.5rem',
    paddingTop: '1rem',
    borderTop: '1px solid #eee',
  },
  startBtn: {
    backgroundColor: '#4caf50',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '0.75rem 1.5rem',
    fontWeight: 600,
    fontSize: 'clamp(14px, 2.5vw, 16px)',
    cursor: 'pointer',
  },
  editBtn: {
    backgroundColor: '#2196f3',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '0.75rem 1.5rem',
    fontWeight: 600,
    fontSize: 'clamp(14px, 2.5vw, 16px)',
    cursor: 'pointer',
  },
  nextBtn: {
    backgroundColor: '#3f51b5',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '0.75rem 1.5rem',
    fontWeight: 600,
    fontSize: 'clamp(14px, 2.5vw, 16px)',
    cursor: 'pointer',
  },
  endBtn: {
    backgroundColor: '#f44336',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '0.75rem 1.5rem',
    fontWeight: 600,
    fontSize: 'clamp(14px, 2.5vw, 16px)',
    cursor: 'pointer',
  },
  forceEndBtn: {
    backgroundColor: '#f44336',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '0.75rem 1.5rem',
    fontWeight: 600,
    fontSize: 'clamp(14px, 2.5vw, 16px)',
    cursor: 'pointer',
    width: '100%',
    marginTop: '1rem',
  },
  questionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  editingBadge: {
    backgroundColor: '#ff9800',
    color: '#fff',
    padding: '0.25rem 0.75rem',
    borderRadius: 4,
    fontSize: 'clamp(12px, 2vw, 14px)',
    fontWeight: 600,
    textTransform: 'uppercase',
  },
  questionDisplay: {
    border: '1px solid #e9ecef',
    borderRadius: 8,
    padding: '1.5rem',
    backgroundColor: '#fff', // Use white background instead of light gray
  },
  questionText: {
    fontSize: 'clamp(14px, 2.5vw, 16px)',
    fontWeight: 600,
    marginBottom: '0.75rem',
    color: '#222', // Ensure question text is black
    lineHeight: 1.4,
  },
  optionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)', // Force exactly 2 columns
    gap: '0.75rem',
    marginTop: '0.75rem',
  },
  optionCard: {
    padding: '0.75rem',
    border: '1px solid #e9ecef',
    borderRadius: 6,
    backgroundColor: '#f8f9fa',
    fontSize: 'clamp(14px, 2.5vw, 16px)',
    color: '#222', // Ensure text is black
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  optionLetter: {
    fontSize: 'clamp(12px, 2vw, 14px)',
    fontWeight: 600,
    color: '#3f51b5',
  },
  correctOption: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4caf50',
    color: '#2e7d32',
    fontWeight: 600,
  },
  correctBadge: {
    backgroundColor: '#4caf50',
    color: '#fff',
    padding: '0.25rem 0.75rem',
    borderRadius: 4,
    fontSize: 'clamp(12px, 2vw, 14px)',
    fontWeight: 600,
    textTransform: 'uppercase',
  },
  participantsList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '0.75rem',
    flex: 1,
  },
  noParticipants: {
    textAlign: 'center',
    color: '#666',
    padding: '1rem',
    fontSize: 'clamp(12px, 2vw, 14px)',
    fontStyle: 'italic',
  },
  participantCard: {
    border: '1px solid #e9ecef',
    borderRadius: 6,
    padding: '0.75rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  participantInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  participantName: {
    fontWeight: 600,
    color: '#222',
    fontSize: 'clamp(14px, 2.5vw, 16px)',
  },
  participantStatus: {
    fontSize: 12,
    color: '#666',
    textTransform: 'capitalize',
  },
  participantScore: {
    fontWeight: 600,
    color: '#3f51b5',
    fontSize: 'clamp(12px, 2vw, 14px)',
  },
  loading: {
    textAlign: 'center',
    color: '#888',
    fontSize: 'clamp(16px, 3vw, 18px)',
    padding: '2rem 0',
  },
  error: {
    textAlign: 'center',
    color: '#e53935',
    fontSize: 'clamp(16px, 3vw, 18px)',
    padding: '2rem 0',
  },
  timerSection: {
    marginTop: '1rem',
    paddingTop: '0.75rem',
    borderTop: '1px solid #eee',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  timerLabel: {
    fontSize: 'clamp(14px, 2vw, 16px)',
    color: '#555',
    marginBottom: '0.5rem',
  },
  bigTimer: {
    fontSize: 'clamp(24px, 5vw, 36px)',
    fontWeight: 700,
    color: '#333',
    marginBottom: '0.5rem',
  },
  bigTimerCritical: {
    color: '#f44336',
  },
  timerProgress: {
    width: '100%',
    height: '8px',
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  timerProgressBar: {
    height: '100%',
    borderRadius: 4,
    transition: 'width 0.3s ease-in-out',
  },
  editingInterface: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    padding: '1.5rem',
    border: '2px solid #2196f3',
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  editField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  editLabel: {
    fontSize: 'clamp(16px, 2.5vw, 18px)',
    fontWeight: 700,
    color: '#2196f3',
    marginBottom: '0.5rem',
  },
  editTextarea: {
    width: '100%',
    padding: '1rem',
    border: '2px solid #e0e0e0',
    borderRadius: 8,
    fontSize: 'clamp(14px, 2.5vw, 16px)',
    lineHeight: 1.5,
    resize: 'vertical',
    backgroundColor: '#fff',
    color: '#333',
    fontFamily: 'inherit',
    minHeight: '80px',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s ease',
    '&:focus': {
      outline: 'none',
      borderColor: '#2196f3',
      boxShadow: '0 0 0 3px rgba(33,150,243,0.1)',
    },
  },
  editOptionsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  editOptionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '0.75rem',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    border: '1px solid #e0e0e0',
  },
  editOptionInput: {
    flex: 1,
    padding: '0.75rem',
    border: '1px solid #ccc',
    borderRadius: 6,
    fontSize: 'clamp(14px, 2.5vw, 16px)',
    backgroundColor: '#fff',
    color: '#333',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s ease',
    '&:focus': {
      outline: 'none',
      borderColor: '#2196f3',
      boxShadow: '0 0 0 2px rgba(33,150,243,0.1)',
    },
  },
  correctRadio: {
    marginLeft: '1rem',
    transform: 'scale(1.3)',
    accentColor: '#2196f3',
  },
  correctLabel: {
    fontSize: 'clamp(14px, 2.5vw, 16px)',
    color: '#2196f3',
    fontWeight: 600,
    marginLeft: '0.5rem',
  },
  editActions: {
    display: 'flex',
    justifyContent: 'center',
    gap: '1rem',
    marginTop: '1rem',
  },
  saveBtn: {
    backgroundColor: '#4caf50',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '0.75rem 1.5rem',
    fontWeight: 600,
    fontSize: 'clamp(14px, 2.5vw, 16px)',
    cursor: 'pointer',
  },
  cancelBtn: {
    backgroundColor: '#f44336',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '0.75rem 1.5rem',
    fontWeight: 600,
    fontSize: 'clamp(14px, 2.5vw, 16px)',
    cursor: 'pointer',
  },
  startQuizContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    padding: '1.5rem',
    border: '2px dashed #2196f3',
    borderRadius: 12,
    textAlign: 'center',
    backgroundColor: '#f0f7ff',
  },
  startQuizText: {
    fontSize: 'clamp(14px, 2vw, 16px)',
    color: '#333',
    lineHeight: 1.6,
  },
};

export default LiveSessionManagement; 
