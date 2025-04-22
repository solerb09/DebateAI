import React, { useState } from 'react';
import '../styles/TranscriptionCard.css';

const TranscriptionCard = ({ proTranscript, conTranscript }) => {
  const [activeTab, setActiveTab] = useState('full');

  const tabs = [
    { id: 'full', label: 'Full Transcript' },
    { id: 'pro', label: 'Pro Arguments' },
    { id: 'con', label: 'Con Arguments' },
    { id: 'key', label: 'Key Points' }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'pro':
        return (
          <div className="transcript-content">
            {proTranscript.map((entry, index) => (
              <div key={index} className="transcript-entry">
                <div className="entry-header">
                  <h3>{entry.title || 'Opening Statement'}</h3>
                  <span className="timestamp">{entry.timestamp}</span>
                </div>
                <p>{entry.text}</p>
              </div>
            ))}
          </div>
        );
      case 'con':
        return (
          <div className="transcript-content">
            {conTranscript.map((entry, index) => (
              <div key={index} className="transcript-entry">
                <div className="entry-header">
                  <h3>{entry.title || 'Opening Statement'}</h3>
                  <span className="timestamp">{entry.timestamp}</span>
                </div>
                <p>{entry.text}</p>
              </div>
            ))}
          </div>
        );
      case 'full':
        return (
          <div className="transcript-content">
            {[...proTranscript, ...conTranscript]
              .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
              .map((entry, index) => (
                <div key={index} className="transcript-entry">
                  <div className="entry-header">
                    <h3>{entry.title || 'Statement'}</h3>
                    <span className="timestamp">{entry.timestamp}</span>
                  </div>
                  <p>{entry.text}</p>
                </div>
              ))}
          </div>
        );
      case 'key':
        return (
          <div className="transcript-content">
            <div className="key-points">
              <div className="key-points-section">
                <h3>Pro Side Key Points</h3>
                <ul>
                  {proTranscript.map((entry, index) => (
                    <li key={index}>{entry.text.split('.')[0]}.</li>
                  ))}
                </ul>
              </div>
              <div className="key-points-section">
                <h3>Con Side Key Points</h3>
                <ul>
                  {conTranscript.map((entry, index) => (
                    <li key={index}>{entry.text.split('.')[0]}.</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="transcription-card">
      <div className="transcription-header">
        <h2>Debate Transcript</h2>
        <p className="subtitle">Complete record of the debate conversation</p>
      </div>

      <div className="tab-navigation">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {renderContent()}
    </div>
  );
};

export default TranscriptionCard; 