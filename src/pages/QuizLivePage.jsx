import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, onSnapshot, addDoc, deleteDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const QuizLivePage = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [activeUsers, setActiveUsers] = useState([]);
  const [quizStats, setQuizStats] = useState({
    totalParticipants: 0,
    averageScore: 0,
    completionRate: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const quizDoc = await getDoc(doc(db, 'quizzes', quizId));
        if (quizDoc.exists()) {
          setQuiz({ id: quizDoc.id, ...quizDoc.data() });
        } else {
          setError('Quiz not found');
        }
      } catch (err) {
        console.error('Error fetching quiz:', err);
        setError('Failed to load quiz');
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [quizId]);

  // Real-time listener for active users
  useEffect(() => {
    if (!quizId) return;

    const q = query(
      collection(db, 'activeUsers'), 
      where('quizId', '==', quizId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        joinedAt: doc.data().joinedAt?.toDate?.()?.toLocaleTimeString?.() || 'Unknown',
        timeElapsed: doc.data().joinedAt ? Math.floor((Date.now() - doc.data().joinedAt.toDate()) / 1000) : 0
      }));
      setActiveUsers(users);
      console.log('Active users updated:', users);
    }, (err) => {
      console.error('Error listening to active users:', err);
    });

    return () => unsubscribe();
  }, [quizId]);

  // Simulate a user joining (for testing purposes)
  const simulateUserJoin = async () => {
    try {
      await addDoc(collection(db, 'activeUsers'), {
        quizId,
        userId: `user_${Date.now()}`,
        userName: `User ${Math.floor(Math.random() * 1000)}`,
        joinedAt: serverTimestamp(),
        status: 'active',
        currentQuestion: Math.floor(Math.random() * (quiz?.questions?.length || 5)) + 1,
        score: Math.floor(Math.random() * 100)
      });
    } catch (err) {
      console.error('Error adding test user:', err);
    }
  };

  // Remove all active users (for testing purposes)
  const clearActiveUsers = async () => {
    try {
      const q = query(collection(db, 'activeUsers'), where('quizId', '==', quizId));
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
    } catch (err) {
      console.error('Error clearing active users:', err);
    }
  };

  const formatTimeElapsed = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div style={styles.outer}>
        <div style={styles.container}>
          <div style={styles.loading}>Loading live quiz data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.outer}>
        <div style={styles.container}>
          <div style={styles.error}>{error}</div>
          <button style={styles.backBtn} onClick={() => navigate('/admin-dashboard')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.outer}>
      <div style={styles.container}>
        <header style={styles.header}>
          <button style={styles.backBtn} onClick={() => navigate('/admin-dashboard')}>
            ← Back to Dashboard
          </button>
          <div style={styles.titleSection}>
            <h1 style={styles.title}>{quiz.name}</h1>
            <span style={styles.liveIndicator}>● LIVE</span>
          </div>
          <button style={styles.detailBtn} onClick={() => navigate(`/admin-dashboard/quiz/${quizId}`)}>
            View Details
          </button>
        </header>

        <div style={styles.content}>
          {/* Live Stats Section */}
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>{activeUsers.length}</div>
              <div style={styles.statLabel}>Active Users</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>{quiz?.questions?.length || 0}</div>
              <div style={styles.statLabel}>Total Questions</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>
                {activeUsers.length > 0 ? Math.round(activeUsers.reduce((sum, user) => sum + (user.score || 0), 0) / activeUsers.length) : 0}%
              </div>
              <div style={styles.statLabel}>Avg Score</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statNumber}>
                {quiz.status === 'Published' ? 'Live' : 'Offline'}
              </div>
              <div style={styles.statLabel}>Status</div>
            </div>
          </div>

          {/* Active Users Section */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Active Participants ({activeUsers.length})</h2>
              <div style={styles.testButtons}>
                <button style={styles.testBtn} onClick={simulateUserJoin}>
                  + Add Test User
                </button>
                <button style={styles.testBtn} onClick={clearActiveUsers}>
                  Clear All
                </button>
              </div>
            </div>
            {activeUsers.length === 0 ? (
              <div style={styles.empty}>
                {quiz.status === 'Published' 
                  ? 'No users currently taking this quiz. Share the quiz link to get participants!' 
                  : 'Quiz is not published. Publish it to allow users to participate.'}
              </div>
            ) : (
              <div style={styles.usersGrid}>
                {activeUsers.map(user => (
                  <div key={user.id} style={styles.userCard}>
                    <div style={styles.userHeader}>
                      <div style={styles.userInfo}>
                        <span style={styles.userName}>{user.userName}</span>
                        <span style={styles.userTime}>
                          Time: {formatTimeElapsed(user.timeElapsed)}
                        </span>
                      </div>
                      <div style={styles.userStatus}>
                        <span style={{
                          ...styles.activeIndicator,
                          color: user.connectionStatus === 'stable' ? '#4caf50' : 
                                user.connectionStatus === 'unstable' ? '#ff9800' : 
                                user.connectionStatus === 'reconnected' ? '#2196f3' : '#4caf50'
                        }}>●</span>
                        <span style={{
                          color: user.connectionStatus === 'stable' ? '#4caf50' : 
                                user.connectionStatus === 'unstable' ? '#ff9800' : 
                                user.connectionStatus === 'reconnected' ? '#2196f3' : '#4caf50'
                        }}>
                          {user.connectionStatus === 'stable' ? 'Stable' :
                           user.connectionStatus === 'unstable' ? 'Unstable' :
                           user.connectionStatus === 'reconnected' ? 'Reconnected' : 'Active'}
                        </span>
                        {user.missedHeartbeats > 0 && (
                          <span style={styles.missedHeartbeats}>
                            ({user.missedHeartbeats}/3)
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={styles.userProgress}>
                      <div style={styles.progressInfo}>
                        <span>Question {user.currentQuestion || 1} of {quiz?.questions?.length || 0}</span>
                        <span>Score: {user.score || 0}%</span>
                      </div>
                      <div style={styles.progressBar}>
                        <div 
                          style={{
                            ...styles.progressFill,
                            width: `${((user.currentQuestion || 1) / (quiz?.questions?.length || 1)) * 100}%`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quiz Info Section */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Quiz Information</h2>
            <div style={styles.infoGrid}>
              <div style={styles.infoItem}>
                <span style={styles.label}>Category:</span>
                <span style={styles.value}>{quiz.category}</span>
              </div>
              <div style={styles.infoItem}>
                <span style={styles.label}>Status:</span>
                <span style={{
                  ...styles.statusBadge,
                  background: quiz.status === 'Published' ? '#4caf50' : '#aaa'
                }}>{quiz.status}</span>
              </div>
              <div style={styles.infoItem}>
                <span style={styles.label}>Created:</span>
                <span style={styles.value}>
                  {quiz.createdAt?.toDate?.()?.toLocaleDateString?.() || 'Unknown'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  outer: {
    minHeight: '100vh',
    width: '100vw',
    background: '#f5f6fa',
    padding: '2rem 1rem',
    boxSizing: 'border-box',
  },
  container: {
    maxWidth: 1200,
    margin: '0 auto',
    fontFamily: 'Inter, Arial, sans-serif',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '2rem',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  titleSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    flex: 1,
    justifyContent: 'center',
  },
  backBtn: {
    background: '#fff',
    color: '#3f51b5',
    border: '1px solid #3f51b5',
    borderRadius: 6,
    padding: '8px 16px',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
  },
  detailBtn: {
    background: '#3f51b5',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 16px',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: '#3f51b5',
    margin: 0,
  },
  liveIndicator: {
    background: '#e53935',
    color: '#fff',
    fontSize: 12,
    fontWeight: 700,
    padding: '4px 8px',
    borderRadius: 4,
    animation: 'pulse 2s infinite',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
  },
  statCard: {
    background: '#fff',
    borderRadius: 12,
    padding: '1.5rem',
    textAlign: 'center',
    boxShadow: '0 2px 12px rgba(63,81,181,0.08)',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 700,
    color: '#3f51b5',
    marginBottom: '0.5rem',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  section: {
    background: '#fff',
    borderRadius: 12,
    padding: '1.5rem',
    boxShadow: '0 2px 12px rgba(63,81,181,0.08)',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 600,
    color: '#222',
    margin: 0,
  },
  testButtons: {
    display: 'flex',
    gap: '0.5rem',
  },
  testBtn: {
    background: '#f2f3f7',
    color: '#3f51b5',
    border: 'none',
    borderRadius: 6,
    padding: '6px 12px',
    fontWeight: 600,
    fontSize: 12,
    cursor: 'pointer',
  },
  usersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '1rem',
  },
  userCard: {
    padding: '1rem',
    background: '#f8f9fa',
    borderRadius: 8,
    border: '1px solid #e9ecef',
  },
  userHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '0.75rem',
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  userName: {
    fontWeight: 600,
    color: '#222',
    fontSize: 16,
  },
  userTime: {
    fontSize: 12,
    color: '#666',
  },
  userStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    color: '#4caf50',
    fontSize: 12,
    fontWeight: 600,
  },
  activeIndicator: {
    color: '#4caf50',
    fontSize: 12,
  },
  userProgress: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  progressInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 12,
    color: '#666',
    fontWeight: 600,
  },
  progressBar: {
    height: 8,
    background: '#e9ecef',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: '#4caf50',
    borderRadius: 4,
    transition: 'width 0.3s ease',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
  },
  infoItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  label: {
    fontSize: 14,
    color: '#666',
    fontWeight: 600,
  },
  value: {
    fontSize: 16,
    color: '#222',
    fontWeight: 500,
  },
  statusBadge: {
    color: '#fff',
    fontWeight: 600,
    fontSize: 14,
    borderRadius: 6,
    padding: '4px 12px',
    alignSelf: 'flex-start',
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
  empty: {
    textAlign: 'center',
    color: '#888',
    fontSize: 16,
    padding: '2rem 0',
    background: '#f8f9fa',
    borderRadius: 8,
    border: '1px dashed #ddd',
  },
  missedHeartbeats: {
    color: '#ff9800',
    fontSize: 12,
    fontWeight: 600,
  },
};

export default QuizLivePage; 