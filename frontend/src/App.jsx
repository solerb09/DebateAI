import React, { useContext } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Header from './components/Header';
import HomePage from './pages/HomePage';
import DebateListPage from './pages/DebateListPage';
import CreateDebatePage from './pages/CreateDebatePage';
import DebateRoomPage from './pages/DebateRoomPage';
import DebateResultsPage from './pages/DebateResultsPage';
import NotFoundPage from './pages/NotFoundPage';
import SignupPage from './pages/SignupPage';
import LoginPage from './pages/LoginPage'; 
import WaitlistPage from './pages/WaitlistPage';
import { AuthContext, AuthProvider } from './contexts/AuthContext'; 
import ProfilePage from './pages/ProfilePage';
import LeaderboardPage from './pages/LeaderboardPage';
import './styles/App.css';

function ProtectedRoute({ children }) {

  const auth = useContext(AuthContext);
  
  // For debugging - see what properties are available
  console.log("Auth in ProtectedRoute:", auth);
  
  // When still loading, show nothing or a loading indicator
  if (auth?.loading) {  // Using optional chaining for safety
    return <div className="loading">Loading...</div>; 
  }
  
  // Only redirect if the user is not authenticated
  if (!auth?.isAuthenticated) {
    return <Navigate to="/login" replace />; 
  }
  
  // If authenticated, render the protected content
  return children;
}

function App() {
  const location = useLocation();
  const isWaitlistPage = location.pathname === '/waitlist';
  
  return (
    <AuthProvider>
      <div className="app">
        <Header />
        <main className={!isWaitlistPage ? "main-content container" : "main-content"}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              
              {/* Protected routes */}
              <Route path="/debates" element={
                <ProtectedRoute>
                  <DebateListPage />
                </ProtectedRoute>
              } />
              
              <Route path="/debates/create" element={
                <ProtectedRoute>
                  <CreateDebatePage />
                </ProtectedRoute>
              } />
              
              <Route path="/debates/:id" element={
                <ProtectedRoute>
                  <DebateRoomPage />
                </ProtectedRoute>
              } />
              
              <Route path="/debates/:id/results" element={
                <ProtectedRoute>
                  <DebateResultsPage />
                </ProtectedRoute>
              } />
              
              <Route path="/profile" element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              } />
              
              <Route path="/profile/:userId" element={<ProfilePage />} />
              
              <Route path="/leaderboard" element={
                <ProtectedRoute>
                  <LeaderboardPage />
                </ProtectedRoute>
              } />
              
              {/* Public routes */}
              <Route path="/waitlist" element={<WaitlistPage />} />
              <Route path="/login" element={<LoginPage />} /> 
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/404" element={<NotFoundPage />} />
              <Route path="*" element={<Navigate to="/404" replace />} />
            </Routes>
        </main>
      </div>
    </AuthProvider>
  );
}

export default App;
