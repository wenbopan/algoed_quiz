import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

const QuizResultsPage = () => {
  const { userId, quizId } = useParams();
  const navigate = useNavigate();
  
  const [user, setUser] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        if (userId && userId !== currentUser.uid) {
          navigate(`/${currentUser.uid}/quiz/${quizId}/results`);
          return;
        }
        setUser(currentUser);
      } else {
        navigate('/login');
      }
    });

    return () => unsubscribe();
  }, [navigate, userId, quizId]);

  useEffect(() => {
    const fetchResults = async () => {
      if (!user) return;
      
      try {
        console.log('Fetching results for user:', user.uid, 'quiz:', quizId);
        
        // Fetch quiz information
        const quizDoc = await getDoc(doc(db, 'quizzes', quizId));
        if (quizDoc.exists()) {
          setQuiz({ id: quizDoc.id, ...quizDoc.data() });
          console.log('Quiz found:', quizDoc.data().name);
        } else {
          console.log('Quiz not found');
        }

        // Try to fetch from userProgress first (most recent data)
        const progressDocRef = doc(db, 'userProgress', `${user.uid}_${quizId}`);
        const progressDoc = await getDoc(progressDocRef);
        
        console.log('Progress doc exists:', progressDoc.exists());
        
        if (progressDoc.exists()) {
          const progressData = progressDoc.data();
          console.log('Progress data:', progressData);
          
          // Check if quiz is completed
          if (progressData.status === 'completed') {
            setResults({
              score: progressData.finalScore || progressData.score || 0,
              totalQuestions: progressData.totalQuestions || 0,
              percentageScore: progressData.percentageScore || Math.round(((progressData.finalScore || progressData.score || 0) / (progressData.totalQuestions || 1)) * 100),
              timeTaken: progressData.timeTaken || 0, // Use stored timeTaken directly
              answers: progressData.answers || [],
              status: progressData.status || 'completed'
            });
            console.log('Results set from progress data');
            return;
          } else {
            console.log('Quiz not completed yet, status:', progressData.status);
            setError('Quiz not completed yet. Please finish the quiz first.');
            return;
          }
        }
        
        // If no progress data, try quizResults collection
        console.log('No progress data found, checking quizResults...');
        // Note: We would need to query by userId and quizId since results have timestamps
        setError('Quiz results not found. Please complete the quiz first.');
        
      } catch (err) {
        console.error('Error fetching results:', err);
        setError('Failed to load quiz results: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [user, quizId]);

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const getScoreColor = (percentage) => {
    if (percentage >= 90) return '#4caf50'; // Green
    if (percentage >= 70) return '#ff9800'; // Orange
    return '#f44336'; // Red
  };

  const getScoreEmoji = (percentage) => {
    if (percentage >= 90) return '🎉';
    if (percentage >= 70) return '👍';
    return '📚';
  };

  const getPerformanceMessage = (percentage) => {
    if (percentage >= 90) return 'Excellent work!';
    if (percentage >= 80) return 'Great job!';
    if (percentage >= 70) return 'Good effort!';
    if (percentage >= 60) return 'Keep practicing!';
    return 'Don\'t give up, try again!';
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading your results...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>{error}</div>
        <button style={styles.dashboardBtn} onClick={() => navigate(`/${userId}/dashboard`)}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.resultsCard}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logo}>algoed</div>
          <div style={styles.quizTitle}>{quiz?.name || 'Quiz Complete'}</div>
        </div>

        {/* Score Section */}
        <div style={styles.scoreSection}>
          <div style={styles.scoreEmoji}>{getScoreEmoji(results?.percentageScore || 0)}</div>
          <div style={{...styles.scoreNumber, color: getScoreColor(results?.percentageScore || 0)}}>
            {results?.percentageScore || 0}%
          </div>
          <div style={styles.scoreMessage}>
            {getPerformanceMessage(results?.percentageScore || 0)}
          </div>
          <div style={styles.scoreDetails}>
            You got {results?.score || 0} out of {results?.totalQuestions || 0} questions correct
          </div>
        </div>

        {/* Stats Section */}
        <div style={styles.statsSection}>
          <div style={styles.statCard}>
            <div style={styles.statIcon}>⏱️</div>
            <div style={styles.statLabel}>Time Taken</div>
            <div style={styles.statValue}>{formatTime(results?.timeTaken || 0)}</div>
          </div>
          
          <div style={styles.statCard}>
            <div style={styles.statIcon}>🎯</div>
            <div style={styles.statLabel}>Accuracy</div>
            <div style={styles.statValue}>{results?.percentageScore || 0}%</div>
          </div>
          
          <div style={styles.statCard}>
            <div style={styles.statIcon}>📊</div>
            <div style={styles.statLabel}>Questions</div>
            <div style={styles.statValue}>{results?.score || 0}/{results?.totalQuestions || 0}</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={styles.actionSection}>
          <button 
            style={styles.dashboardBtn} 
            onClick={() => navigate(`/${userId}/dashboard`)}
          >
            Back to Dashboard
          </button>
          <button 
            style={styles.retakeBtn} 
            onClick={() => navigate(`/${userId}/quiz/${quizId}`)}
          >
            Retake Quiz
          </button>
        </div>

        {/* Additional Info */}
        <div style={styles.additionalInfo}>
          <p style={styles.infoText}>
            Quiz completed on {new Date().toLocaleDateString()}
          </p>
          <p style={styles.infoText}>
            Category: {quiz?.category || 'Unknown'}
          </p>
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
    background: '#f5f6fa',
    fontFamily: 'Inter, Arial, sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    margin: 0,
    padding: '1rem',
  },
  resultsCard: {
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
    padding: '3rem 2.5rem',
    width: '100%',
    maxWidth: '600px',
    textAlign: 'center',
    boxSizing: 'border-box',
  },
  header: {
    marginBottom: '2rem',
  },
  logo: {
    fontWeight: 800,
    fontSize: 24,
    color: '#3f51b5',
    letterSpacing: 2,
    marginBottom: '0.5rem',
  },
  quizTitle: {
    fontSize: 20,
    fontWeight: 600,
    color: '#222',
  },
  scoreSection: {
    marginBottom: '3rem',
    padding: '2rem 0',
    borderRadius: 12,
    background: 'linear-gradient(135deg, #f8f9ff 0%, #e8f0ff 100%)',
  },
  scoreEmoji: {
    fontSize: '4rem',
    marginBottom: '1rem',
  },
  scoreNumber: {
    fontSize: '4rem',
    fontWeight: 800,
    marginBottom: '0.5rem',
  },
  scoreMessage: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: '#222',
    marginBottom: '0.5rem',
  },
  scoreDetails: {
    fontSize: '1rem',
    color: '#666',
  },
  statsSection: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '1rem',
    marginBottom: '3rem',
  },
  statCard: {
    background: '#f8f9fa',
    borderRadius: 12,
    padding: '1.5rem 1rem',
    border: '1px solid #e9ecef',
  },
  statIcon: {
    fontSize: '2rem',
    marginBottom: '0.5rem',
  },
  statLabel: {
    fontSize: '0.875rem',
    color: '#666',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '0.5rem',
  },
  statValue: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#3f51b5',
  },
  actionSection: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'center',
    marginBottom: '2rem',
    flexWrap: 'wrap',
  },
  dashboardBtn: {
    background: '#3f51b5',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '0.75rem 2rem',
    fontWeight: 600,
    fontSize: '1rem',
    cursor: 'pointer',
    transition: 'background 0.2s ease',
  },
  retakeBtn: {
    background: '#fff',
    color: '#3f51b5',
    border: '2px solid #3f51b5',
    borderRadius: 8,
    padding: '0.75rem 2rem',
    fontWeight: 600,
    fontSize: '1rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  additionalInfo: {
    paddingTop: '2rem',
    borderTop: '1px solid #e9ecef',
  },
  infoText: {
    fontSize: '0.875rem',
    color: '#666',
    margin: '0.25rem 0',
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
    marginBottom: '1rem',
  },
};

export default QuizResultsPage; 