import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth } from '../firebase';

const UserRegisterPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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
    setSuccess('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(userCredential.user);
      setSuccess('Registration successful! Please check your email to verify your account.');
      setTimeout(() => navigate('/login'), 2000);
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
        <h2 style={styles.title}>Create your account</h2>
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
            autoComplete="new-password"
          />
          <label style={styles.label} htmlFor="confirmPassword">Confirm Password</label>
          <input
            style={styles.input}
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          {error && <div style={styles.error}>{error}</div>}
          {success && <div style={styles.success}>{success}</div>}
          <button type="submit" style={styles.button} disabled={loading}>{loading ? 'Registering...' : 'Register'}</button>
        </form>
        <div style={styles.loginText}>
          Already have an account? <Link to="/login" style={styles.loginLink}>Sign in</Link>
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
    marginBottom: 16,
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
    background: '#3f51b5',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '10px 0',
    fontWeight: 600,
    fontSize: 16,
    cursor: 'pointer',
    marginTop: 8,
  },
  divider: {
    margin: '18px 0 10px 0',
    color: '#aaa',
    fontSize: 14,
  },
  googleButton: {
    background: '#fff',
    color: '#222',
    border: '1px solid #ccc',
    borderRadius: 6,
    padding: '10px 0',
    fontWeight: 500,
    fontSize: 16,
    cursor: 'pointer',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  googleIcon: {
    fontWeight: 700,
    fontSize: 18,
    color: '#ea4335',
    marginRight: 6,
  },
  error: {
    color: '#e53935',
    fontSize: 14,
    marginBottom: 8,
    marginTop: 4,
  },
  success: {
    color: '#4caf50',
    fontSize: 14,
    marginBottom: 8,
    marginTop: 4,
  },
  loginText: {
    marginTop: 10,
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
  },
  loginLink: {
    color: '#3f51b5',
    textDecoration: 'none',
    fontWeight: 500,
    marginLeft: 4,
  },
};

export default UserRegisterPage; 