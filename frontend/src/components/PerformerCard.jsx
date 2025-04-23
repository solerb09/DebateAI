import React from 'react';
import '../styles/PerformerCard.css';

function PerformerCard({ type, title, user, subtitle, detail }) {
  // Get icon based on type
  const getIcon = () => {
    switch (type) {
      case 'wins':
        return '🏆';
      case 'winRate':
        return '🎯';
      case 'improved':
        return '📈';
      default:
        return '🏅';
    }
  };

  return (
    <div className={`performer-card ${type}`}>
      <div className="performer-icon">
        {getIcon()}
      </div>
      
      <div className="performer-content">
        <h3 className="performer-title">{title}</h3>
        <div className="performer-name">{user.username}</div>
        
        <div className="performer-stats">
          <div className="performer-main-stat">{subtitle}</div>
          <div className="performer-detail">{detail}</div>
        </div>
      </div>
    </div>
  );
}

export default PerformerCard; 