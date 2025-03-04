import React, { useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import HomePage from './pages/HomePage';
import DebateListPage from './pages/DebateListPage';
import CreateDebatePage from './pages/CreateDebatePage';
import DebateRoomPage from './pages/DebateRoomPage';
import CallTestPage from './pages/CallTestPage';
import NotFoundPage from './pages/NotFoundPage';
import SignupPage from './pages/SignupPage';
import LoginPage from './pages/LoginPage'; 
import { AuthProvider, AuthContext } from './contexts/AuthContext'; 


function ProtectedRoute({ children }) {
  const { authState } = useContext(AuthContext); 
  if (!authState.isAuthenticated) {
    return <Navigate to="/login" replace />; // Redirect to login if not authenticated
  }
  return children; // If authenticated, render the protected page
}

function App() {
  return (
    <AuthProvider>
      <div className="app">
        <Header />
        <main className="container">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/debates" element={<ProtectedRoute><DebateListPage /></ProtectedRoute>} />
              <Route path="/debates/create" element={<ProtectedRoute><CreateDebatePage /></ProtectedRoute>} />
              <Route path="/debates/:id" element={<ProtectedRoute><DebateRoomPage /></ProtectedRoute>} />
              <Route path="/call" element={<CallTestPage />} />
              <Route path="/login" element={<LoginPage />} /> 
              <Route path="/404" element={<NotFoundPage />} />
              <Route path="*" element={<Navigate to="/404" replace />} />
            </Routes>
        </main>
      </div>
    </AuthProvider>
  );
}

export default App;
