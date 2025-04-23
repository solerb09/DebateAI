import React from 'react';
import '../styles/PerformanceStats.css';

function PerformanceStats({ stats }) {
  // If stats is in the new format with scores and explanations, transform it
  const displayStats = stats.scores ? [
    { name: 'Argument Quality', score: stats.scores.argument_quality },
    { name: 'Topic Understanding', score: stats.scores.topic_understanding },
    { name: 'Communication Skills', score: stats.scores.communication_skills }
  ] : stats;

  return (
    <div className="performance-stats-container">
      <div className="performance-stats-header">
        <i className="stats-icon"></i>
        <h2>Performance Stats</h2>
      </div>
      
      <div className="stats-list">
        {displayStats.map((stat, index) => (
          <div key={index} className="stat-row">
            <div className="stat-name">{stat.name}</div>
            <div className="stat-score">{stat.score}/10</div>
            <div className="stat-bar-container">
              <div 
                className="stat-bar-fill" 
                style={{ width: `${(stat.score / 10) * 100}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PerformanceStats; 