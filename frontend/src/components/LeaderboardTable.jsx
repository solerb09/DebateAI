import React from 'react';
import '../styles/LeaderboardTable.css';

function LeaderboardTable({ debaters }) {
  // Get trophy color based on rank
  const getTrophyColor = (rank) => {
    if (rank === 1) return 'gold';
    if (rank === 2) return 'silver';
    if (rank === 3) return 'bronze';
    return '';
  };

  return (
    <div className="leaderboard-table-container">
      <table className="leaderboard-table">
        <thead>
          <tr>
            <th className="rank-column">Rank</th>
            <th className="debater-column">Debater</th>
            <th className="wins-column">Wins</th>
            <th className="debates-column">Debates</th>
            <th className="win-rate-column">Win Rate</th>
            <th className="category-column">Top Category</th>
            <th className="score-column">Avg. Score</th>
          </tr>
        </thead>
        <tbody>
          {debaters.map((debater) => (
            <tr key={debater.id} className={debater.rank <= 3 ? 'top-ranked' : ''}>
              <td className="rank-column">
                {debater.rank <= 3 ? (
                  <div className={`trophy-icon ${getTrophyColor(debater.rank)}`}>
                    🏆
                  </div>
                ) : (
                  debater.rank
                )}
              </td>
              <td className="debater-column">
                <div className="debater-info">
                  <div className="debater-details">
                    <div className="debater-name">{debater.username}</div>
                    <div className="debater-title">{debater.bio?.split('\n')[0] || 'Debate Enthusiast'}</div>
                  </div>
                </div>
              </td>
              <td className="wins-column">{debater.wins || 0}</td>
              <td className="debates-column">{debater.totalDebates || 0}</td>
              <td className="win-rate-column">
                <div className="win-rate-display">
                  <div className="win-rate-text">{debater.winRate || 0}%</div>
                  <div className="win-rate-bar">
                    <div 
                      className="win-rate-fill" 
                      style={{ width: `${debater.winRate || 0}%` }}
                    ></div>
                  </div>
                </div>
              </td>
              <td className="category-column">
                <span className="category-badge">{debater.topCategory}</span>
              </td>
              <td className="score-column">{debater.averageScore || 0}/10</td>
            </tr>
          ))}
          
          {debaters.length === 0 && (
            <tr className="no-results">
              <td colSpan="7">No debaters found</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default LeaderboardTable; 