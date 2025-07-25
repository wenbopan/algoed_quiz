import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import LiveQuizManager from '../utils/liveQuizManager';

const LiveQuizStudent = () => {
  const { userId, sessionId } = useParams();
  const navigate = useNavigate();
  
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [myParticipant, setMyParticipant] = useState(null);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [liveQuizManager] = useState(() => new LiveQuizManager());
  const [editingMessage, setEditingMessage] = useState('');

  // Debug editingMessage changes
  useEffect(() => {
    console.log('EditingMessage state changed to:', editingMessage);
  }, [editingMessage]);

  // Auth check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        if (userId && userId !== currentUser.uid) {
          navigate(`/${currentUser.uid}/live-quiz/${sessionId}`);
          return;
        }
        setUser(currentUser);
      } else {
        navigate('/login');
      }
    });

    return () => unsubscribe();
  }, [navigate, userId, sessionId]);

  // Set up real-time listeners
  useEffect(() => {
    if (!user || !sessionId) return;

    const setupLiveQuiz = async () => {
      try {
        // Set up session listener
        liveQuizManager.listenToSession(sessionId, (sessionData) => {
          console.log('Session updated:', sessionData);
          console.log('Current editing message:', editingMessage);
          console.log('Session isEditing:', sessionData?.isEditing);
          setSession(sessionData);
          
          if (sessionData && sessionData.quizId && !quiz) {
            fetchQuizData(sessionData.quizId);
          }

          // Handle editing mode transitions
          if (sessionData && sessionData.isEditing) {
            console.log('Setting editing message - admin is editing');
            setEditingMessage('🔒 Question is being edited by the admin. Please wait...');
            setCurrentAnswer(''); // Clear any selected answer
            setAnswerSubmitted(false); // Allow re-submission when editing ends
          } else if (sessionData && sessionData.isEditing === false) {
            // Explicitly check for false to ensure we're clearing when editing stops
            console.log('Clearing editing message - admin finished editing');
            setEditingMessage('');
            // Force a re-render by setting to empty string explicitly
            setTimeout(() => setEditingMessage(''), 0);
            // Question editing finished - timer restarted, can answer again
          } else if (sessionData && !sessionData.hasOwnProperty('isEditing')) {
            // If isEditing property doesn't exist, assume not editing
            console.log('No isEditing property - clearing editing message');
            setEditingMessage('');
          }

          // Reset answer when question changes (but not during editing)
          if (sessionData && sessionData.currentQuestionIndex !== undefined && !sessionData.isEditing) {
            setCurrentAnswer('');
            setAnswerSubmitted(false);
          }
        });

        // Set up participants listener
        liveQuizManager.listenToParticipants(sessionId, (participantsData) => {
          console.log('Participants updated:', participantsData);
          setParticipants(participantsData);
          
          // Find my participant data
          const me = participantsData.find(p => p.userId === user.uid);
          setMyParticipant(me);
          
          // Check if I already answered current question
          if (me && session && session.currentQuestionIndex >= 0) {
            const alreadyAnswered = me.answers && me.answers.some(a => a.questionIndex === session.currentQuestionIndex);
            setAnswerSubmitted(alreadyAnswered);
          }
        });

        setLoading(false);
      } catch (error) {
        console.error('Error setting up live quiz:', error);
        setError('Failed to load live quiz');
        setLoading(false);
      }
    };

    setupLiveQuiz();

    return () => {
      liveQuizManager.cleanup(sessionId);
    };
  }, [user, sessionId]);

  // Timer effect
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

      if (remaining === 0 && !answerSubmitted && !session.isEditing) {
        // Time's up - auto submit current answer if any
        if (currentAnswer) {
          handleSubmitAnswer();
        }
      }
    };

    updateTimer(); // Initial update
    const timer = setInterval(updateTimer, 1000);

    return () => clearInterval(timer);
  }, [session, answerSubmitted, currentAnswer]);

  // Auto-save answers to localStorage
  useEffect(() => {
    if (currentAnswer && session && quiz) {
      const currentQuestion = quiz.questions[session.currentQuestionIndex];
      if (currentQuestion) {
        const answerData = {
          questionIndex: session.currentQuestionIndex,
          questionId: currentQuestion.id || `q${session.currentQuestionIndex}`,
          userAnswer: currentAnswer,
          savedAt: new Date().toISOString()
        };
        
        const storageKey = `liveQuiz_${sessionId}_${user?.uid}`;
        let localData = JSON.parse(localStorage.getItem(storageKey) || '{}');
        if (!localData.tempAnswers) localData.tempAnswers = [];
        
        const existingIndex = localData.tempAnswers.findIndex(a => a.questionIndex === session.currentQuestionIndex);
        if (existingIndex !== -1) {
          localData.tempAnswers[existingIndex] = answerData;
        } else {
          localData.tempAnswers.push(answerData);
        }
        
        localStorage.setItem(storageKey, JSON.stringify(localData));
      }
    }
  }, [currentAnswer, session, quiz, sessionId, user]);

  // Handle browser close/navigation to save any pending data
  useEffect(() => {
    const handleBeforeUnload = (event) => {
      // Save any pending answer data
      if (currentAnswer && session && quiz && user) {
        const storageKey = `liveQuiz_${sessionId}_${user.uid}`;
        const localData = JSON.parse(localStorage.getItem(storageKey) || '{}');
        
        // Mark as interrupted for potential recovery
        localData.interrupted = true;
        localData.lastSeen = new Date().toISOString();
        localData.sessionStatus = session.status;
        localData.currentQuestionIndex = session.currentQuestionIndex;
        
        try {
          localStorage.setItem(storageKey, JSON.stringify(localData));
          
          // Attempt to send final data via beacon (more reliable than fetch on unload)
          if (navigator.sendBeacon && localData.tempAnswers?.length > 0) {
            const finalData = {
              sessionId,
              userId: user.uid,
              answers: localData.tempAnswers,
              interrupted: true,
              timestamp: new Date().toISOString()
            };
            
            // This would require a server endpoint, but for Firebase we rely on localStorage
            // navigator.sendBeacon('/api/save-quiz-progress', JSON.stringify(finalData));
          }
        } catch (error) {
          console.error('Error saving data on unload:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentAnswer, session, quiz, user, sessionId]);

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

  const handleAnswerSelect = (option) => {
    if (answerSubmitted || timeRemaining === 0 || session.isEditing) return;
    setCurrentAnswer(option);
  };

  const handleSubmitAnswer = async () => {
    if (!currentAnswer || answerSubmitted || !session || !quiz || session.isEditing) return;

    try {
      const currentQuestion = quiz.questions[session.currentQuestionIndex];
      if (!currentQuestion) return;

      console.log('Submitting answer:', currentAnswer);
      
      const result = await liveQuizManager.submitAnswer(
        sessionId,
        user.uid,
        session.currentQuestionIndex,
        currentAnswer,
        currentQuestion
      );

      if (result.success) {
        setAnswerSubmitted(true);
        console.log('Answer submitted successfully. Progress:', result.progress);
        
        // Show feedback message
        const isCorrect = result.isCorrect;
        setEditingMessage(isCorrect ? '✅ Correct!' : '❌ Incorrect');
        setTimeout(() => setEditingMessage(''), 2000);
      } else {
        console.error('Failed to submit answer:', result.error);
        if (result.error.includes('editing')) {
          setEditingMessage('🔒 Question is being edited. Please wait...');
        } else {
          alert(`Failed to submit answer: ${result.error}`);
        }
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
      alert('Failed to submit answer. Please try again.');
    }
  };

  const handleLeaveSession = () => {
    if (window.confirm('Are you sure you want to leave this live quiz?')) {
      navigate(`/${userId}/dashboard`);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div style={styles.loading}>Connecting to live quiz...</div>
    );
  }

  if (error || !session) {
    return (
      <div style={styles.error}>
        <div>{error || 'Session not found'}</div>
        <button style={styles.backBtn} onClick={() => navigate(`/${userId}/dashboard`)}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  // Waiting for quiz to start
  if (session.status === 'waiting') {
    return (
      <div style={styles.container}>
        <div style={styles.logo}>algoed</div>
        <h1 style={styles.waitingTitle}>🎮 Live Quiz Lobby</h1>
        
        {/* Session Info Card */}
        <div style={styles.sessionInfo}>
          <div style={styles.sessionCode}>Session: {session.sessionCode}</div>
          <div style={styles.quizName}>{quiz?.name || 'Loading quiz...'}</div>
          <div style={styles.participantCount}>{session.participantCount} participants joined</div>
        </div>

        {/* Waiting Message Card */}
        <div style={styles.waitingMessage}>
          <div style={styles.waitingIcon}>⏳</div>
          <div style={styles.waitingText}>Waiting for admin to start...</div>
        </div>

        <button style={styles.leaveBtn} onClick={handleLeaveSession}>
          Leave Session
        </button>
      </div>
    );
  }

  // Quiz completed
  if (session.status === 'completed') {
    const myScore = myParticipant?.currentScore || 0;
    
    // Debug: Log the quiz data to see what we have
    console.log('Quiz data on completion:', quiz);
    console.log('Quiz questions length:', quiz?.questions?.length);
    console.log('Session data:', session);
    
    // Use total questions from quiz, with session data as fallback
    const totalQuestions = quiz?.questions?.length || session?.totalQuestions || 0;
    const percentage = totalQuestions > 0 ? ((myScore / totalQuestions) * 100).toFixed(1) : 0;
    
    console.log('Final calculation:', { myScore, totalQuestions, percentage });
    
    // Get user's display name
    const userName = user?.displayName || user?.email?.split('@')[0] || 'Student';
    
    // Generate encouraging message based on performance
    const getEncouragementMessage = (score) => {
      if (score >= 90) {
        return "🎉 Outstanding performance! You're a quiz champion!";
      } else if (score >= 80) {
        return "🌟 Great job! You really know your stuff!";
      } else if (score >= 70) {
        return "👍 Good work! You're on the right track!";
      } else if (score >= 60) {
        return "💪 Not bad! Keep practicing and you'll improve!";
      } else {
        return "📚 Don't worry! Learning takes time - let's practice more!";
      }
    };

    return (
      <div style={styles.container}>
        <div style={styles.logo}>algoed</div>
        <h1 style={styles.completionTitle}>🏁 Quiz Completed!</h1>
        
        {/* Personalized Congratulations */}
        <div style={styles.congratsMessage}>
          Congratulations <strong>{userName}</strong>!<br />
          You completed the quiz.
        </div>
        
        <div style={styles.scoreCard}>
          <div style={styles.finalScore}>
            {myScore}/{totalQuestions}
          </div>
          <div style={styles.percentage}>{percentage}%</div>
          <div style={styles.scoreLabel}>Final Score</div>
        </div>

        {/* Encouraging Message */}
        <div style={styles.encouragementMessage}>
          {getEncouragementMessage(parseFloat(percentage))}
        </div>

        <div style={styles.completionActions}>
          <button style={styles.dashboardBtn} onClick={() => navigate(`/${userId}/dashboard`)}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Active quiz
  const currentQuestion = quiz?.questions?.[session.currentQuestionIndex];
  const isEditing = session.status === 'editing' || session.isEditing;

  if (!currentQuestion) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading question...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header with progress */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logo}>algoed</div>
          <div style={styles.quizInfo}>
            <div style={styles.quizName}>{quiz?.name}</div>
            <div style={styles.progressInfo}>
              Question {session.currentQuestionIndex + 1} of {quiz?.questions?.length}
            </div>
          </div>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.scoreDisplay}>
            Score: {myParticipant?.currentScore || 0}/{myParticipant?.questionsAnswered || 0}
          </div>
          <div style={styles.participants}>
            👥 {session.participantCount} participants
          </div>
        </div>
      </div>

      {/* Editing Message */}
      {editingMessage && (
        <div style={{
          ...styles.messageBar,
          ...(editingMessage.includes('🔒') ? styles.editingMessageBar : 
              editingMessage.includes('✅') ? styles.successMessageBar : styles.errorMessageBar)
        }}>
          {editingMessage}
        </div>
      )}

      {/* Timer */}
      {!isEditing && (
        <div style={styles.timerBar}>
          <div style={styles.timerText}>
            Time Remaining: {formatTime(timeRemaining)}
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

      {/* Question */}
      <div style={styles.questionCard}>
        <h2 style={styles.questionText}>{currentQuestion.question}</h2>
        
        <div style={styles.optionsGrid}>
          {(currentQuestion.options || currentQuestion.choices || []).map((option, index) => (
            <button
              key={index}
              style={{
                ...styles.optionButton,
                ...(currentAnswer === option ? styles.selectedOption : {}),
                ...(answerSubmitted || timeRemaining === 0 || isEditing ? styles.disabledOption : {})
              }}
              onClick={() => handleAnswerSelect(option)}
              disabled={answerSubmitted || timeRemaining === 0 || isEditing}
            >
              <span style={styles.optionLetter}>{String.fromCharCode(65 + index)}</span>
              <span style={styles.optionText}>{option}</span>
            </button>
          ))}
        </div>

        {/* Submit Button */}
        {!answerSubmitted && !isEditing && (
          <div style={styles.submitSection}>
            <button
              style={{
                ...styles.submitBtn,
                ...(currentAnswer ? styles.submitBtnActive : styles.submitBtnDisabled)
              }}
              onClick={handleSubmitAnswer}
              disabled={!currentAnswer || timeRemaining === 0}
            >
              {timeRemaining === 0 ? 'Time\'s Up!' : 'Submit Answer'}
            </button>
          </div>
        )}

        {answerSubmitted && !isEditing && (
          <div style={styles.submittedMessage}>
            ✅ Answer submitted! Waiting for next question...
          </div>
        )}

        {isEditing && (
          <div style={styles.editingLockMessage}>
            🔒 Question is being edited by the admin. You can answer again when editing is finished.
          </div>
        )}
      </div>

      {/* Leave Button */}
      <button style={styles.leaveBtn} onClick={handleLeaveSession}>
        Leave Session
      </button>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    minWidth: '100vw',
    width: '100vw',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '1rem',
    boxSizing: 'border-box',
  },
  logo: {
    fontWeight: 800,
    fontSize: 'clamp(20px, 4vw, 28px)',
    color: '#3f51b5', // Changed from white to blue
    letterSpacing: 2,
    marginBottom: '1rem',
  },
  header: {
    width: '100%',
    maxWidth: '800px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
    padding: '1rem',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  headerRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '0.5rem',
  },
  quizInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  quizName: {
    fontSize: 'clamp(16px, 3vw, 20px)',
    fontWeight: 700,
    color: '#333',
  },
  progressInfo: {
    fontSize: 'clamp(12px, 2.5vw, 14px)',
    color: '#666',
  },
  scoreDisplay: {
    fontSize: 'clamp(14px, 2.5vw, 16px)',
    fontWeight: 600,
    color: '#3f51b5',
  },
  participants: {
    fontSize: 'clamp(12px, 2vw, 14px)',
    color: '#666',
  },
  messageBar: {
    width: '100%',
    maxWidth: '800px',
    padding: '1rem',
    borderRadius: 8,
    marginBottom: '1rem',
    textAlign: 'center',
    fontWeight: 600,
    fontSize: 'clamp(14px, 2.5vw, 16px)',
  },
  editingMessageBar: {
    backgroundColor: '#ff9800',
    color: '#fff',
  },
  successMessageBar: {
    backgroundColor: '#4caf50',
    color: '#fff',
  },
  errorMessageBar: {
    backgroundColor: '#f44336',
    color: '#fff',
  },
  timerBar: {
    width: '100%',
    maxWidth: '800px',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 8,
    padding: '1rem',
    marginBottom: '1rem',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
  },
  timerText: {
    textAlign: 'center',
    fontSize: 'clamp(16px, 3vw, 20px)',
    fontWeight: 600,
    color: '#333',
    marginBottom: '0.5rem',
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
  questionCard: {
    width: '100%',
    maxWidth: '800px',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: '2rem',
    boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
    marginBottom: '2rem',
  },
  questionText: {
    fontSize: 'clamp(18px, 4vw, 24px)',
    fontWeight: 600,
    color: '#333',
    marginBottom: '2rem',
    lineHeight: 1.4,
    textAlign: 'center',
  },
  optionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '1rem',
    marginBottom: '2rem',
  },
  optionButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem 1.5rem',
    backgroundColor: '#f8f9fa',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: '#e0e0e0',
    borderRadius: 12,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontSize: 'clamp(14px, 2.5vw, 16px)',
    textAlign: 'left',
    width: '100%',
    color: '#222', // Ensure text is dark
  },
  selectedOption: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196f3',
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 12px rgba(33,150,243,0.2)',
    color: '#1565c0', // Darker blue for selected state
  },
  disabledOption: {
    opacity: 0.6,
    cursor: 'not-allowed',
    color: '#666', // Ensure disabled text is still readable
  },
  optionLetter: {
    backgroundColor: '#3f51b5',
    color: '#fff',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    fontSize: 'clamp(12px, 2vw, 14px)',
  },
  optionText: {
    flex: 1,
    fontWeight: 500,
    color: 'inherit', // Inherit from parent optionButton
  },
  submitSection: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: '1rem',
  },
  submitBtn: {
    padding: '1rem 2rem',
    borderRadius: 8,
    border: 'none',
    fontSize: 'clamp(16px, 3vw, 18px)',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  submitBtnActive: {
    backgroundColor: '#4caf50',
    color: '#fff',
  },
  submitBtnDisabled: {
    backgroundColor: '#e0e0e0',
    color: '#999',
    cursor: 'not-allowed',
  },
  submittedMessage: {
    textAlign: 'center',
    padding: '1rem',
    backgroundColor: '#e8f5e8',
    color: '#2e7d32',
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 'clamp(14px, 2.5vw, 16px)',
  },
  editingLockMessage: {
    textAlign: 'center',
    padding: '1rem',
    backgroundColor: '#fff3e0',
    color: '#ef6c00',
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 'clamp(14px, 2.5vw, 16px)',
  },
  waitingTitle: {
    fontSize: 'clamp(24px, 5vw, 32px)',
    fontWeight: 700,
    color: '#fff',
    marginBottom: '2rem',
    textAlign: 'center',
  },
  sessionInfo: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: '1.5rem',
    marginBottom: '1rem',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
    textAlign: 'center',
    width: '100%',
    maxWidth: '500px',
  },
  sessionCode: {
    fontSize: 'clamp(20px, 4vw, 28px)',
    fontWeight: 700,
    color: '#3f51b5',
    marginBottom: '0.5rem',
  },
  participantCount: {
    fontSize: 'clamp(14px, 2.5vw, 16px)',
    color: '#666',
  },
  waitingMessage: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: '1.5rem',
    marginBottom: '2rem',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
    textAlign: 'center',
    width: '100%',
    maxWidth: '500px',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  waitingIcon: {
    fontSize: 'clamp(24px, 5vw, 32px)',
  },
  waitingText: {
    fontSize: 'clamp(14px, 2.5vw, 16px)',
    fontWeight: 600,
    color: '#222',
  },
  completionTitle: {
    fontSize: 'clamp(24px, 5vw, 32px)',
    fontWeight: 700,
    color: '#fff',
    marginBottom: '2rem',
    textAlign: 'center',
  },
  scoreCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: '2rem',
    marginBottom: '2rem',
    boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
    textAlign: 'center',
    maxWidth: '400px',
    width: '100%',
  },
  finalScore: {
    fontSize: 'clamp(32px, 8vw, 48px)',
    fontWeight: 700,
    color: '#3f51b5',
    marginBottom: '0.5rem',
  },
  percentage: {
    fontSize: 'clamp(24px, 6vw, 32px)',
    fontWeight: 600,
    color: '#4caf50',
    marginBottom: '0.5rem',
  },
  scoreLabel: {
    fontSize: 'clamp(14px, 2.5vw, 16px)',
    color: '#666',
  },
  completionActions: {
    display: 'flex',
    gap: '1rem',
  },
  dashboardBtn: {
    backgroundColor: '#3f51b5',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '1rem 2rem',
    fontSize: 'clamp(14px, 2.5vw, 16px)',
    fontWeight: 600,
    cursor: 'pointer',
  },
  congratsMessage: {
    fontSize: 'clamp(18px, 3vw, 22px)',
    fontWeight: 700,
    color: '#fff',
    textAlign: 'center',
    marginBottom: '1.5rem',
    lineHeight: 1.6,
  },
  encouragementMessage: {
    fontSize: 'clamp(16px, 2.5vw, 20px)',
    fontWeight: 500,
    color: '#fff',
    textAlign: 'center',
    marginTop: '1rem',
    marginBottom: '2rem',
    lineHeight: 1.5,
  },
  leaveBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    color: '#fff',
    border: '2px solid rgba(255, 255, 255, 0.3)',
    borderRadius: 8,
    padding: '0.75rem 1.5rem',
    fontSize: 'clamp(14px, 2.5vw, 16px)',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  loading: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 'clamp(16px, 3vw, 20px)',
    color: '#666',
  },
  error: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    fontSize: 'clamp(16px, 3vw, 20px)',
    color: '#e53935',
  },
  backBtn: {
    backgroundColor: '#3f51b5',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '0.75rem 1.5rem',
    fontSize: 'clamp(14px, 2.5vw, 16px)',
    fontWeight: 600,
    cursor: 'pointer',
  },
};

export default LiveQuizStudent; 