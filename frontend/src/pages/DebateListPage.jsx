import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import FilterBox from '../components/FilterBox';
import DebateCard from '../components/DebateCard';
import '../styles/DebateListPage.css';

/**
 * DebateListPage component - shows all available debate topics
 */
const DebateListPage = () => {
  const [debates, setDebates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('Upcoming');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [sortBy, setSortBy] = useState('Newest First');
  const navigate = useNavigate();
  const { authState } = useAuth();

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      
      if (error) {
        console.error('Error fetching categories:', error);
      } else {
        setCategories(data || []);
      }
    };

    fetchCategories();
  }, []);

  // Fetch debates
  useEffect(() => {
    const fetchDebates = async () => {
      try {
        setLoading(true);
        
        // First get the debates with their rooms and participants
        let query = supabase
          .from('debate_topics')
          .select(`
            id,
            title,
            description,
            created_at,
            categories(name),
            debate_rooms(
              id,
              status,
              created_at,
              debate_participants(
                user_id,
                side
              )
            )
          `)
          .order('created_at', { ascending: sortBy === 'Oldest First' });

        // Apply category filter if selected
        if (selectedCategory !== 'All Categories') {
          query = query.eq('categories.name', selectedCategory);
        }

        const { data: topics, error: topicsError } = await query;

        if (topicsError) throw topicsError;

        // Get all user IDs from participants
        const userIds = topics
          .flatMap(topic => topic.debate_rooms)
          .flatMap(room => room?.debate_participants || [])
          .map(participant => participant?.user_id)
          .filter(Boolean);

        // Fetch usernames in a separate query
        const { data: users } = await supabase
          .from('users')
          .select('id, username')
          .in('id', userIds);

        // Create a map for quick username lookups
        const userMap = new Map(users?.map(user => [user.id, user.username]) || []);

        // Process the debates
        const processedDebates = topics.map(topic => {
          const room = topic.debate_rooms[0] || {};
          const participants = room.debate_participants || [];
          
          const proParticipant = participants.find(p => p.side === 'pro');
          const conParticipant = participants.find(p => p.side === 'con');

          return {
            id: topic.id,
            roomId: room.id,
            title: topic.title,
            description: topic.description,
            category: topic.categories?.name,
            status: room.status || 'upcoming',
            proponent: proParticipant ? (userMap.get(proParticipant.user_id) || 'Anonymous') : 'Waiting for opponent',
            opponent: conParticipant ? (userMap.get(conParticipant.user_id) || 'Anonymous') : 'Waiting for opponent',
            participantCount: `${participants.length}/2`,
            date: room.created_at ? new Date(room.created_at).toLocaleDateString() : '2025-04-19',
            duration: '1:00:00'
          };
        });

        // Filter based on active tab
        const filteredDebates = processedDebates.filter(debate => {
          switch (activeTab) {
            case 'Live Now':
              return debate.status === 'active';
            case 'Upcoming':
              return debate.status === 'upcoming' || debate.status === 'waiting';
            case 'Past Debates':
              return debate.status === 'completed';
            default:
              return true;
          }
        });

        setDebates(filteredDebates);
      } catch (err) {
        console.error('Error fetching debates:', err);
        setError(err.message || 'Failed to load debates');
      } finally {
        setLoading(false);
      }
    };

    fetchDebates();
  }, [activeTab, selectedCategory, sortBy]);

  const handleJoinDebate = (debateId, status) => {
    // Navigate to the appropriate page based on debate status
    if (status === 'completed') {
      navigate(`/debates/${debateId}/results`);
    } else {
      navigate(`/debates/${debateId}`);
    }
  };

  if (loading) return <div className="loading">Loading debates...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="debate-list-page">
      <div className="page-header">
        <div>
          <h1>Browse Debates</h1>
          <p className="subtitle">Find and join debates on topics that interest you</p>
        </div>
        <Link to="/debates/create" className="create-debate-btn">
          Create Debate
        </Link>
      </div>

      <div className="debate-list-content">
        <FilterBox
          categories={categories}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          sortBy={sortBy}
          setSortBy={setSortBy}
          debates={debates}
        />

        <div className="debates-section">
          <div className="debate-tabs">
            {['Live Now', 'Upcoming', 'Past Debates'].map(tab => (
              <button
                key={tab}
                className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="debates-grid">
            {debates.map(debate => (
              <DebateCard 
                key={debate.id}
                {...debate}
                onClick={() => navigate(`/debates/${debate.roomId}`)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebateListPage; 