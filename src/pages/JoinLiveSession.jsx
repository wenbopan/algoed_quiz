import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import LiveQuizManager from '../utils/liveQuizManager';

const JoinLiveSession = () => {
  const navigate = useNavigate();
  
  const [user, setUser] = useState(null);
  const [sessionCode, setSessionCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [liveQuizManager] = useState(() => new LiveQuizManager());

  // Auth check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        navigate('/login');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleJoinSession = async (e) => {
    e.preventDefault();
    
    if (!sessionCode.trim()) {
      setError('Please enter a session code');
      return;
    }

    if (!user) {
      setError('Please log in to join a session');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('Attempting to join session:', sessionCode.toUpperCase());
      
      const result = await liveQuizManager.joinSession(
        sessionCode.toUpperCase().trim(),
        user.uid,
        user.displayName || user.email?.split('@')[0] || 'Anonymous'
      );

      if (result.success) {
        console.log('Successfully joined session:', result.sessionId);
        
        if (result.alreadyJoined) {
          console.log('User was already in session, redirecting back');
          // Optional: Show a brief message before redirecting
          // You could add a toast notification here if desired
        }
        
        // Navigate to live quiz waiting room/interface
        navigate(`/${user.uid}/live-quiz/${result.sessionId}`);
      } else {
        console.error('Failed to join session:', result.error);
        setError(result.error);
      }
    } catch (error) {
      console.error('Error joining session:', error);
      setError('Failed to join session. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (e) => {
    // Convert to uppercase and limit to 6 characters
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 6);
    setSessionCode(value);
    setError(''); // Clear error when user types
  };

  if (!user) {
    return (
      <div style={styles.loading}>Checking authentication...</div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logo}>algoed</div>
          <button style={styles.backBtn} onClick={() => navigate(`/${user.uid}/dashboard`)}>
            ← Back to Dashboard
          </button>
        </div>

        {/* Join Form */}
        <div style={styles.joinCard}>
          <div style={styles.cardHeader}>
            <h1 style={styles.title}>🎮 Join Live Quiz</h1>
            <p style={styles.subtitle}>
              Enter the session code provided by your instructor to join the live quiz competition
            </p>
          </div>

          <form onSubmit={handleJoinSession} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Session Code</label>
              <input
                type="text"
                value={sessionCode}
                onChange={handleCodeChange}
                placeholder="Enter 6-digit code (e.g., A3F7G2)"
                style={styles.codeInput}
                maxLength={6}
                autoFocus
                disabled={loading}
              />
              <div style={styles.inputHint}>
                Session codes are 6 characters long and case-insensitive
              </div>
            </div>

            {error && (
              <div style={styles.error}>{error}</div>
            )}

            <button 
              type="submit" 
              style={{
                ...styles.joinBtn,
                ...(loading || !sessionCode.trim() ? styles.joinBtnDisabled : {})
              }}
              disabled={loading || !sessionCode.trim()}
            >
              {loading ? 'Joining...' : 'Join Session'}
            </button>
          </form>

          {/* Instructions */}
          <div style={styles.instructions}>
            <h3 style={styles.instructionsTitle}>How it works:</h3>
            <ul style={styles.instructionsList}>
              <li>Get the session code from your instructor</li>
              <li>Enter the code above to join the live quiz</li>
              <li>Wait in the lobby until the quiz starts</li>
              <li>Answer questions in real-time with other participants</li>
              <li>Compete for the top spot on the leaderboard!</li>
            </ul>
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
    backgroundColor: '#f5f6fa',
    fontFamily: 'Inter, Arial, sans-serif',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'clamp(1rem, 3vw, 2rem)',
    boxSizing: 'border-box',
  },
  content: {
    width: '100%',
    maxWidth: '500px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1.5rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  logo: {
    fontWeight: 800,
    fontSize: 'clamp(20px, 4vw, 24px)',
    color: '#3f51b5',
    letterSpacing: 2,
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
  joinCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 'clamp(2rem, 5vw, 2.5rem)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
    textAlign: 'center',
    width: '100%',
    boxSizing: 'border-box',
  },
  cardHeader: {
    marginBottom: '2rem',
  },
  title: {
    margin: 0,
    marginBottom: '0.5rem',
    fontSize: 'clamp(24px, 5vw, 28px)',
    fontWeight: 700,
    color: '#222',
  },
  subtitle: {
    margin: 0,
    fontSize: 'clamp(14px, 2.5vw, 16px)',
    color: '#666',
    lineHeight: 1.5,
  },
  form: {
    marginBottom: '2rem',
    width: '100%',
  },
  inputGroup: {
    marginBottom: '1.5rem',
    textAlign: 'left',
  },
  label: {
    display: 'block',
    fontSize: 'clamp(12px, 2vw, 14px)',
    fontWeight: 600,
    color: '#333',
    marginBottom: '0.5rem',
  },
  codeInput: {
    width: '100%',
    padding: 'clamp(0.75rem, 2vw, 1rem)',
    border: '2px solid #e9ecef',
    borderRadius: 8,
    fontSize: 'clamp(18px, 4vw, 20px)',
    fontWeight: 600,
    textAlign: 'center',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    outline: 'none',
    transition: 'border-color 0.2s',
    fontFamily: 'monospace',
    boxSizing: 'border-box',
  },
  inputHint: {
    fontSize: 'clamp(10px, 1.8vw, 12px)',
    color: '#888',
    marginTop: '0.5rem',
    textAlign: 'center',
  },
  joinBtn: {
    width: '100%',
    backgroundColor: '#3f51b5',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: 'clamp(0.75rem, 2vw, 1rem) clamp(1.5rem, 4vw, 2rem)',
    fontSize: 'clamp(16px, 3vw, 18px)',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  joinBtnDisabled: {
    backgroundColor: '#ccc',
    cursor: 'not-allowed',
  },
  instructions: {
    textAlign: 'left',
    padding: 'clamp(1rem, 2.5vw, 1.5rem)',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    border: '1px solid #e9ecef',
    width: '100%',
    boxSizing: 'border-box',
  },
  instructionsTitle: {
    margin: 0,
    marginBottom: '1rem',
    fontSize: 'clamp(14px, 2.5vw, 16px)',
    fontWeight: 600,
    color: '#333',
  },
  instructionsList: {
    margin: 0,
    paddingLeft: '1.5rem',
    fontSize: 'clamp(12px, 2vw, 14px)',
    color: '#666',
    lineHeight: 1.6,
  },
  error: {
    backgroundColor: '#ffebee',
    color: '#c62828',
    padding: '0.75rem 1rem',
    borderRadius: 6,
    fontSize: 'clamp(12px, 2vw, 14px)',
    marginBottom: '1rem',
    border: '1px solid #ffcdd2',
  },
  loading: {
    minHeight: '100vh',
    minWidth: '100vw',
    width: '100vw',
    backgroundColor: '#f5f6fa',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    color: '#888',
    fontSize: 'clamp(16px, 3vw, 18px)',
    padding: '2rem 0',
    boxSizing: 'border-box',
  },
};

export default JoinLiveSession; 