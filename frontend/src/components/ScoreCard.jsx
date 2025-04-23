import React, { useState } from 'react';
import '../styles/ScoreCard.css';

const ScoreCard = ({ participant, score_breakdown, isWinner }) => {
  const [showExplanations, setShowExplanations] = useState({
    argument: false,
    communication: false,
    topic: false
  });

  if (!score_breakdown) {
    return (
      <div className={`score-card ${isWinner ? 'winner' : ''}`}>
        <div className="score-card-header">
          <div className="position-title">
            <h2>{participant.side === 'pro' ? 'Pro Position' : 'Con Position'}</h2>
            {isWinner && <span className="winner-badge">Winner</span>}
          </div>
          <div className="participant-info">
            <h3 className="participant-name">{participant.username}</h3>
            <p className="participant-title">{participant.side === 'pro' ? 'AI Ethics Researcher' : 'Debate Participant'}</p>
          </div>
        </div>
        <p>Scores not available yet</p>
      </div>
    );
  }

  const toggleExplanation = (category) => {
    setShowExplanations(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // Function to determine the highest scoring category
  const getHighestScoringCategory = () => {
    const scores = {
      argument: score_breakdown.argument_quality.score,
      communication: score_breakdown.communication_skills.score,
      topic: score_breakdown.topic_understanding.score
    };

    const maxScore = Math.max(...Object.values(scores));
    const highestCategories = Object.entries(scores)
      .filter(([_, score]) => score === maxScore)
      .map(([category]) => category);

    // Only return if there's exactly one highest category (no ties)
    return highestCategories.length === 1 ? highestCategories[0] : null;
  };

  const highestCategory = getHighestScoringCategory();

  const renderScoreItem = (score, label, explanation, category) => (
    <div className={`score-item ${category === highestCategory ? 'highest-score' : ''}`} onClick={() => toggleExplanation(category)}>
      <div className="score-row">
        <span className="metric">{label}</span>
        <span className="value">{score}/10</span>
      </div>
      {showExplanations[category] && explanation && (
        <p className="explanation">{explanation}</p>
      )}
    </div>
  );

  const totalScore = score_breakdown.total_score;

  return (
    <div className={`score-card ${isWinner ? 'winner' : ''}`}>
      <div className="score-card-header">
        <div className="position-title">
          <h2>{participant.side === 'pro' ? 'Pro Position' : 'Con Position'}</h2>
          {isWinner && <span className="winner-badge">Winner</span>}
        </div>
        <div className="participant-info">
          <h3 className="participant-name">{participant.username}</h3>
          <p className="participant-title">{participant.side === 'pro' ? 'AI Ethics Researcher' : 'Debate Participant'}</p>
        </div>
      </div>

      <div className="overall-score">
        <div className="score-bar-container">
          <div className="score-bar" style={{ width: `${(totalScore / 30) * 100}%` }} />
          <span className="score-value">{totalScore}/30</span>
        </div>
      </div>

      <div className="score-details">
        {renderScoreItem(
          score_breakdown.argument_quality.score,
          'Argument Quality',
          score_breakdown.argument_quality.explanation,
          'argument'
        )}
        {renderScoreItem(
          score_breakdown.communication_skills.score,
          'Communication Skills',
          score_breakdown.communication_skills.explanation,
          'communication'
        )}
        {renderScoreItem(
          score_breakdown.topic_understanding.score,
          'Topic Understanding',
          score_breakdown.topic_understanding.explanation,
          'topic'
        )}
      </div>
    </div>
  );
};

export default ScoreCard; 