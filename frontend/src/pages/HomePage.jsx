import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import SearchBar from '../components/SearchBar';
import TopicTag from '../components/TopicTag';
import DebateCard from '../components/DebateCard';
import '../styles/HomePage.css';

/**
 * Home page component - landing page for the application
 */
const HomePage = () => {
  const [featuredDebates, setFeaturedDebates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDebates = async () => {
      try {
        setLoading(true);
        
        // First, let's verify the query structure
        const { data: topics, error: topicsError } = await supabase
          .from('debate_topics')
          .select(`
            id,
            title,
            description,
            created_at,
            categories(name),
            debate_rooms!inner(
              id,
              status,
              created_at,
              debate_participants(
                user_id,
                side
              )
            )
          `)
          .order('created_at', { ascending: false });

        if (topicsError) {
          console.error('Supabase query error:', topicsError);
          throw new Error(`Failed to fetch debates: ${topicsError.message}`);
        }

        // Get user data in a separate query
        const userIds = topics
          .flatMap(topic => topic.debate_rooms)
          .flatMap(room => room.debate_participants)
          .map(participant => participant.user_id)
          .filter(Boolean);

        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('id, username')
          .in('id', userIds);

        if (usersError) {
          console.error('Error fetching users:', usersError);
        }

        // Create a map of user_id to username for quick lookup
        const userMap = new Map(users?.map(user => [user.id, user.username]) || []);

        // Process and organize debates
        const processedDebates = topics
          .map(topic => {
            try {
              const waitingRoom = topic.debate_rooms?.find(room => room.status === 'waiting');
              const completedRooms = topic.debate_rooms?.filter(room => room.status === 'completed') || [];
              
              if (!waitingRoom && completedRooms.length === 0) return null;

              const room = waitingRoom || completedRooms[0];
              if (!room) return null;

              const participants = room.debate_participants || [];

              const proParticipant = participants.find(p => p.side === 'pro');
              const conParticipant = participants.find(p => p.side === 'con');
              
              const participantCount = participants.length;

              return {
                id: topic.id,
                roomId: room.id,
                status: room.status === 'waiting' ? 'active' : 'Completed',
                title: topic.title,
                description: topic.description,
                proponent: proParticipant ? (userMap.get(proParticipant.user_id) || 'Anonymous') : 'Waiting for participant',
                opponent: conParticipant ? (userMap.get(conParticipant.user_id) || 'Anonymous') : 'Waiting for participant',
                duration: '0:04:00',
                datetime: new Date(room.created_at).toLocaleString(),
                participants: `${participantCount}/2`
              };
            } catch (err) {
              console.error('Error processing debate topic:', topic.id, err);
              return null;
            }
          })
          .filter(debate => debate !== null);

        // Filter to get featured debates
        const waitingDebates = processedDebates
          .filter(debate => debate.status === 'Waiting')
          .slice(0, 1);
        
        const completedDebates = processedDebates
          .filter(debate => debate.status === 'Completed')
          .slice(0, 2);

        setFeaturedDebates([...waitingDebates, ...completedDebates]);
      } catch (err) {
        console.error('Error fetching debates:', err);
        setError(err.message || 'Failed to load debates');
      } finally {
        setLoading(false);
      }
    };

    fetchDebates();
  }, []);

  const handleDebateClick = (roomId, status) => {
    if (status === 'Live') {
      navigate(`/debates/${roomId}`);
    } else {
      navigate(`/debates/${roomId}/results`);
    }
  };

  return (
    <div className="home-page">
      <div className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">
            Debate. Connect. Grow.
          </h1>
          <p className="hero-subtitle">
            Join our platform to engage in meaningful debates, challenge your perspectives, and improve your communication skills.
          </p>
          <div className="hero-buttons">
            <Link to="/debates/create" className="button button-primary">
              Start a Debate
            </Link>
            <Link to="/debates" className="button button-secondary">
              Browse Debates
            </Link>
          </div>
        </div>

        <div className="search-section">
          <SearchBar />
          <div className="trending-topics">
            <h2>Trending Topics</h2>
            <div className="topics-grid">
              <TopicTag>Climate Change</TopicTag>
              <TopicTag>AI Ethics</TopicTag>
              <TopicTag>Universal Healthcare</TopicTag>
              <TopicTag>Free Speech</TopicTag>
              <TopicTag>Economic Policy</TopicTag>
            </div>
          </div>
        </div>
      </div>

      <div className="featured-debates-section">
        <h2 className="featured-debates-title">Featured Debates</h2>
        <p className="featured-debates-subtitle">
          Join these upcoming debates or watch previous ones to learn from the best debaters on our platform.
        </p>
        {loading ? (
          <div className="loading">Loading debates...</div>
        ) : featuredDebates.length > 0 ? (
          <>
            <div className="debates-grid">
              {featuredDebates.map((debate) => (
                <DebateCard 
                  key={debate.roomId} 
                  {...debate} 
                  onClick={() => handleDebateClick(debate.roomId, debate.status)}
                />
              ))}
            </div>
            <div className="view-all-debates">
              <Link to="/debates" className="button button-secondary">
                View All Debates
              </Link>
            </div>
          </>
        ) : (
          <div className="no-debates">
            <p>No debates available at the moment.</p>
            <Link to="/debates/create" className="button button-primary">
              Create a Debate
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage; 