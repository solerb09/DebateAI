import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

/**
 * DebateListPage component - shows all available debate topics
 */
const DebateListPage = () => {
  const [debates, setDebates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Fetch debates from the API
  useEffect(() => {
    const fetchDebates = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/debates');
        
        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }
        
        const data = await response.json();
        setDebates(data);
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch debates:', err);
        setError('Failed to load debates. Please try again later.');
        setLoading(false);
      }
    };

    fetchDebates();
  }, []);

  const handleJoinDebate = (debateId) => {
    // Navigate to the debate room
    navigate(`/debates/${debateId}`);
  };

  if (loading) {
    return <div className="loading">Loading debates...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="debate-list-page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Available Debates</h1>
        <Link to="/debates/create" className="btn btn-accent">
          Create New Debate
        </Link>
      </div>

      {debates.length === 0 ? (
        <div className="no-debates card">
          <p>No debates available at the moment.</p>
          <p>Be the first to create a debate topic!</p>
          <Link to="/debates/create" className="btn" style={{ marginTop: '1rem' }}>
            Create Debate
          </Link>
        </div>
      ) : (
        <div className="debate-list">
          {debates.map((debate) => (
            <div key={debate.id} className="debate-card card">
              <h2>{debate.title}</h2>
              <p>{debate.description}</p>
              <div className="debate-meta" style={{ display: 'flex', marginTop: '1rem', fontSize: '0.9rem', color: 'var(--dark-gray)' }}>
                <span>Created by: {debate.creator}</span>
                <span style={{ marginLeft: 'auto' }}>
                  {new Date(debate.createdAt).toLocaleDateString()}
                </span>
              </div>
              <button
                onClick={() => handleJoinDebate(debate.id)}
                className="btn"
                style={{ marginTop: '1rem' }}
                disabled={debate.status !== 'open'}
              >
                {debate.status === 'open' ? 'Join Debate' : 'Debate In Progress'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DebateListPage; 