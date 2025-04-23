import React from 'react';
import '../styles/DebateHero.css';

const DebateHero = ({ 
  title, 
  description, 
  date, 
  startTime, 
  endTime, 
  duration, 
  participants,
  winner 
}) => {
  return (
    <div className="debate-hero">
      <div className="debate-hero-content">
        <h1 className="debate-title">{title}</h1>
        <p className="debate-description">{description}</p>
        
        <div className="debate-meta">
          <div className="meta-item">
            <span className="meta-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M12 2H4C2.89543 2 2 2.89543 2 4V12C2 13.1046 2.89543 14 4 14H12C13.1046 14 14 13.1046 14 12V4C14 2.89543 13.1046 2 12 2Z" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M2 6H14" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </span>
            <span>{date}</span>
          </div>
          
          <div className="meta-item">
            <span className="meta-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M8 4V8L10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </span>
            <span>{`${startTime} - ${endTime}`}</span>
            <span className="duration">{duration}</span>
          </div>
          
          <div className="meta-item">
            <span className="meta-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 4C10 5.10457 9.10457 6 8 6C6.89543 6 6 5.10457 6 4C6 2.89543 6.89543 2 8 2C9.10457 2 10 2.89543 10 4Z" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M14 14C14 11.7909 11.3137 10 8 10C4.68629 10 2 11.7909 2 14" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </span>
            <span>{participants} Participants</span>
          </div>
        </div>

        {winner && (
          <div className="winner-section">
            <span className="winner-tag">Winner</span>
            <span className="winner-name">{winner}</span>
            <span className="position-tag">(Pro Position)</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default DebateHero; 