import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/DebateHistory.css';

function DebateHistory({ debates = [], loading = false, error = null }) {
  const [activeTab, setActiveTab] = useState('past');
  const navigate = useNavigate();

  const filteredDebates = activeTab === 'past' 
    ? debates.filter(debate => debate.result === 'Won' || debate.result === 'Lost')
    : activeTab === 'upcoming' 
      ? debates.filter(debate => debate.result === 'In Progress')
      : debates;

  const handleViewDetails = (debateId) => {
    navigate(`/debates/${debateId}/results`);
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="debate-loading">
          <p>Loading debate history...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="debate-error">
          <p>{error}</p>
        </div>
      );
    }

    if (filteredDebates.length === 0) {
      return (
        <div className="no-debates">
          <p>No debates found in this category.</p>
        </div>
      );
    }

    return (
      <div className="debate-list">
        {filteredDebates.map((debate, index) => (
          <div key={debate.id || index} className="debate-card">
            <div className="debate-card-header">
              <div className="debate-result-badges">
                <span className={`result-badge ${debate.result.toLowerCase()}`}>
                  {debate.result}
                </span>
                {debate.type && (
                  <span className="debate-type-badge">
                    {debate.type}
                  </span>
                )}
              </div>
              <div className="debate-date">
                <i className="calendar-icon"></i>
                {debate.date}
              </div>
            </div>
            
            <h3 className="debate-title">{debate.title}</h3>
            <p className="debate-description">{debate.description}</p>
            
            <div className="debate-details">
              <div className="debate-opponent-container">
                <div className="debate-opponent">
                  <i className="versus-icon"></i>
                  vs. {debate.opponent}
                </div>
                
                {debate.duration && (
                  <div className="debate-duration">
                    <i className="time-icon"></i>
                    {debate.duration}
                  </div>
                )}
              </div>
            </div>
            
            <div className="debate-footer">
              <div className="performance-container">
                {debate.score && (
                  <div className="debate-score">
                    Performance Score: <span className="score-value">{debate.score}</span>
                  </div>
                )}
              </div>
              
              <button 
                className="view-details-btn"
                onClick={() => handleViewDetails(debate.id)}
              >
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="debate-history-container">
      <div className="debate-history-header">
        <h2>Debate History</h2>
        <p className="debate-history-subtext">View past and upcoming debates</p>
      </div>
      
      <div className="debate-history-tabs">
        <button 
          className={`tab ${activeTab === 'past' ? 'active' : ''}`}
          onClick={() => setActiveTab('past')}
        >
          <i className="tab-icon past-icon"></i> Past Debates
        </button>
        <button 
          className={`tab ${activeTab === 'upcoming' ? 'active' : ''}`}
          onClick={() => setActiveTab('upcoming')}
        >
          <i className="tab-icon upcoming-icon"></i> In Progress
        </button>
        <button 
          className={`tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          <i className="tab-icon all-icon"></i> All Debates
        </button>
      </div>
      
      {renderContent()}
    </div>
  );
}

export default DebateHistory; 