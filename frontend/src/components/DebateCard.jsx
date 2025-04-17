import React from 'react';
import '../styles/DebateCard.css';

const DebateCard = ({ 
  status, 
  title, 
  description, 
  proponent, 
  opponent,
  duration,
  datetime,
  participants = "2/2",
  onClick
}) => {
  const getStatusStyle = (status) => {
    switch (status) {
      case 'Live':
        return 'status-live';
      case 'completed':
        return 'status-completed';
      case 'Upcoming':
        return 'status-upcoming';
      default:
        return '';
    }
  };

  const getButtonText = (status) => {
    switch (status) {
      case 'Live':
        return 'Join Debate';
      case 'completed':
        return 'View Results';
      case 'Upcoming':
        return 'Join Debate';
      default:
        return 'View Debate';
    }
  };

  return (
    <div className="debate-card" onClick={onClick} role="button" tabIndex={0}>
      <div className="debate-card-header">
        <span className={`debate-status ${getStatusStyle(status)}`}>
          {status}
        </span>
        <span className="debate-participants">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 8C10.21 8 12 6.21 12 4C12 1.79 10.21 0 8 0C5.79 0 4 1.79 4 4C4 6.21 5.79 8 8 8ZM8 10C5.33 10 0 11.34 0 14V16H16V14C16 11.34 10.67 10 8 10Z" 
              fill="#6B7280"/>
          </svg>
          {participants}
        </span>
      </div>

      <h3 className="debate-title">{title}</h3>
      <p className="debate-description">{description}</p>

      <div className="debate-participants-info">
        <div className="participant pro">
          <span className="label">Pro:</span>
          <span className="name">{proponent}</span>
        </div>
        <div className="participant con">
          <span className="label">Con:</span>
          <span className="name">{opponent}</span>
        </div>
      </div>

      <div className="debate-footer">
        <span className="debate-duration">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 0C3.58 0 0 3.58 0 8C0 12.42 3.58 16 8 16C12.42 16 16 12.42 16 8C16 3.58 12.42 0 8 0ZM8 14C4.69 14 2 11.31 2 8C2 4.69 4.69 2 8 2C11.31 2 14 4.69 14 8C14 11.31 11.31 14 8 14ZM8.5 4H7V9L11.5 11.7L12.2 10.5L8.5 8.2V4Z" 
              fill="#6B7280"/>
          </svg>
          {duration}
        </span>
        <span className="debate-datetime">{datetime}</span>
      </div>

      <div className="debate-action">
        <button className={`debate-button ${status.toLowerCase()}`}>
          {getButtonText(status)}
        </button>
      </div>
    </div>
  );
};

export default DebateCard; 