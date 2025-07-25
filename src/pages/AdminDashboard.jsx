import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import LiveQuizManager from '../utils/liveQuizManager';

const AdminDashboard = () => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [liveQuizManager] = useState(() => new LiveQuizManager());
  const navigate = useNavigate();

  // Get unique categories from quizzes
  const categories = ['All', ...new Set(quizzes.map(quiz => quiz.category))];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        fetchQuizzes();
      } else {
        navigate('/admin-login');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const fetchQuizzes = async () => {
    try {
      const q = query(collection(db, 'quizzes'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const quizzesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Format the createdAt timestamp for display
        created: doc.data().createdAt?.toDate?.()?.toLocaleDateString?.() || 'Unknown'
      }));
      setQuizzes(quizzesData);
      console.log('Fetched quizzes:', quizzesData);
    } catch (err) {
      console.error('Error fetching quizzes:', err);
      setError('Failed to load quizzes');
    } finally {
      setLoading(false);
    }
  };

  const handleStartLiveQuiz = async (quiz) => {
    if (!user) {
      alert('Please log in to start a live quiz');
      return;
    }

    if (quiz.status !== 'Published') {
      alert('Quiz must be published before starting a live session');
      return;
    }

    try {
      console.log('Starting live quiz for:', quiz.name);
      
      const result = await liveQuizManager.createLiveSession(
        quiz.id, 
        user.uid, 
        user.displayName || user.email?.split('@')[0] || 'Admin',
        {
          questionTimeLimit: 30,
          showAnswersAfterEach: true,
          allowLateJoin: false
        }
      );

      if (result.success) {
        console.log('Live session created successfully:', result);
        alert(`Live quiz started! Session code: ${result.sessionCode}`);
        
        // Navigate to live quiz management page in new tab
        window.open(`/admin-dashboard/live-session/${result.sessionId}`, '_blank');
      } else {
        console.error('Failed to create live session:', result.error);
        alert(`Failed to start live quiz: ${result.error}`);
      }
    } catch (error) {
      console.error('Error starting live quiz:', error);
      alert('Failed to start live quiz. Please try again.');
    }
  };

  const filteredQuizzes = selectedCategory === 'All'
    ? quizzes
    : quizzes.filter(q => q.category === selectedCategory);

  if (loading) {
    return (
      <div style={styles.outer}>
        <div style={styles.container}>
          <div style={styles.loading}>Loading quizzes...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.outer}>
        <div style={styles.container}>
          <div style={styles.error}>{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.outer}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.logo}>algoed <span style={styles.adminBadge}>Admin Dashboard</span></div>
          <button style={styles.logout}>Logout</button>
        </header>
        <div style={styles.createRow}>
          <button style={styles.createBtn} onClick={() => window.open('/admin-dashboard/quiz/new', '_blank')}>
            + Create New Quiz
          </button>
        </div>
        <div style={styles.categoryTabs}>
          {categories.map(cat => (
            <button
              key={cat}
              style={{
                ...styles.tab,
                ...(selectedCategory === cat ? styles.activeTab : {})
              }}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
        <div style={styles.grid}>
          {filteredQuizzes.length === 0 ? (
            <div style={styles.empty}>
              {quizzes.length === 0 ? 'No quizzes created yet.' : 'No quizzes in this category.'}
            </div>
          ) : (
            filteredQuizzes.map(quiz => (
              <div key={quiz.id} style={styles.card} onClick={() => window.open(`/admin-dashboard/quiz/${quiz.id}`, '_blank')}>
                <div style={styles.cardHeader}>
                  <span style={styles.quizTitle}>{quiz.name}</span>
                  <span style={{
                    ...styles.statusBadge,
                    background: quiz.status === 'Published' ? '#4caf50' : '#aaa'
                  }}>{quiz.status}</span>
                </div>
                <div style={styles.cardInfo}>
                  <span>Questions: {quiz.questions?.length || 0}</span>
                  <span>Created: {quiz.created}</span>
                </div>
                <div style={styles.cardActions}>
                  <button 
                    style={{...styles.actionBtn, backgroundColor: '#4caf50', color: '#fff', flex: 1}} 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      handleStartLiveQuiz(quiz); 
                    }}
                  >
                    Start Live Quiz
                  </button>
                </div>
              </div>
            ))
          )}
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
    padding: 0,
  },
  container: {
    width: '100%',
    maxWidth: 1200,
    padding: '2rem 1rem',
    fontFamily: 'Inter, Arial, sans-serif',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  header: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  logo: {
    fontWeight: 800,
    fontSize: 28,
    color: '#3f51b5',
    letterSpacing: 2,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  adminBadge: {
    background: 'linear-gradient(90deg, #e53935 0%, #3f51b5 100%)',
    color: '#fff',
    fontWeight: 700,
    fontSize: 14,
    borderRadius: 8,
    padding: '2px 12px',
    marginLeft: 8,
    letterSpacing: 1,
    userSelect: 'none',
  },
  logout: {
    background: '#fff',
    color: '#3f51b5',
    border: '1px solid #3f51b5',
    borderRadius: 6,
    padding: '8px 18px',
    fontWeight: 600,
    fontSize: 15,
    cursor: 'pointer',
  },
  createRow: {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 18,
  },
  createBtn: {
    background: '#3f51b5',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '10px 22px',
    fontWeight: 700,
    fontSize: 16,
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(63,81,181,0.08)',
  },
  categoryTabs: {
    display: 'flex',
    gap: 10,
    marginBottom: 18,
    width: '100%',
    justifyContent: 'center',
  },
  tab: {
    background: '#f2f3f7',
    color: '#3f51b5',
    border: 'none',
    borderRadius: 6,
    padding: '8px 18px',
    fontWeight: 600,
    fontSize: 15,
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  activeTab: {
    background: '#3f51b5',
    color: '#fff',
  },
  grid: {
    width: '100%',
    maxWidth: 1100,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 24,
  },
  card: {
    background: '#fff',
    borderRadius: 14,
    boxShadow: '0 2px 12px rgba(63,81,181,0.08)',
    padding: '1.5rem 1.2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    minHeight: 200,
    width: '100%',
    boxSizing: 'border-box',
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 20px rgba(63,81,181,0.12)',
    },
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  quizTitle: {
    fontWeight: 700,
    fontSize: 18,
    color: '#222',
  },
  statusBadge: {
    color: '#fff',
    fontWeight: 600,
    fontSize: 13,
    borderRadius: 8,
    padding: '2px 10px',
    marginLeft: 8,
    userSelect: 'none',
  },
  cardInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
  },
  cardActions: {
    display: 'flex',
    gap: 6,
    marginTop: 8,
    flexWrap: 'nowrap',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionBtn: {
    background: '#f2f3f7',
    color: '#3f51b5',
    border: 'none',
    borderRadius: 4,
    padding: '4px 8px',
    fontWeight: 600,
    fontSize: 11,
    cursor: 'pointer',
    transition: 'background 0.2s',
    whiteSpace: 'nowrap',
    flex: 1,
    textAlign: 'center',
    minWidth: 0,
  },
  empty: {
    gridColumn: '1/-1',
    textAlign: 'center',
    color: '#888',
    fontSize: 18,
    padding: '2rem 0',
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

export default AdminDashboard; 