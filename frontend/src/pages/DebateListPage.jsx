import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';

/**
 * DebateListPage component - shows all available debate topics
 */
const DebateListPage = () => {
  const [debates, setDebates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { authState } = useAuth();

  // Fetch debates from the database
  useEffect(() => {
    const fetchDebates = async () => {
      try {
        setLoading(true);
        
        // Fetch debate topics with their categories
        const { data: topics, error: topicsError } = await supabase
          .from('debate_topics')
          .select(`
            *,
            categories(name),
            debate_rooms(
              id,
              status
            )
          `)
          .order('created_at', { ascending: false });
          
        if (topicsError) {
          throw topicsError;
        }
        
        // Process the data to make it easier to work with
        const processedTopics = topics.map(topic => {
          // Find any room for this topic (waiting, active, or completed)
          const availableRoom = topic.debate_rooms.find(room => 
            room.status === 'waiting' || room.status === 'active'
          );
          
          // Also look for completed debates
          const completedRoom = topic.debate_rooms.find(room => 
            room.status === 'completed'
          );
          
          return {
            id: topic.id,
            title: topic.title,
            description: topic.description,
            category: topic.categories?.name || 'Uncategorized',
            status: topic.status,
            createdAt: new Date(topic.created_at).toLocaleString(),
            roomId: availableRoom?.id || completedRoom?.id,
            roomStatus: availableRoom?.status || completedRoom?.status
          };
        });
        
        setDebates(processedTopics);
      } catch (err) {
        console.error('Error fetching debates:', err);
        setError('Failed to load debates. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchDebates();
  }, []);

  const handleJoinDebate = (debateId, status) => {
    // Navigate to the appropriate page based on debate status
    if (status === 'completed') {
      navigate(`/debates/${debateId}/results`);
    } else {
      navigate(`/debates/${debateId}`);
    }
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
                <span>Category: {debate.category}</span>
                <span style={{ marginLeft: 'auto' }}>
                  {debate.createdAt}
                </span>
              </div>
              {debate.roomId ? (
                <button
                  onClick={() => handleJoinDebate(debate.roomId, debate.roomStatus)}
                  className="btn"
                  style={{ 
                    marginTop: '1rem',
                    backgroundColor: debate.roomStatus === 'completed' ? '#4CAF50' : '',
                    color: debate.roomStatus === 'completed' ? 'white' : ''
                  }}
                >
                  {debate.roomStatus === 'waiting' 
                    ? 'Join Debate' 
                    : debate.roomStatus === 'completed' 
                      ? 'View Results' 
                      : 'View Debate'
                  }
                </button>
              ) : (
                <button
                  onClick={() => navigate(`/debates/create?topicId=${debate.id}`)}
                  className="btn"
                  style={{ marginTop: '1rem' }}
                >
                  Start Debate
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DebateListPage; 