import React from 'react';
import '../styles/ScoreCard.css';

const ScoreCard = ({
  position,
  username,
  title,
  scores,
  isWinner
}) => {
  const {
    argument_quality,
    communication_skills,
    topic_understanding,
    total
  } = scores;

  return (
    <div className="score-card">
      <div className="score-card-header">
        <div className="position-title">
          <h2>{position}</h2>
          {isWinner && <span className="winner-badge">Winner</span>}
        </div>
        
        <div className="participant-info">
          <div className="avatar">
            {/* Placeholder circle for avatar */}
          </div>
          <div className="participant-details">
            <h3 className="participant-name">{username}</h3>
            <span className="participant-title">{title}</span>
          </div>
        </div>

        <div className="overall-score">
          <div className="score-label">Overall Score</div>
          <div className="score-value">
            {(total / 10).toFixed(1)}/10
          </div>
          <div className="score-bar">
            <div 
              className="score-fill" 
              style={{ width: `${(total / 100) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="score-details">
        <div className="score-item">
          <span className="metric">Argument Quality</span>
          <span className="value">{(argument_quality / 10).toFixed(1)}/10</span>
        </div>

        <div className="score-item">
          <span className="metric">Communication Skills</span>
          <span className="value">{(communication_skills / 10).toFixed(1)}/10</span>
        </div>

        <div className="score-item">
          <span className="metric">Topic Understanding</span>
          <span className="value">{(topic_understanding / 10).toFixed(1)}/10</span>
        </div>
      </div>
    </div>
  );
};

export default ScoreCard; 