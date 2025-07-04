import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

  // Simple caching for debates data
  const [debatesCache, setDebatesCache] = useState(new Map());

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

  // Optimized fetch debates with parallel queries and better filtering
  const fetchDebates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check cache first
      const cacheKey = `${selectedCategory}-${sortBy}-${searchQuery}`;
      if (debatesCache.has(cacheKey)) {
        setDebates(debatesCache.get(cacheKey));
        setLoading(false);
        return;
      }

      // Build optimized query with proper joins and filtering
      let query = supabase
        .from('debate_topics')
        .select(`
          id,
          title,
          description,
          created_at,
          categories!inner(id, name),
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

      // Apply category filter efficiently at database level
      if (selectedCategory !== 'All Categories') {
        query = query.eq('categories.name', selectedCategory);
      }

      // Apply search filter at database level
      if (searchQuery.trim()) {
        query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      const { data: topics, error: topicsError } = await query;

      if (topicsError) throw topicsError;

      // Get all unique user IDs from participants
      const userIds = topics
        .flatMap(topic => topic.debate_rooms)
        .flatMap(room => room?.debate_participants || [])
        .map(participant => participant?.user_id)
        .filter(Boolean);

      // Fetch usernames in a single efficient query
      let userMap = new Map();
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, username')
          .in('id', [...new Set(userIds)]); // Remove duplicates
        
        userMap = new Map(users?.map(user => [user.id, user.username]) || []);
      }

      // Process debates with fetched user data
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

      // Cache the results
      setDebatesCache(prev => {
        const newCache = new Map(prev);
        newCache.set(cacheKey, processedDebates);
        // Keep only last 10 cache entries to prevent memory issues
        if (newCache.size > 10) {
          const firstKey = newCache.keys().next().value;
          newCache.delete(firstKey);
        }
        return newCache;
      });

      setDebates(processedDebates);
    } catch (err) {
      console.error('Error fetching debates:', err);
      setError(err.message || 'Failed to load debates');
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, sortBy, searchQuery, debatesCache]);

  // Effect to fetch debates when filters change
  useEffect(() => {
    fetchDebates();
  }, [fetchDebates]);

  // Memoized filtering for activeTab to avoid refetching data
  const filteredDebates = useMemo(() => {
    if (!debates.length) return [];

    return debates.filter(debate => {
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
  }, [debates, activeTab]);

  const handleDebateClick = (debate) => {
    // If debate is completed, go to results page, otherwise go to debate room
    if (debate.status === 'completed') {
      navigate(`/debates/${debate.roomId}/results`);
    } else {
      navigate(`/debates/${debate.roomId}`);
    }
  };

  if (loading) {
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
          {/* Skeleton FilterBox */}
          <div className="filters-sidebar">
            <div className="search-filter-section">
              <h2>Search & Filter</h2>
              <div className="search-input-container">
                <input type="text" placeholder="Loading..." className="search-input" disabled />
              </div>
              
              <div className="filter-section">
                <h3>Category</h3>
                <select className="filter-select" disabled>
                  <option>Loading...</option>
                </select>
              </div>

              <div className="filter-section">
                <h3>Sort By</h3>
                <select className="filter-select" disabled>
                  <option>Loading...</option>
                </select>
              </div>
            </div>
          </div>

          <div className="debates-section">
            <div className="debate-tabs">
              {['Live Now', 'Upcoming', 'Past Debates'].map(tab => (
                <button key={tab} className="tab-btn" disabled>
                  {tab}
                </button>
              ))}
            </div>

            {/* Skeleton Debate Cards */}
            <div className="debates-grid">
              {[...Array(6)].map((_, index) => (
                <div key={index} className="debate-card-skeleton">
                  <div className="skeleton-header">
                    <div className="skeleton-status"></div>
                    <div className="skeleton-category"></div>
                  </div>
                  <div className="skeleton-title"></div>
                  <div className="skeleton-description"></div>
                  <div className="skeleton-participants">
                    <div className="skeleton-participant"></div>
                    <div className="skeleton-vs">vs</div>
                    <div className="skeleton-participant"></div>
                  </div>
                  <div className="skeleton-meta">
                    <div className="skeleton-date"></div>
                    <div className="skeleton-duration"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
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
        <div className="error-container">
          <div className="error-content">
            <div className="error-icon">⚠️</div>
            <h3>Unable to load debates</h3>
            <p className="error-message">{error}</p>
            <button className="retry-button" onClick={fetchDebates}>
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          debates={filteredDebates}
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
            {filteredDebates.length === 0 ? (
              <div className="no-debates-message">
                {searchQuery.trim() 
                  ? `No debates found matching "${searchQuery}"`
                  : 'No debates found for the selected filters.'
                }
              </div>
            ) : (
              filteredDebates.map(debate => (
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