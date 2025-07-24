import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

const AdminLoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Responsive logo size based on window width
  const getLogoSize = () => {
    if (window.innerWidth < 400) return 24;
    if (window.innerWidth < 600) return 32;
    if (window.innerWidth < 900) return 40;
    return 48;
  };
  const [logoSize, setLogoSize] = useState(getLogoSize());

  React.useEffect(() => {
    const handleResize = () => setLogoSize(getLogoSize());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      if (!userCredential.user.emailVerified) {
        setError('Please verify your email before logging in.');
        setLoading(false);
        return;
      }
      // Optionally check if user is an admin (by email or custom claim)
      navigate('/admin-dashboard'); // Change to your admin dashboard
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={{ ...styles.logo, fontSize: logoSize }}>
          <span style={styles.logoGradient}>al</span>
          <span style={styles.logoRed}>go</span>
          <span style={styles.logoBlue}>ed</span>
        </div>
        <div style={styles.adminBadge}>Admin</div>
        <h2 style={styles.title}>Admin Sign In</h2>
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label} htmlFor="email">Email Address</label>
          <input
            style={styles.input}
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <label style={styles.label} htmlFor="password">Password</label>
          <input
            style={styles.input}
            id="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {error && <div style={styles.error}>{error}</div>}
          <button type="submit" style={styles.button} disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</button>
        </form>
        <div style={styles.loginText}>
          Don't have an account? <Link to="/admin-register" style={styles.loginLink}>Register</Link>
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f5f6fa',
    boxSizing: 'border-box',
    margin: 0,
    padding: 0,
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    padding: '2.5rem 2rem',
    width: '100%',
    maxWidth: 370,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  logo: {
    fontWeight: 800,
    marginBottom: 8,
    transition: 'font-size 0.2s',
    lineHeight: 1.1,
    textAlign: 'center',
    width: '100%',
    wordBreak: 'break-word',
    letterSpacing: 2,
    userSelect: 'none',
    fontFamily: 'Montserrat, Inter, Arial, sans-serif',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 0,
  },
  logoGradient: {
    background: 'linear-gradient(90deg, #3f51b5 0%, #2196f3 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    fontWeight: 800,
  },
  logoRed: {
    color: '#e53935',
    fontWeight: 800,
  },
  logoBlue: {
    color: '#3f51b5',
    fontWeight: 800,
  },
  adminBadge: {
    background: 'linear-gradient(90deg, #e53935 0%, #3f51b5 100%)',
    color: '#fff',
    fontWeight: 700,
    fontSize: 13,
    borderRadius: 8,
    padding: '2px 12px',
    marginBottom: 10,
    letterSpacing: 1,
    alignSelf: 'center',
    boxShadow: '0 1px 4px rgba(63,81,181,0.08)',
    userSelect: 'none',
  },
  title: {
    fontWeight: 600,
    fontSize: 20,
    marginBottom: 24,
    color: '#222',
    textAlign: 'center',
  },
  form: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  label: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  input: {
    padding: '10px 12px',
    borderRadius: 6,
    border: '1px solid #ccc',
    fontSize: 16,
    marginBottom: 8,
    background: '#f2f3f7',
    color: '#222',
    transition: 'background 0.2s',
    boxSizing: 'border-box',
  },
  button: {
    background: 'linear-gradient(90deg, #e53935 0%, #3f51b5 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '10px 0',
    fontWeight: 600,
    fontSize: 16,
    cursor: 'pointer',
    marginTop: 8,
    boxShadow: '0 2px 8px rgba(63,81,181,0.08)',
  },
  error: {
    color: '#e53935',
    fontSize: 14,
    marginBottom: 8,
    marginTop: 4,
  },
  loginText: {
    fontSize: 14,
    color: '#555',
    marginTop: 15,
    textAlign: 'center',
  },
  loginLink: {
    color: '#3f51b5',
    textDecoration: 'none',
    fontWeight: 600,
  },
};

export default AdminLoginPage; 