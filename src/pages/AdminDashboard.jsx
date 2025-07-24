import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

const AdminDashboard = () => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Get unique categories from quizzes
  const categories = ['All', ...new Set(quizzes.map(quiz => quiz.category))];

  useEffect(() => {
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

    fetchQuizzes();
  }, []);

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
          <button style={styles.createBtn} onClick={() => navigate('/admin-dashboard/quiz/new')}>
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
              <div key={quiz.id} style={styles.card} onClick={() => navigate(`/admin-dashboard/quiz/${quiz.id}`)}>
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
                  <button style={styles.actionBtn} onClick={(e) => { e.stopPropagation(); /* TODO: Edit functionality */ }}>Edit</button>
                  <button style={styles.actionBtn} onClick={(e) => { e.stopPropagation(); navigate(`/admin-dashboard/quiz/${quiz.id}/live`); }}>Stats/Live</button>
                  {quiz.status === 'Published' ? (
                    <button style={styles.actionBtn} onClick={(e) => { e.stopPropagation(); /* TODO: Unpublish functionality */ }}>Unpublish</button>
                  ) : (
                    <button style={styles.actionBtn} onClick={(e) => { e.stopPropagation(); /* TODO: Publish functionality */ }}>Publish</button>
                  )}
                  <button style={{ ...styles.actionBtn, color: '#e53935' }} onClick={(e) => { e.stopPropagation(); /* TODO: Delete functionality */ }}>Delete</button>
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
    minHeight: 180,
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
    gap: 10,
    marginTop: 8,
  },
  actionBtn: {
    background: '#f2f3f7',
    color: '#3f51b5',
    border: 'none',
    borderRadius: 6,
    padding: '7px 14px',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
    transition: 'background 0.2s',
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