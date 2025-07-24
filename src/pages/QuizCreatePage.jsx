import React, { useState, useRef } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const categories = ['Philosophy', 'Physics', 'Math'];

const QuizCreatePage = () => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [questions, setQuestions] = useState([]);
  const [fileError, setFileError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef();

  const handleFileChange = (e) => {
    setFileError('');
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        console.log('Parsed JSON:', json); // Debug log
        if (!Array.isArray(json)) throw new Error('JSON must be an array of questions');
        setQuestions(json);
        console.log('Questions set:', json.length, 'questions'); // Debug log
      } catch (err) {
        console.error('File parsing error:', err); // Debug log
        setFileError('Invalid JSON file.');
        setQuestions([]);
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (status) => {
    setLoading(true);
    setError('');
    setSuccess('');
    console.log('Submitting with:', { name, category, questionsCount: questions.length }); // Debug log
    if (!name || !category || questions.length === 0) {
      setError('Please fill all fields and upload a valid questions JSON.');
      setLoading(false);
      return;
    }
    try {
      await addDoc(collection(db, 'quizzes'), {
        name,
        category,
        status,
        createdAt: serverTimestamp(),
        questions,
      });
      setSuccess(`Quiz ${status === 'Published' ? 'published' : 'saved as draft'} successfully!`);
      setName('');
      setCategory(categories[0]);
      setQuestions([]);
      if (fileInputRef.current) fileInputRef.current.value = ''; // Reset file input
    } catch (err) {
      setError('Failed to save quiz: ' + err.message);
    }
    setLoading(false);
  };

  return (
    <div style={styles.outer}>
      <div style={styles.container}>
        <h2 style={styles.title}>Create New Quiz</h2>
        <form style={styles.form} onSubmit={e => e.preventDefault()}>
          <label style={styles.label}>Quiz Name</label>
          <input
            style={styles.input}
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
          <label style={styles.label}>Category</label>
          <select
            style={styles.input}
            value={category}
            onChange={e => setCategory(e.target.value)}
          >
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <label style={styles.label}>Upload Questions JSON</label>
          <input
            ref={fileInputRef}
            style={styles.input}
            type="file"
            accept="application/json"
            onChange={handleFileChange}
          />
          {fileError && <div style={styles.error}>{fileError}</div>}
          <div style={styles.fileInfo}>
            {questions.length > 0 && <span>{questions.length} questions loaded</span>}
          </div>
          {error && <div style={styles.error}>{error}</div>}
          {success && <div style={styles.success}>{success}</div>}
          <div style={styles.buttonRow}>
            <button
              style={styles.saveBtn}
              type="button"
              disabled={loading}
              onClick={() => handleSubmit('Unpublished')}
            >
              {loading ? 'Saving...' : 'Save as Draft'}
            </button>
            <button
              style={styles.publishBtn}
              type="button"
              disabled={loading}
              onClick={() => handleSubmit('Published')}
            >
              {loading ? 'Publishing...' : 'Publish'}
            </button>
          </div>
        </form>
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
    maxWidth: 480,
    width: '100%',
    background: '#fff',
    borderRadius: 14,
    boxShadow: '0 2px 12px rgba(63,81,181,0.08)',
    padding: '2.5rem 2rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  title: {
    fontWeight: 700,
    fontSize: 24,
    marginBottom: 24,
    color: '#3f51b5',
  },
  form: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  label: {
    fontSize: 15,
    color: '#555',
    marginBottom: 4,
    fontWeight: 600,
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
  fileInfo: {
    fontSize: 14,
    color: '#4caf50',
    marginBottom: 4,
  },
  buttonRow: {
    display: 'flex',
    gap: 16,
    marginTop: 12,
    justifyContent: 'center',
  },
  saveBtn: {
    background: '#aaa',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '10px 22px',
    fontWeight: 700,
    fontSize: 16,
    cursor: 'pointer',
  },
  publishBtn: {
    background: '#3f51b5',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '10px 22px',
    fontWeight: 700,
    fontSize: 16,
    cursor: 'pointer',
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
};

export default QuizCreatePage; 