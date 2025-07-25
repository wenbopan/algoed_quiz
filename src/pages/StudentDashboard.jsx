import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { signOut, onAuthStateChanged } from 'firebase/auth';

const StudentDashboard = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [quizzes, setQuizzes] = useState([]);
  const [userProgress, setUserProgress] = useState({
    completedQuizzes: 0,
    averageScore: 0,
    currentStreak: 0,
    totalAttempts: 0
  });
  const [recentQuizzes, setRecentQuizzes] = useState([]);
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [recommendedQuizzes, setRecommendedQuizzes] = useState([]);
  const [popularQuizzes, setPopularQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Expandable sections state
  const [expandedSections, setExpandedSections] = useState({
    recent: false,
    recommended: false,
    popular: false
  });

  // Filter function for search
  const filterQuizzes = (quizzes) => {
    if (!searchTerm) return quizzes;
    
    return quizzes.filter(quiz => {
      // Handle both quiz objects (with 'name') and recent quiz objects (with 'quizName')
      const quizName = quiz.name || quiz.quizName || '';
      return quizName.toLowerCase().includes(searchTerm.toLowerCase());
    });
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setAuthLoading(false);
      
      if (currentUser) {
        // Check if the URL userId matches the authenticated user
        if (userId && userId !== currentUser.uid) {
          // Redirect to correct user dashboard or show error
          navigate(`/${currentUser.uid}/dashboard`);
          return;
        }
        
        setUser(currentUser);
        fetchDashboardData(currentUser.uid);
      } else {
        // No user is signed in, redirect to login
        navigate('/login');
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [navigate, userId]);

  const fetchDashboardData = async (currentUserId) => {
    try {
      console.log('Starting to fetch dashboard data...');
      
      // Fetch all published quizzes
      const quizzesQuery = query(
        collection(db, 'quizzes'),
        where('status', '==', 'Published'),
        orderBy('createdAt', 'desc')
      );
      console.log('Executing Firebase query...');
      
      const quizzesSnapshot = await getDocs(quizzesQuery);
      console.log('Firebase query completed. Number of docs:', quizzesSnapshot.size);
      
      const allQuizzes = quizzesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      console.log('All quizzes from Firebase:', allQuizzes);
      console.log('Number of quizzes:', allQuizzes.length);
      
      setQuizzes(allQuizzes);

      // Fetch real user progress data (now that index is created)
      console.log('Fetching user progress data...');
      const progressQuery = query(
        collection(db, 'userProgress'),
        where('userId', '==', currentUserId),
        where('status', '==', 'completed'),
        orderBy('completedAt', 'desc'),
        limit(10) // Get last 10 completed quizzes
      );
      
      const progressSnapshot = await getDocs(progressQuery);
      console.log('User progress query completed. Number of completed quizzes:', progressSnapshot.size);
      
      const completedQuizzes = progressSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          quizId: data.quizId,
          quizName: data.quizName || 'Unknown Quiz',
          score: data.finalScore || data.score || 0,
          totalQuestions: data.totalQuestions || 0,
          percentageScore: data.percentageScore || 0,
          timeTaken: data.timeTaken || 0,
          completedAt: data.completedAt?.toDate?.() || new Date(),
          startedAt: data.startedAt?.toDate?.() || new Date()
        };
      });

      console.log('Completed quizzes:', completedQuizzes);

      // Calculate real user progress metrics
      const totalAttempts = completedQuizzes.length;
      const averageScore = totalAttempts > 0 
        ? Math.round(completedQuizzes.reduce((sum, quiz) => sum + quiz.percentageScore, 0) / totalAttempts)
        : 0;
      
      // Calculate streak (consecutive days with quiz activity)
      let currentStreak = 0;
      if (completedQuizzes.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        for (let i = 0; i < completedQuizzes.length; i++) {
          const quizDate = new Date(completedQuizzes[i].completedAt);
          quizDate.setHours(0, 0, 0, 0);
          
          const daysDiff = Math.floor((today - quizDate) / (1000 * 60 * 60 * 24));
          
          if (daysDiff === i) {
            currentStreak++;
          } else {
            break;
          }
        }
      }

      const realProgress = {
        completedQuizzes: totalAttempts,
        averageScore: averageScore,
        currentStreak: currentStreak,
        totalAttempts: totalAttempts
      };
      
      console.log('Calculated user progress:', realProgress);
      setUserProgress(realProgress);

      // Set recent quizzes from real data with actual quiz names
      const recentQuizData = completedQuizzes.slice(0, 5).map(quiz => {
        // Find the actual quiz data to get the real name
        const actualQuiz = allQuizzes.find(q => q.id === quiz.quizId);
        return {
          id: quiz.quizId,
          quizName: actualQuiz?.name || quiz.quizName || 'Unknown Quiz', // Use actual quiz name
          score: quiz.score,
          totalQuestions: quiz.totalQuestions,
          percentageScore: quiz.percentageScore,
          completedAt: quiz.completedAt,
          timeTaken: quiz.timeTaken,
          category: actualQuiz?.category || 'Unknown' // Add category for display
        };
      });
      
      console.log('Recent quiz data:', recentQuizData);
      setRecentQuizzes(recentQuizData);

      // Check for in-progress quiz
      const inProgressQuery = query(
        collection(db, 'userProgress'),
        where('userId', '==', currentUserId),
        where('status', '==', 'in_progress'),
        limit(1)
      );
      
      const inProgressSnapshot = await getDocs(inProgressQuery);
      if (!inProgressSnapshot.empty) {
        const inProgressData = inProgressSnapshot.docs[0].data();
        const actualQuiz = allQuizzes.find(q => q.id === inProgressData.quizId);
        const currentQuizData = {
          id: inProgressData.quizId,
          name: actualQuiz?.name || inProgressData.quizName || 'Unknown Quiz', // Use actual quiz name
          currentQuestion: inProgressData.currentQuestion || 1,
          totalQuestions: inProgressData.totalQuestions || 0,
          startedAt: inProgressData.startedAt?.toDate?.() || new Date()
        };
        console.log('Found in-progress quiz:', currentQuizData);
        setCurrentQuiz(currentQuizData);
      } else {
        console.log('No in-progress quiz found');
        setCurrentQuiz(null);
      }

      // Smart recommendations: untaken quizzes + low-scoring completed quizzes (< 80%)
      if (allQuizzes.length > 0) {
        console.log('Creating smart recommendations...');
        
        const completedQuizIds = new Set(completedQuizzes.map(q => q.quizId));
        const lowScoringQuizIds = new Set(
          completedQuizzes
            .filter(q => q.percentageScore < 80)
            .map(q => q.quizId)
        );
        
        console.log('Completed quiz IDs:', Array.from(completedQuizIds));
        console.log('Low-scoring quiz IDs (< 80%):', Array.from(lowScoringQuizIds));
        console.log('All available quiz IDs:', allQuizzes.map(q => q.id));
        
        // Include: 1) Untaken quizzes, 2) Low-scoring completed quizzes
        const recommendedQuizzes = allQuizzes.filter(quiz => 
          !completedQuizIds.has(quiz.id) || lowScoringQuizIds.has(quiz.id)
        );
        
        console.log('Recommended quizzes:', recommendedQuizzes.map(q => ({ id: q.id, name: q.name })));
        
        const actualRecommended = recommendedQuizzes.slice(0, 5).map(quiz => {
          const completedQuiz = completedQuizzes.find(c => c.quizId === quiz.id);
          const isLowScoring = completedQuiz && completedQuiz.percentageScore < 80;
          
          return {
            ...quiz,
            recommendedReason: isLowScoring ? 
              `🎯 Retake opportunity! Previous score: ${completedQuiz.percentageScore}%` :
              quiz.category === 'Philosophy' ? 'Based on your learning progress' :
              quiz.category === 'Physics' ? 'Expand your Physics knowledge' :
              quiz.category === 'Math' ? 'Perfect for your skill level' :
              'Popular in your learning path'
          };
        });
        
        console.log('Final recommended quizzes:', actualRecommended.map(q => ({ 
          id: q.id, 
          name: q.name, 
          reason: q.recommendedReason 
        })));
        setRecommendedQuizzes(actualRecommended);
      } else {
        console.log('No quizzes found in Firebase, setting empty array');
        setRecommendedQuizzes([]);
      }

      // Calculate real quiz statistics from userProgress data
      console.log('Calculating real quiz statistics...');
      
      // Fetch all completed quiz attempts for statistics
      const allProgressQuery = query(
        collection(db, 'userProgress'),
        where('status', '==', 'completed')
      );
      
      const allProgressSnapshot = await getDocs(allProgressQuery);
      console.log('Total completed attempts across all users:', allProgressSnapshot.size);
      
      // Group attempts by quiz ID
      const quizStats = {};
      allProgressSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const quizId = data.quizId;
        
        if (!quizStats[quizId]) {
          quizStats[quizId] = {
            attempts: 0,
            scores: [],
            lastAttempt: null
          };
        }
        
        quizStats[quizId].attempts++;
        quizStats[quizId].scores.push(data.percentageScore || 0);
        
        const attemptDate = data.completedAt?.toDate?.() || new Date();
        if (!quizStats[quizId].lastAttempt || attemptDate > quizStats[quizId].lastAttempt) {
          quizStats[quizId].lastAttempt = attemptDate;
        }
      });
      
      console.log('Quiz statistics:', quizStats);

      // Popular quizzes with real data
      const popular = allQuizzes.slice(0, 5).map(quiz => {
        const stats = quizStats[quiz.id] || { attempts: 0, scores: [] };
        const averageScore = stats.scores.length > 0 
          ? stats.scores.reduce((sum, score) => sum + score, 0) / stats.scores.length
          : 0;
        
        return {
          ...quiz,
          attempts: stats.attempts, // Real attempt count
          averageScore: Math.round(averageScore), // Real average score
          rating: Math.min(5, Math.max(1, (averageScore / 20) + 1)).toFixed(1), // Convert score to 1-5 rating
          lastAttempt: stats.lastAttempt
        };
      }).sort((a, b) => b.attempts - a.attempts); // Sort by popularity (most attempts first)
      
      console.log('Popular quizzes with real stats:', popular.map(q => ({
        name: q.name,
        attempts: q.attempts,
        averageScore: q.averageScore,
        rating: q.rating
      })));
      
      setPopularQuizzes(popular);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      console.error('Error details:', error.message);
      setRecommendedQuizzes([]); // Set empty array on error
      
      // Set fallback empty states on error
      setUserProgress({
        completedQuizzes: 0,
        averageScore: 0,
        currentStreak: 0,
        totalAttempts: 0
      });
      setRecentQuizzes([]);
      setCurrentQuiz(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleQuizStart = (quizId) => {
    navigate(`/${userId}/quiz/${quizId}`);
  };

  const handleResumeQuiz = () => {
    if (currentQuiz) {
      navigate(`/${userId}/quiz/${currentQuiz.id}/resume`);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div style={styles.outer}>
        <div style={styles.container}>
          <div style={styles.loading}>Checking authentication...</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={styles.outer}>
        <div style={styles.container}>
          <div style={styles.loading}>Loading your dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.outer}>
      <div style={styles.container}>
        {/* Header */}
        <header style={styles.header}>
          <div style={styles.logo}>
            algoed <span style={styles.studentBadge}>Student Portal</span>
          </div>
          <div style={styles.userInfo}>
            <span style={styles.welcomeText}>Welcome back, {user?.displayName || user?.email?.split('@')[0]}! 👋</span>
            <button style={styles.logoutBtn} onClick={handleLogout}>Logout</button>
          </div>
        </header>

        {/* Progress Overview */}
        <div style={styles.progressSection}>
          <h2 style={styles.sectionTitle}>📊 Your Progress</h2>
          {userProgress.totalAttempts === 0 ? (
            <div style={styles.newUserMessage}>
              <p style={styles.welcomeMessage}>🎉 Welcome to algoed! Start taking quizzes to track your progress here.</p>
            </div>
          ) : (
            <div style={styles.progressGrid}>
              <div style={styles.progressCard}>
                <div style={styles.progressNumber}>{userProgress.completedQuizzes}</div>
                <div style={styles.progressLabel}>Quizzes Completed</div>
              </div>
              <div style={styles.progressCard}>
                <div style={styles.progressNumber}>{userProgress.averageScore}%</div>
                <div style={styles.progressLabel}>Average Score</div>
              </div>
              <div style={styles.progressCard}>
                <div style={styles.progressNumber}>{userProgress.currentStreak}</div>
                <div style={styles.progressLabel}>Day Streak 🔥</div>
              </div>
              <div style={styles.progressCard}>
                <div style={styles.progressNumber}>{userProgress.totalAttempts}</div>
                <div style={styles.progressLabel}>Total Attempts</div>
              </div>
            </div>
          )}
        </div>

        {/* Continue Quiz */}
        {currentQuiz && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>📝 Continue Your Quiz</h3>
            <div style={styles.currentQuizCard}>
              <div style={styles.quizInfo}>
                <span style={styles.quizName}>{currentQuiz.name}</span>
                <span style={styles.quizProgress}>
                  Question {currentQuiz.currentQuestion}/{currentQuiz.totalQuestions}
                </span>
                <div style={styles.progressBar}>
                  <div 
                    style={{
                      ...styles.progressFill,
                      width: `${(currentQuiz.currentQuestion / currentQuiz.totalQuestions) * 100}%`
                    }}
                  />
                </div>
              </div>
              <button style={styles.resumeBtn} onClick={handleResumeQuiz}>
                Resume
              </button>
            </div>
          </div>
        )}

        {/* Recent Quizzes - Expandable */}
        <div style={styles.section}>
          <div 
            style={styles.expandableHeader} 
            onClick={() => toggleSection('recent')}
          >
            <h3 style={styles.sectionTitle}>
              🏆 Your Recent Quizzes ({filterQuizzes(recentQuizzes).length})
            </h3>
            <span style={styles.expandIcon}>
              {expandedSections.recent ? '▼' : '▶'}
            </span>
          </div>
          {expandedSections.recent && (
            <div style={styles.expandableContent}>
              {filterQuizzes(recentQuizzes).length === 0 ? (
                <div style={styles.noResults}>
                  {recentQuizzes.length === 0 ? 
                    "🚀 No quizzes taken yet! Check out the recommended quizzes below to get started." : 
                    "No recent quizzes match your search"
                  }
                </div>
              ) : (
                filterQuizzes(recentQuizzes).map(quiz => (
                  <div key={quiz.id} style={styles.listItem}>
                    <div style={styles.itemInfo}>
                      <span style={styles.itemTitle}>{quiz.quizName}</span>
                      <span style={styles.itemDetails}>
                        Score: {quiz.score}/{quiz.totalQuestions} ({quiz.percentageScore}%) • 
                        Completed: {quiz.completedAt.toLocaleDateString()} • 
                        Time: {Math.floor(quiz.timeTaken / 60)}m {quiz.timeTaken % 60}s • 
                        Category: {quiz.category}
                      </span>
                    </div>
                    <div style={styles.itemActions}>
                      <span style={{
                        ...styles.scoreIndicator,
                        color: quiz.percentageScore >= 90 ? '#4caf50' : quiz.percentageScore >= 70 ? '#ff9800' : '#f44336'
                      }}>
                        {quiz.percentageScore >= 90 ? '⭐' : quiz.percentageScore >= 70 ? '👍' : '📚'}
                      </span>
                      <button style={styles.retakeBtn} onClick={() => handleQuizStart(quiz.id)}>
                        Retake
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Recommended Quizzes - Expandable */}
        <div style={styles.section}>
          <div 
            style={styles.expandableHeader} 
            onClick={() => toggleSection('recommended')}
          >
            <h3 style={styles.sectionTitle}>
              ✨ Recommended for You ({filterQuizzes(recommendedQuizzes).length})
            </h3>
            <span style={styles.expandIcon}>
              {expandedSections.recommended ? '▼' : '▶'}
            </span>
          </div>
          
          {expandedSections.recommended && (
            <div style={styles.expandableContent}>
              {filterQuizzes(recommendedQuizzes).length === 0 ? (
                <div style={styles.noResults}>No recommended quizzes match your search</div>
              ) : (
                filterQuizzes(recommendedQuizzes).map(quiz => (
                  <div key={quiz.id} style={styles.listItem}>
                    <div style={styles.itemInfo}>
                      <span style={styles.itemTitle}>{quiz.name}</span>
                      <span style={styles.itemDetails}>
                        {quiz.questions?.length || 0} questions • {quiz.recommendedReason || `Based on your ${quiz.category} progress`}
                      </span>
                    </div>
                    <div style={styles.itemActions}>
                      <span style={styles.categoryBadge}>{quiz.category}</span>
                      <button style={styles.startBtn} onClick={() => handleQuizStart(quiz.id)}>
                        Start
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Popular This Week - Expandable */}
        <div style={styles.section}>
          <div 
            style={styles.expandableHeader} 
            onClick={() => toggleSection('popular')}
          >
            <h3 style={styles.sectionTitle}>
              🔥 Most Popular Quizzes ({filterQuizzes(popularQuizzes).length})
            </h3>
            <span style={styles.expandIcon}>
              {expandedSections.popular ? '▼' : '▶'}
            </span>
          </div>
          {expandedSections.popular && (
            <div style={styles.expandableContent}>
              {filterQuizzes(popularQuizzes).length === 0 ? (
                <div style={styles.noResults}>No popular quizzes match your search</div>
              ) : (
                filterQuizzes(popularQuizzes).map(quiz => (
                  <div key={quiz.id} style={styles.listItem}>
                    <div style={styles.itemInfo}>
                      <span style={styles.itemTitle}>{quiz.name}</span>
                      <span style={styles.itemDetails}>
                        {quiz.attempts} {quiz.attempts === 1 ? 'attempt' : 'attempts'} • 
                        Avg Score: {quiz.averageScore}% • 
                        ⭐ {quiz.rating}/5 • 
                        {quiz.questions?.length || 0} questions
                      </span>
                    </div>
                    <div style={styles.itemActions}>
                      <span style={styles.categoryBadge}>{quiz.category}</span>
                      <button style={styles.startBtn} onClick={() => handleQuizStart(quiz.id)}>
                        Join
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Search Section - Google Style */}
        <div style={styles.searchSection}>
          <h3 style={styles.searchTitle}>Search Quizzes</h3>
          <div style={styles.searchContainer}>
            <input
              style={styles.searchInput}
              type="text"
              placeholder="Search your quizzes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {searchTerm && (
            <div style={styles.searchInfo}>
              Searching for: "{searchTerm}"
            </div>
          )}
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
    padding: '1rem',
    boxSizing: 'border-box',
  },
  container: {
    maxWidth: 900, // Narrower for better readability
    margin: '0 auto',
    fontFamily: 'Inter, Arial, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
    background: '#fff',
    padding: '1rem 1.5rem',
    borderRadius: 12,
    boxShadow: '0 2px 12px rgba(63,81,181,0.08)',
  },
  logo: {
    fontWeight: 800,
    fontSize: 24,
    color: '#3f51b5',
    letterSpacing: 2,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  studentBadge: {
    background: 'linear-gradient(90deg, #4caf50 0%, #3f51b5 100%)',
    color: '#fff',
    fontWeight: 700,
    fontSize: 12,
    borderRadius: 8,
    padding: '2px 12px',
    letterSpacing: 1,
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  welcomeText: {
    fontSize: 16,
    fontWeight: 600,
    color: '#333',
  },
  logoutBtn: {
    background: '#fff',
    color: '#3f51b5',
    border: '1px solid #3f51b5',
    borderRadius: 6,
    padding: '8px 16px',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
  },
  progressSection: {
    background: '#fff',
    borderRadius: 12,
    padding: '1.5rem',
    marginBottom: '1.5rem',
    boxShadow: '0 2px 12px rgba(63,81,181,0.08)',
  },
  section: {
    background: '#fff',
    borderRadius: 12,
    padding: '1.5rem',
    marginBottom: '1.5rem',
    boxShadow: '0 2px 12px rgba(63,81,181,0.08)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#222',
    margin: 0,
  },
  expandableHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    padding: '0.5rem 0',
    borderRadius: 6,
    transition: 'background 0.2s',
  },
  expandIcon: {
    fontSize: 14,
    color: '#666',
    transition: 'transform 0.2s',
  },
  expandableContent: {
    marginTop: '1rem',
    paddingTop: '1rem',
    borderTop: '1px solid #e9ecef',
  },
  listItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem',
    marginBottom: '0.75rem',
    background: '#f8f9fa',
    borderRadius: 8,
    border: '1px solid #e9ecef',
  },
  itemInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: '#222',
  },
  itemDetails: {
    fontSize: 13,
    color: '#666',
  },
  itemActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  scoreIndicator: {
    fontSize: 18,
  },
  retakeBtn: {
    background: '#ff9800',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    padding: '6px 12px',
    fontWeight: 600,
    fontSize: 12,
    cursor: 'pointer',
  },
  startBtn: {
    background: '#3f51b5',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    padding: '6px 12px',
    fontWeight: 600,
    fontSize: 12,
    cursor: 'pointer',
  },
  categoryBadge: {
    background: '#3f51b5',
    color: '#fff',
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 4,
  },
  progressGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '1rem',
    marginTop: '1rem',
  },
  progressCard: {
    background: '#f8f9fa',
    borderRadius: 8,
    padding: '1rem',
    textAlign: 'center',
    border: '1px solid #e9ecef',
  },
  progressNumber: {
    fontSize: 24,
    fontWeight: 700,
    color: '#3f51b5',
    marginBottom: '0.5rem',
  },
  progressLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: 600,
  },
  currentQuizCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem',
    background: '#f8f9fa',
    borderRadius: 8,
    border: '1px solid #e9ecef',
    marginTop: '1rem',
  },
  quizInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    flex: 1,
  },
  quizName: {
    fontSize: 16,
    fontWeight: 600,
    color: '#222',
  },
  quizProgress: {
    fontSize: 14,
    color: '#666',
  },
  progressBar: {
    height: 6,
    background: '#e9ecef',
    borderRadius: 3,
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: {
    height: '100%',
    background: '#4caf50',
    borderRadius: 3,
    transition: 'width 0.3s ease',
  },
  resumeBtn: {
    background: '#4caf50',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 16px',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
  },
  loading: {
    textAlign: 'center',
    color: '#888',
    fontSize: 18,
    padding: '2rem 0',
  },
  searchSection: {
    background: '#fff',
    borderRadius: 12,
    padding: '1.5rem',
    marginBottom: '1.5rem',
    boxShadow: '0 2px 12px rgba(63,81,181,0.08)',
  },
  searchTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#222',
    marginBottom: '1rem',
  },
  searchContainer: {
    display: 'flex',
    alignItems: 'center',
    border: '1px solid #e9ecef',
    borderRadius: 6,
    overflow: 'hidden',
    background: '#fff',
  },
  searchInput: {
    flex: 1,
    padding: '0.75rem 1rem',
    border: 'none',
    fontSize: 14,
    color: '#333',
    background: 'transparent',
    outline: 'none',
  },
  searchInfo: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginTop: '0.5rem',
  },
  noResults: {
    textAlign: 'center',
    color: '#888',
    fontSize: 14,
    padding: '1rem 0',
  },
  newUserMessage: {
    textAlign: 'center',
    padding: '2rem 0',
    background: '#e8f5e9', // Light green background
    borderRadius: 8,
    border: '1px solid #a5d6a7', // Green border
  },
  welcomeMessage: {
    fontSize: 16,
    color: '#2e7d32', // Darker green text
    margin: 0,
    fontWeight: 600,
  },
};

export default StudentDashboard; 