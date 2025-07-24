import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import UserLoginPage from './pages/UserLoginPage';
import AdminLoginPage from './pages/AdminLoginPage';
import UserRegisterPage from './pages/UserRegisterPage';
import AdminRegisterPage from './pages/AdminRegisterPage';
import AdminDashboard from './pages/AdminDashboard';
import QuizCreatePage from './pages/QuizCreatePage';
import QuizDetailPage from './pages/QuizDetailPage';
import QuizLivePage from './pages/QuizLivePage';
import StudentDashboard from './pages/StudentDashboard';
import QuizTakingPage from './pages/QuizTakingPage';
import QuizResultsPage from './pages/QuizResultsPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<UserLoginPage />} />
        <Route path="/admin-login" element={<AdminLoginPage />} />
        <Route path="/register" element={<UserRegisterPage />} />
        <Route path="/admin-register" element={<AdminRegisterPage />} />
        
        {/* Student routes with userId */}
        <Route path="/:userId/dashboard" element={<StudentDashboard />} />
        <Route path="/:userId/quiz/:quizId" element={<QuizTakingPage />} />
        <Route path="/:userId/quiz/:quizId/results" element={<QuizResultsPage />} />
        <Route path="/:userId/quiz/:quizId/resume" element={<div>Resume Quiz Page</div>} />
        
        {/* Admin routes */}
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/admin-dashboard/quiz/new" element={<QuizCreatePage />} />
        <Route path="/admin-dashboard/quiz/:quizId" element={<QuizDetailPage />} />
        <Route path="/admin-dashboard/quiz/:quizId/live" element={<QuizLivePage />} />
        
        {/* Legacy redirect for old dashboard route */}
        <Route path="/dashboard" element={<Navigate to="/login" replace />} />
        
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
