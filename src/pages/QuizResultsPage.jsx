import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

const QuizResultsPage = () => {
  const { userId, quizId } = useParams();
  const navigate = useNavigate();
  
  const [user, setUser] = useState(null);
  const [quizResults, setQuizResults] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Auth check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        if (userId && userId !== currentUser.uid) {
          navigate(`/${currentUser.uid}/quiz/${quizId}/results`);
          return;
        }
        setUser(currentUser);
        fetchResultsData(currentUser.uid);
      } else {
        navigate('/login');
      }
    });

    return () => unsubscribe();
  }, [navigate, userId, quizId]);

  const fetchResultsData = async (currentUserId) => {
    try {
      console.log('Fetching quiz results for:', { currentUserId, quizId });
      
      // Fetch quiz data
      const quizDoc = await getDoc(doc(db, 'quizzes', quizId));
      if (!quizDoc.exists()) {
        setError('Quiz not found');
        setLoading(false);
        return;
      }
      
      const quizData = { id: quizDoc.id, ...quizDoc.data() };
      setQuiz(quizData);

      // Fetch live quiz results for this user and quiz
      const resultsQuery = query(
        collection(db, 'liveQuizResults'),
        where('userId', '==', currentUserId),
        where('quizId', '==', quizId)
      );
      
      const resultsSnapshot = await getDocs(resultsQuery);
      
      if (resultsSnapshot.empty) {
        setError('No quiz results found');
        setLoading(false);
        return;
      }

      // Get the most recent result if multiple sessions
      const results = resultsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort by last answered date and take the most recent
      results.sort((a, b) => (b.lastAnsweredAt?.toDate?.() || b.lastAnsweredAt) - (a.lastAnsweredAt?.toDate?.() || a.lastAnsweredAt));
      const latestResult = results[0];
      
      console.log('Latest quiz result:', latestResult);
      setQuizResults(latestResult);
      
    } catch (error) {
      console.error('Error fetching results:', error);
      setError('Failed to load quiz results');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeSpent) => {
    if (!timeSpent) return 'N/A';
    const minutes = Math.floor(timeSpent / 60);
    const seconds = timeSpent % 60;
    return `${minutes}m ${seconds}s`;
  };

  const getResultIcon = (isCorrect) => {
    return isCorrect ? '✅' : '❌';
  };

  const getScoreColor = (percentage) => {
    if (percentage >= 90) return '#4caf50';
    if (percentage >= 70) return '#ff9800';
    return '#f44336';
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading quiz results...</div>
      </div>
    );
  }

  if (error || !quizResults || !quiz) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>{error || 'Results not found'}</div>
        <button style={styles.backBtn} onClick={() => navigate(`/${userId}/dashboard`)}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  const percentage = quiz.questions.length > 0 ? 
    ((quizResults.currentScore / quiz.questions.length) * 100).toFixed(1) : 0;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Quiz Results</h1>
        <button style={styles.backBtn} onClick={() => navigate(`/${userId}/dashboard`)}>
          Back to Dashboard
        </button>
      </div>

      {/* Combined Quiz Info and Score Summary */}
      <div style={styles.mainSummary}>
        <h2 style={styles.quizName}>{quiz.name}</h2>
        <div style={styles.quizMeta}>
          <span>Category: {quiz.category}</span>
          <span>Completed: {quizResults.lastAnsweredAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}</span>
        </div>
        
        <div style={styles.scoreContainer}>
          <div style={styles.scoreCard}>
            <div style={styles.scoreNumber}>
              {quizResults.currentScore}/{quiz.questions.length}
            </div>
            <div style={{...styles.scorePercentage, color: getScoreColor(parseFloat(percentage))}}>
              {percentage}%
            </div>
            <div style={styles.scoreLabel}>Final Score</div>
          </div>
          
          <div style={styles.statsGrid}>
            <div style={styles.statItem}>
              <span style={styles.statValue}>{quizResults.questionsAnswered}</span>
              <span style={styles.statLabel}>Questions Answered</span>
            </div>
            <div style={styles.statItem}>
              <span style={styles.statValue}>{quizResults.currentScore}</span>
              <span style={styles.statLabel}>Correct Answers</span>
            </div>
            <div style={styles.statItem}>
              <span style={styles.statValue}>{quiz.questions.length - quizResults.questionsAnswered}</span>
              <span style={styles.statLabel}>Not Answered</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Question Review */}
      <div style={styles.questionsSection}>
        <h3 style={styles.sectionTitle}>Question by Question Review</h3>
        
        {quiz.questions.map((questionData, index) => {
          // Find the answer for this question (if any)
          const answer = (quizResults.answers || []).find(a => a.questionIndex === index);
          const hasAnswer = !!answer;
          const userAnswer = answer?.userAnswer || null;
          const isCorrect = answer?.isCorrect || false;
          const isAutoSubmitted = answer?.isAutoSubmitted || false;

          return (
            <div key={index} style={styles.questionCard}>
              <div style={styles.questionHeader}>
                <span style={styles.questionNumber}>Question {index + 1}</span>
                <span style={styles.questionResult}>
                  {hasAnswer ? 
                    (isCorrect ? '✅ Correct' : '❌ Incorrect') : 
                    '⏰ Not Answered'
                  }
                </span>
              </div>
              
              <div style={styles.questionText}>
                {questionData.question}
              </div>
              
              <div style={styles.answersSection}>
                <div style={styles.answerGroup}>
                  <div style={styles.answerLabel}>Your Answer:</div>
                  <div style={{
                    ...styles.answerValue,
                    ...(hasAnswer ? 
                      (isCorrect ? styles.correctAnswer : styles.incorrectAnswer) : 
                      styles.noAnswer
                    )
                  }}>
                    {userAnswer || 
                      (isAutoSubmitted ? 'Time ran out - no answer provided' : 'No answer provided')
                    }
                  </div>
                </div>
                
                {(!hasAnswer || !isCorrect) && (
                  <div style={styles.answerGroup}>
                    <div style={styles.answerLabel}>Correct Answer:</div>
                    <div style={{...styles.answerValue, ...styles.correctAnswer}}>
                      {questionData.answer}
                    </div>
                  </div>
                )}
              </div>

              <div style={styles.questionMeta}>
                <span>Time Spent: {formatTime(answer?.timeSpent)}</span>
                <span>
                  {hasAnswer ? 
                    `Answered At: ${answer.answeredAt?.toDate?.()?.toLocaleTimeString() || 'Unknown'}` :
                    'Not answered within time limit'
                  }
                </span>
                {isAutoSubmitted && (
                  <span style={{color: '#ff9800', fontWeight: 600}}>⏰ Auto-submitted (time expired)</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
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
    justifyContent: 'flex-start',
    padding: '2rem 1rem',
    backgroundColor: '#f5f6fa',
    fontFamily: 'Inter, Arial, sans-serif',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
    width: '100%',
    maxWidth: '1000px',
  },
  title: {
    fontSize: 'clamp(24px, 4vw, 32px)',
    fontWeight: 700,
    color: '#3f51b5',
    margin: 0,
  },
  backBtn: {
    backgroundColor: '#3f51b5',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '0.75rem 1.5rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: 'clamp(14px, 2.5vw, 16px)',
  },
  quizName: {
    fontSize: 'clamp(20px, 3vw, 24px)',
    fontWeight: 600,
    color: '#222',
    marginBottom: '0.5rem',
  },
  quizMeta: {
    display: 'flex',
    gap: '2rem',
    fontSize: 'clamp(14px, 2.5vw, 16px)',
    color: '#666',
    flexWrap: 'wrap',
    marginBottom: '1.5rem',
  },
  scoreCard: {
    textAlign: 'center',
    minWidth: '200px',
    flex: '0 0 auto',
  },
  scoreNumber: {
    fontSize: 'clamp(32px, 6vw, 48px)',
    fontWeight: 700,
    color: '#3f51b5',
    marginBottom: '0.5rem',
  },
  scorePercentage: {
    fontSize: 'clamp(24px, 4vw, 32px)',
    fontWeight: 600,
    marginBottom: '0.5rem',
  },
  scoreLabel: {
    fontSize: 'clamp(14px, 2.5vw, 16px)',
    color: '#666',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: '1.5rem',
    flex: 1,
    minWidth: '300px',
  },
  statItem: {
    textAlign: 'center',
  },
  statValue: {
    display: 'block',
    fontSize: 'clamp(20px, 3vw, 24px)',
    fontWeight: 700,
    color: '#3f51b5',
    marginBottom: '0.25rem',
  },
  statLabel: {
    fontSize: 'clamp(12px, 2vw, 14px)',
    color: '#666',
  },
  questionsSection: {
    width: '100%',
    maxWidth: '1000px',
  },
  sectionTitle: {
    fontSize: 'clamp(18px, 3vw, 22px)',
    fontWeight: 600,
    color: '#222',
    marginBottom: '1.5rem',
  },
  questionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: '1.5rem',
    marginBottom: '1.5rem',
    boxShadow: '0 2px 12px rgba(63,81,181,0.08)',
    width: '100%',
    boxSizing: 'border-box',
  },
  questionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  questionNumber: {
    fontSize: 'clamp(16px, 2.5vw, 18px)',
    fontWeight: 600,
    color: '#3f51b5',
  },
  questionResult: {
    fontSize: 'clamp(14px, 2.5vw, 16px)',
    fontWeight: 600,
  },
  questionText: {
    fontSize: 'clamp(16px, 2.5vw, 18px)',
    fontWeight: 500,
    color: '#222',
    marginBottom: '1.5rem',
    lineHeight: 1.5,
  },
  answersSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    marginBottom: '1rem',
  },
  answerGroup: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  answerLabel: {
    fontSize: 'clamp(14px, 2.5vw, 16px)',
    fontWeight: 600,
    color: '#666',
    minWidth: '120px',
    flex: '0 0 auto',
  },
  answerValue: {
    fontSize: 'clamp(14px, 2.5vw, 16px)',
    padding: '0.5rem 1rem',
    borderRadius: 6,
    flex: 1,
    minWidth: '200px',
  },
  correctAnswer: {
    backgroundColor: '#e8f5e8',
    color: '#2e7d32',
    border: '1px solid #4caf50',
  },
  incorrectAnswer: {
    backgroundColor: '#ffebee',
    color: '#c62828',
    border: '1px solid #f44336',
  },
  noAnswer: {
    backgroundColor: '#f5f5f5',
    color: '#666',
    border: '1px solid #ccc',
    fontStyle: 'italic',
  },
  questionMeta: {
    display: 'flex',
    gap: '2rem',
    fontSize: 'clamp(12px, 2vw, 14px)',
    color: '#888',
    paddingTop: '1rem',
    borderTop: '1px solid #eee',
    flexWrap: 'wrap',
  },
  loading: {
    textAlign: 'center',
    fontSize: 'clamp(16px, 3vw, 20px)',
    color: '#666',
    padding: '4rem 0',
  },
  error: {
    textAlign: 'center',
    fontSize: 'clamp(16px, 3vw, 20px)',
    color: '#f44336',
    padding: '4rem 0',
  },
  mainSummary: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: '2rem',
    marginBottom: '2rem',
    boxShadow: '0 2px 12px rgba(63,81,181,0.08)',
    width: '100%',
    maxWidth: '1000px',
    boxSizing: 'border-box',
  },
  scoreContainer: {
    display: 'flex',
    gap: '2rem',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
};

export default QuizResultsPage; 