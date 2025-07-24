import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const QuizDetailPage = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);

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

  const handleStatusToggle = async () => {
    if (!quiz) return;
    setUpdating(true);
    try {
      const newStatus = quiz.status === 'Published' ? 'Unpublished' : 'Published';
      await updateDoc(doc(db, 'quizzes', quizId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      setQuiz({ ...quiz, status: newStatus });
    } catch (err) {
      console.error('Error updating quiz status:', err);
      alert('Failed to update quiz status');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.outer}>
        <div style={styles.container}>
          <div style={styles.loading}>Loading quiz details...</div>
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
          <h1 style={styles.title}>{quiz.name}</h1>
          <button style={styles.liveBtn} onClick={() => navigate(`/admin-dashboard/quiz/${quizId}/live`)}>
            View Live Stats
          </button>
        </header>

        <div style={styles.content}>
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
                <span style={styles.label}>Questions:</span>
                <span style={styles.value}>{quiz.questions?.length || 0}</span>
              </div>
              <div style={styles.infoItem}>
                <span style={styles.label}>Created:</span>
                <span style={styles.value}>
                  {quiz.createdAt?.toDate?.()?.toLocaleDateString?.() || 'Unknown'}
                </span>
              </div>
            </div>
            <div style={styles.actionRow}>
              <button 
                style={styles.statusBtn} 
                onClick={handleStatusToggle}
                disabled={updating}
              >
                {updating ? 'Updating...' : `${quiz.status === 'Published' ? 'Unpublish' : 'Publish'} Quiz`}
              </button>
            </div>
          </div>

          {/* Questions Preview Section */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Questions Preview</h2>
            {quiz.questions && quiz.questions.length > 0 ? (
              <div style={styles.questionsGrid}>
                {quiz.questions.map((question, index) => (
                  <div key={index} style={styles.questionCard}>
                    <div style={styles.questionNumber}>Q{index + 1}</div>
                    <div style={styles.questionText}>{question.question}</div>
                    <div style={styles.choices}>
                      {question.choices?.map((choice, choiceIndex) => (
                        <div 
                          key={choiceIndex} 
                          style={{
                            ...styles.choice,
                            ...(choice === question.answer ? styles.correctChoice : {})
                          }}
                        >
                          {choice}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={styles.empty}>No questions available</div>
            )}
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
    maxWidth: 1000,
    margin: '0 auto',
    fontFamily: 'Inter, Arial, sans-serif',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    marginBottom: '2rem',
    flexWrap: 'wrap',
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
  liveBtn: {
    background: '#e53935',
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
    flex: 1,
    textAlign: 'center',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem',
  },
  section: {
    background: '#fff',
    borderRadius: 12,
    padding: '1.5rem',
    boxShadow: '0 2px 12px rgba(63,81,181,0.08)',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 600,
    color: '#222',
    margin: '0 0 1rem 0',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
    marginBottom: '1rem',
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
  actionRow: {
    display: 'flex',
    gap: '1rem',
    marginTop: '1rem',
  },
  statusBtn: {
    background: '#3f51b5',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '10px 20px',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
  },
  questionsGrid: {
    display: 'grid',
    gap: '1rem',
  },
  questionCard: {
    border: '1px solid #e9ecef',
    borderRadius: 8,
    padding: '1rem',
    background: '#f8f9fa',
  },
  questionNumber: {
    fontSize: 14,
    fontWeight: 700,
    color: '#3f51b5',
    marginBottom: '0.5rem',
  },
  questionText: {
    fontSize: 16,
    color: '#222',
    marginBottom: '0.75rem',
    fontWeight: 500,
  },
  choices: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  choice: {
    padding: '0.5rem',
    background: '#fff',
    border: '1px solid #ddd',
    borderRadius: 4,
    fontSize: 14,
    color: '#222',
  },
  correctChoice: {
    background: '#e8f5e8',
    borderColor: '#4caf50',
    fontWeight: 600,
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
  },
};

export default QuizDetailPage; 