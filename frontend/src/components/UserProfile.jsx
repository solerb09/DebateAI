import React from 'react';
import Button from './Button';
import '../styles/UserProfile.css';

function UserProfile({ userData, onEditProfile }) {
  const { username, bio, memberSince, totalDebates, winRate, winLossRatio } = userData;

  return (
    <div className="user-profile-container">
      <div className="user-avatar">
        <div className="avatar-circle"></div>
      </div>
      
      <div className="user-info">
        <h1 className="user-name">{username}</h1>
        <p className="user-bio">{bio}</p>
        
        <div className="user-tags">
          {userData.tags && userData.tags.map((tag, index) => (
            <span key={index} className="user-tag">{tag}</span>
          ))}
        </div>
      </div>

      <div className="user-stats">
        <div className="stat-group">
          <div className="stat-column">
            <span className="stat-label">Member Since</span>
            <span className="stat-value">{memberSince}</span>
          </div>
          
          <div className="stat-column">
            <span className="stat-label">Total Debates</span>
            <span className="stat-value">{totalDebates}</span>
          </div>
        </div>
        
        <div className="stat-group">
          <div className="stat-column">
            <span className="stat-label">Win Rate</span>
            <span className="stat-value">{winRate}</span>
          </div>
          
          <div className="stat-column">
            <span className="stat-label">Win/Loss Ratio</span>
            <span className="stat-value">{winLossRatio}</span>
            <div className="ratio-bar">
              <div 
                className="ratio-fill" 
                style={{ 
                  width: `${(userData.wins / (userData.wins + userData.losses)) * 100}%`
                }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      <Button onClick={onEditProfile}>
        Edit Profile
      </Button>
    </div>
  );
}

export default UserProfile; 