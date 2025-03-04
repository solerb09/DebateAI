import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import HomePage from './pages/HomePage';
import DebateListPage from './pages/DebateListPage';
import CreateDebatePage from './pages/CreateDebatePage';
import DebateRoomPage from './pages/DebateRoomPage';
import CallTestPage from './pages/CallTestPage';
import NotFoundPage from './pages/NotFoundPage';
import SignupPage from './pages/SignupPage';

function App() {
  return (
      <div className="app">
        <Header />
        <main className="container">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/debates" element={<DebateListPage />} />
            <Route path="/debates/create" element={<CreateDebatePage />} />
            <Route path="/debates/:id" element={<DebateRoomPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/call" element={<CallTestPage />} />
            <Route path="/404" element={<NotFoundPage />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Routes>
        </main>
      </div>
  );
}

export default App; 