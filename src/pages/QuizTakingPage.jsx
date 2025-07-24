import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import QuizPresenceManager from '../utils/quizPresence';

const QuizTakingPage = () => {
  const { userId, quizId } = useParams();
  const navigate = useNavigate();
  
  // Quiz state
  const [quiz, setQuiz] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [localAnswers, setLocalAnswers] = useState([]); // Store answers locally
  const [timeRemaining, setTimeRemaining] = useState(3600); // 1 hour in seconds
  const [score, setScore] = useState(0); // Start with 0 score
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [presenceManager] = useState(() => new QuizPresenceManager());
  const [quizStartTime] = useState(new Date()); // Track start time locally

  // Timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          // Submit quiz when time runs out (without including current answer)
          submitQuizToFirebase(false).then((success) => {
            if (success) {
              navigate(`/${userId}/quiz/${quizId}/results`);
            } else {
              alert('Time is up! Failed to submit quiz automatically.');
            }
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [userId, quizId, navigate]); // Add dependencies for the async function

  // Auth check
  useEffect(() => {
    
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      
      if (currentUser) {
        if (userId && userId !== currentUser.uid) {
          navigate(`/${currentUser.uid}/quiz/${quizId}`);
          return;
        }
        setUser(currentUser);
      } else {
        navigate('/login');
      }
    });

    return () => unsubscribe();
  }, [navigate, userId, quizId]);

  // Fetch quiz data
  useEffect(() => {
    
    const fetchQuiz = async () => {
      try {
        const quizDoc = await getDoc(doc(db, 'quizzes', quizId));
        
        if (quizDoc.exists()) {
          const quizData = { id: quizDoc.id, ...quizDoc.data() };
          setQuiz(quizData);
          
          // Join quiz session for presence tracking
          try {
            await presenceManager.joinQuiz(
              quizId, 
              user.uid, 
              user.displayName || user.email?.split('@')[0] || 'Anonymous'
            );
            console.log('Successfully joined quiz session for presence tracking');
          } catch (error) {
            console.error('Failed to join quiz session:', error);
          }
          
        } else {
          console.error('Quiz not found for ID:', quizId);
          navigate(`/${userId}/dashboard`);
        }
      } catch (error) {
        console.error('Error fetching quiz:', error);
        console.error('Error details:', error.message);
        navigate(`/${userId}/dashboard`);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchQuiz();
    } else {
    }
  }, [quizId, navigate, userId, user]);

  // Cleanup presence on unmount
  useEffect(() => {
    return () => {
      // Clean up presence tracking when component unmounts
      presenceManager.leaveQuiz().catch(err => 
        console.error('Error cleaning up presence on unmount:', err)
      );
    };
  }, [presenceManager]);

  // Format time helper
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswerSelect = (option) => {
    setCurrentAnswer(option);
  };

  const handleSaveAndNext = () => {
    // Check if current answer is correct and update score
    const currentQuestion = quiz.questions[currentQuestionIndex];
    const isCorrect = currentAnswer === currentQuestion.answer;
    
    let newScore = score;
    if (isCorrect) {
      newScore = score + 1;
      setScore(newScore);
    }

    // Store answer locally
    const answerRecord = {
      questionText: currentQuestion.question,
      choices: currentQuestion.options || currentQuestion.choices,
      userChoice: currentAnswer,
      correctAnswer: currentQuestion.answer,
      questionIndex: currentQuestionIndex,
      isCorrect: isCorrect,
      answeredAt: new Date()
    };

    setLocalAnswers(prev => [...prev, answerRecord]);
    console.log('Answer stored locally:', answerRecord);

    // Move to next question
    if (currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setCurrentAnswer(''); // Reset current answer for the next question
    }
  };

  // Submit all quiz data to Firebase in batch
  const submitQuizToFirebase = async (includeCurrentAnswer = false) => {
    try {
      console.log('Starting batch quiz submission...');

      // Prepare final answers array
      let finalAnswers = [...localAnswers];
      let finalScore = score;

      // Include current answer if submitting via button (not timeout)
      if (includeCurrentAnswer && currentAnswer) {
        const currentQuestion = quiz.questions[currentQuestionIndex];
        const isCorrect = currentAnswer === currentQuestion.answer;
        
        if (isCorrect) {
          finalScore = score + 1;
          setScore(finalScore);
        }

        const finalAnswerRecord = {
          questionText: currentQuestion.question,
          choices: currentQuestion.options || currentQuestion.choices,
          userChoice: currentAnswer,
          correctAnswer: currentQuestion.answer,
          questionIndex: currentQuestionIndex,
          isCorrect: isCorrect,
          answeredAt: new Date()
        };

        finalAnswers.push(finalAnswerRecord);
        console.log('Final answer included:', finalAnswerRecord);
      }

      // Calculate metrics
      const quizEndTime = new Date();
      const timeTakenSeconds = Math.floor((quizEndTime - quizStartTime) / 1000);
      const percentageScore = Math.round((finalScore / quiz.questions.length) * 100);

      console.log('Quiz metrics:', {
        finalScore,
        totalQuestions: quiz.questions.length,
        percentageScore,
        timeTaken: timeTakenSeconds,
        answersCount: finalAnswers.length
      });

      // Prepare final result data
      const finalResultData = {
        userId: user.uid,
        userName: user.displayName || user.email?.split('@')[0] || 'Anonymous',
        quizId: quizId,
        quizName: quiz.name,
        answers: finalAnswers,
        score: finalScore,
        totalQuestions: quiz.questions.length,
        percentageScore: percentageScore,
        timeTaken: timeTakenSeconds,
        startedAt: quizStartTime,
        completedAt: quizEndTime,
        status: 'completed'
      };

      // Save to Firebase (both collections for redundancy)
      const resultId = `${user.uid}_${quizId}_${Date.now()}`;
      
      // Save detailed results
      await setDoc(doc(db, 'quizResults', resultId), finalResultData);
      console.log('Results saved to quizResults collection');

      // Save summary to userProgress for easy access
      await setDoc(doc(db, 'userProgress', `${user.uid}_${quizId}`), {
        userId: user.uid,
        quizId: quizId,
        finalScore: finalScore,
        totalQuestions: quiz.questions.length,
        percentageScore: percentageScore,
        timeTaken: timeTakenSeconds,
        startedAt: quizStartTime,
        completedAt: quizEndTime,
        status: 'completed'
      });
      console.log('Progress summary saved');

      // Clean up presence
      await presenceManager.leaveQuiz();
      console.log('Batch submission completed successfully');

      return true;
    } catch (error) {
      console.error('Error in batch submission:', error);
      return false;
    }
  };

  const handleSubmitQuiz = async () => {
    // Submit quiz with current answer included
    const success = await submitQuizToFirebase(true);
    
    if (success) {
      // Navigate to results page
      navigate(`/${userId}/quiz/${quizId}/results`);
    } else {
      alert('Failed to submit quiz. Please try again.');
    }
  };

  const handleResetAnswer = () => {
    setCurrentAnswer('');
  };

  const handleExitQuiz = async () => {
    if (window.confirm('Are you sure you want to exit? Your progress will be lost.')) {
      // Clean up presence tracking
      try {
        await presenceManager.leaveQuiz();
      } catch (error) {
        console.error('Error leaving quiz session:', error);
      }
      
      navigate(`/${userId}/dashboard`);
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading quiz...</div>
      </div>
    );
  }

  if (!quiz || !quiz.questions || quiz.questions.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>Quiz not found or has no questions</div>
      </div>
    );
  }

  const currentQuestion = quiz.questions[currentQuestionIndex];
  
  // Additional safety check for current question and normalize the options field
  if (!currentQuestion || (!currentQuestion.options && !currentQuestion.choices)) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>Question data is invalid</div>
      </div>
    );
  }

  // Handle both 'options' and 'choices' field names (normalize to options)
  const questionOptions = currentQuestion.options || currentQuestion.choices || [];

  const progress = ((currentQuestionIndex + 1) / quiz.questions.length) * 100;
  const isLastQuestion = currentQuestionIndex === quiz.questions.length - 1;

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logo}>algoed</div>
        <div style={styles.headerInfo}>
          <div style={styles.quizTitle}>{quiz.name}</div>
          <div style={styles.scoreInfo}>
            <span style={styles.scoreLabel}>Current Score:</span>
            <span style={styles.scoreValue}>{score}/{quiz.questions.length}</span>
          </div>
        </div>
        <div style={styles.timerSection}>
          <div style={styles.timer}>{formatTime(timeRemaining)}</div>
          <button style={styles.exitBtn} onClick={handleExitQuiz}>Exit Quiz</button>
        </div>
      </header>

      {/* Quiz Content Wrapper */}
      <div style={styles.contentWrapper}>
        <div style={styles.quizContainer}>
          {/* Question Box */}
          <div style={styles.questionBox}>
            <div style={styles.questionHeader}>
              <div style={styles.questionCounter}>
                Question {currentQuestionIndex + 1} of {quiz.questions.length}
              </div>
              <div style={styles.progressBarContainer}>
                <div style={styles.progressBar}>
                  <div style={{...styles.progressFill, width: `${progress}%`}} />
                </div>
              </div>
            </div>
            <div style={styles.questionText}>
              {currentQuestion.question}
            </div>
          </div>

          {/* Options Grid - No outer box */}
          <div style={styles.optionsGrid}>
            {questionOptions && questionOptions.length > 0 ? (
              questionOptions
                .filter(option => option !== undefined && option !== null && option !== '')
                .map((option, index) => (
                  <div
                    key={index}
                    style={{
                      ...styles.optionCard,
                      ...(currentAnswer === option ? styles.selectedOptionCard : {})
                    }}
                    onMouseEnter={(e) => {
                      if (currentAnswer !== option) {
                        e.target.style.borderColor = '#3f51b5';
                        e.target.style.backgroundColor = '#f8f9ff';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (currentAnswer !== option) {
                        e.target.style.borderColor = '#e9ecef';
                        e.target.style.backgroundColor = '#fff';
                      }
                    }}
                    onClick={() => handleAnswerSelect(option)}
                  >
                    <div style={styles.optionRadio}>
                      {currentAnswer === option && <div style={styles.optionRadioSelected} />}
                    </div>
                    <span style={styles.optionText}>{option}</span>
                  </div>
                ))
            ) : (
              <div style={styles.error}>No valid options available for this question</div>
            )}
          </div>

          {/* Actions Box */}
          <div style={styles.actionsBox}>
            <button 
              style={styles.resetBtn} 
              onClick={handleResetAnswer}
              disabled={!currentAnswer}
            >
              Reset response
            </button>
            
            {isLastQuestion ? (
              <button 
                style={{...styles.nextBtn, ...styles.submitBtn}} 
                onClick={handleSubmitQuiz}
                disabled={!currentAnswer}
              >
                Submit Quiz
              </button>
            ) : (
              <button 
                style={styles.nextBtn} 
                onClick={handleSaveAndNext}
                disabled={!currentAnswer}
              >
                Save & next →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    minWidth: '100vw', 
    width: '100vw',
    height: '100vh',
    backgroundColor: '#f5f6fa',
    fontFamily: 'Inter, Arial, sans-serif',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    margin: 0,
    padding: 0,
  },
  header: {
    backgroundColor: '#fff',
    padding: '1rem 2rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: '#e9ecef',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  logo: {
    fontWeight: 800,
    fontSize: 24,
    color: '#3f51b5',
    letterSpacing: 2,
  },
  headerInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem',
  },
  quizTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#222',
  },
  scoreInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  scoreLabel: {
    fontSize: 14,
    color: '#666',
  },
  scoreValue: {
    fontSize: 16,
    fontWeight: 700,
    color: '#4caf50',
  },
  timerSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  timer: {
    fontSize: 18,
    fontWeight: 600,
    color: '#222',
    padding: '0.5rem 1rem',
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e9ecef',
  },
  exitBtn: {
    backgroundColor: '#fff',
    color: '#e53935',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e53935',
    borderRadius: 6,
    padding: '0.5rem 1rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: 14,
  },
  contentWrapper: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem 1rem',
    width: '100%',
    boxSizing: 'border-box',
  },
  quizContainer: {
    width: '100%',
    maxWidth: '900px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  questionBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: '2rem',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    width: '100%',
    boxSizing: 'border-box',
  },
  questionHeader: {
    marginBottom: '1.5rem',
  },
  questionCounter: {
    fontSize: 14,
    color: '#666',
    marginBottom: '0.5rem',
  },
  progressBarContainer: {
    width: '100%',
  },
  progressBar: {
    height: 8,
    background: '#e9ecef',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3f51b5',
    borderRadius: 4,
    transition: 'width 0.3s ease',
  },
  questionText: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#222',
    lineHeight: 1.6,
    marginTop: '1rem',
  },
  optionsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr', // Fixed 2 columns for clean 2x2 layout
    gridTemplateRows: '1fr 1fr', // Fixed 2 rows 
    gap: '1rem',
    width: '100%',
    marginBottom: '1.5rem', // Add some space before actions box
  },
  optionCard: {
    display: 'flex',
    alignItems: 'center',
    padding: '1rem',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e9ecef',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    width: '100%',
    boxSizing: 'border-box',
    minHeight: '60px',
    backgroundColor: '#fff',
  },
  selectedOptionCard: {
    borderColor: '#3f51b5',
    backgroundColor: '#f8f9ff',
  },
  optionRadio: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: '#ddd',
    marginRight: '1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  optionRadioSelected: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    backgroundColor: '#3f51b5',
  },
  optionText: {
    fontSize: 16,
    color: '#222',
    lineHeight: 1.4,
  },
  actionsBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: '2rem',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    width: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
  },
  resetBtn: {
    backgroundColor: 'transparent',
    color: '#666',
    borderStyle: 'none',
    fontSize: '14px',
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: '0.5rem',
  },
  nextBtn: {
    backgroundColor: '#3f51b5',
    color: '#fff',
    borderStyle: 'none',
    borderRadius: 6,
    padding: '0.75rem 2rem',
    fontWeight: 600,
    fontSize: '16px',
    cursor: 'pointer',
    transition: 'background 0.2s ease',
  },
  submitBtn: {
    backgroundColor: '#4caf50',
  },
  loading: {
    textAlign: 'center',
    color: '#888',
    fontSize: 18,
    padding: '2rem 0',
  },
  error: {
    textAlign: 'center',
    color: '#e53935',
    fontSize: 18,
    padding: '2rem 0',
  },
};

export default QuizTakingPage; 