import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
  const [activeTab, setActiveTab] = useState('Live Now');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [sortBy, setSortBy] = useState('Newest First');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { authState } = useAuth();

  // Initialize search query from URL parameter
  useEffect(() => {
    const urlSearchQuery = searchParams.get('search');
    if (urlSearchQuery) {
      setSearchQuery(urlSearchQuery);
    }
  }, [searchParams]);

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
  const fetchDebates = useCallback(async () => {
    try {
      setLoading(true);
      
      // First get the category ID if a specific category is selected
      let categoryId = null;
      if (selectedCategory !== 'All Categories') {
        const { data: categoryData, error: categoryError } = await supabase
          .from('categories')
          .select('id')
          .eq('name', selectedCategory)
          .single();
        
        if (categoryError) {
          console.error('Error fetching category ID:', categoryError);
        } else if (categoryData) {
          categoryId = categoryData.id;
        }
      }
      
      // Build the base query
      let query = supabase
        .from('debate_topics')
        .select(`
          id,
          title,
          description,
          created_at,
          category_id,
          categories!debate_topics_category_id_fkey(name),
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
      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }

      // Apply search filter if there's a search query
      if (searchQuery.trim()) {
        query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
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

        // Map database status to DebateCard status
        let cardStatus;
        switch(room.status) {
          case 'active':
            cardStatus = 'Live';
            break;
          case 'completed':
            cardStatus = 'completed';
            break;
          case 'waiting':
          default:
            cardStatus = 'Upcoming';
        }

        return {
          id: topic.id,
          roomId: room.id,
          title: topic.title,
          description: topic.description,
          category: topic.categories?.name,
          status: cardStatus,
          proponent: proParticipant ? (userMap.get(proParticipant.user_id) || 'Anonymous') : 'Waiting for opponent',
          opponent: conParticipant ? (userMap.get(conParticipant.user_id) || 'Anonymous') : 'Waiting for opponent',
          participantCount: `${participants.length}/2`,
          date: room.created_at ? new Date(room.created_at).toLocaleDateString() : '2025-04-19',
          duration: '0:04:00'
        };
      });

      // Filter based on active tab
      const filteredDebates = processedDebates.filter(debate => {
        switch (activeTab) {
          case 'Live Now':
            return debate.status === 'Live';
          case 'Upcoming':
            return debate.status === 'Upcoming';
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
  }, [activeTab, selectedCategory, sortBy, searchQuery]);

  // Effect to fetch debates when filters change
  useEffect(() => {
    fetchDebates();
  }, [activeTab, selectedCategory, sortBy, searchQuery, fetchDebates]);

  const handleDebateClick = (debate) => {
    // If debate is completed, go to results page, otherwise go to debate room
    if (debate.status === 'completed') {
      navigate(`/debates/${debate.roomId}/results`);
    } else {
      navigate(`/debates/${debate.roomId}`);
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
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onSearch={setSearchQuery}
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
            {debates.length === 0 ? (
              <div className="no-debates-message">
                {searchQuery.trim() 
                  ? `No debates found matching "${searchQuery}"`
                  : 'No debates found for the selected filters.'
                }
              </div>
            ) : (
              debates.map(debate => (
                <DebateCard 
                  key={debate.id}
                  {...debate}
                  onClick={() => handleDebateClick(debate)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebateListPage; 