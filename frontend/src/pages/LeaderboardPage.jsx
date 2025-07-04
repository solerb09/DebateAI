import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import LeaderboardTable from '../components/LeaderboardTable';
import PerformerCard from '../components/PerformerCard';
import '../styles/LeaderboardPage.css';

function LeaderboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeFilter, setTimeFilter] = useState('All Time');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [debaters, setDebaters] = useState([]);
  const [topPerformers, setTopPerformers] = useState({
    mostWins: null,
    highestWinRate: null
  });
  const [categories, setCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Optimized data fetching with combined queries
  const fetchLeaderboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch both categories and users in parallel
      const [categoriesResult, usersResult] = await Promise.all([
        supabase.from('categories').select('id, name'),
        supabase.from('users').select('id, username, bio, wins, losses')
      ]);

      if (categoriesResult.error) throw categoriesResult.error;
      if (usersResult.error) throw usersResult.error;

      setCategories(categoriesResult.data || []);

      // Get enhanced user data
      const topUsers = await processUserData(usersResult.data || []);
      
      // Sort by win rate instead of wins
      const sortedUsers = topUsers.sort((a, b) => (b.winRate || 0) - (a.winRate || 0));
      
      // Reassign ranks based on new sorting
      sortedUsers.forEach((user, index) => {
        user.rank = index + 1;
      });
      
      setDebaters(sortedUsers);

      // Calculate top performers
      const performers = calculateTopPerformers(sortedUsers);
      setTopPerformers(performers);

    } catch (err) {
      console.error('Error fetching leaderboard data:', err);
      setError('Failed to load leaderboard data');
    } finally {
      setLoading(false);
    }
  }, [timeFilter, categoryFilter]);

  useEffect(() => {
    fetchLeaderboardData();
  }, [fetchLeaderboardData]);

  // Process user data to add additional stats - OPTIMIZED VERSION
  const processUserData = async (users) => {
    if (users.length === 0) return [];

    // Get all user IDs
    const userIds = users.map(user => user.id);

    // Single query to get all participation data with categories and scores
    const { data: allParticipations, error: participationsError } = await supabase
      .from('debate_participants')
      .select(`
        user_id,
        score_breakdown,
        debate_rooms(
          id,
          debate_topics(
            id,
            category_id,
            categories(name)
          )
        )
      `)
      .in('user_id', userIds);

    if (participationsError) {
      console.error('Error fetching participations:', participationsError);
    }

    // Group participation data by user
    const userParticipationMap = new Map();
    const userScoresMap = new Map();

    if (allParticipations) {
      allParticipations.forEach(participation => {
        const userId = participation.user_id;
        
        // Group participations for category counting
        if (!userParticipationMap.has(userId)) {
          userParticipationMap.set(userId, []);
        }
        userParticipationMap.get(userId).push(participation);

        // Group scores for average calculation
        if (participation.score_breakdown && 
            participation.score_breakdown.scores && 
            typeof participation.score_breakdown.scores.total === 'number') {
          
          if (!userScoresMap.has(userId)) {
            userScoresMap.set(userId, []);
          }
          userScoresMap.get(userId).push(participation.score_breakdown.scores.total);
        }
      });
    }

    // Process each user with the pre-fetched data
    const enhancedUsers = users.map((user, index) => {
      // Calculate total debates
      const totalDebates = (user.wins || 0) + (user.losses || 0);
      
      // Calculate win rate
      const winRate = totalDebates > 0 
        ? Math.round(((user.wins || 0) / totalDebates) * 100)
        : 0;

      // Calculate top category from pre-fetched data
      let topCategory = 'N/A';
      const userParticipations = userParticipationMap.get(user.id) || [];
      
      if (userParticipations.length > 0) {
        const categoryCount = {};
        userParticipations.forEach(participation => {
          const categoryName = participation.debate_rooms?.debate_topics?.categories?.name;
          if (categoryName) {
            categoryCount[categoryName] = (categoryCount[categoryName] || 0) + 1;
          }
        });

        // Find the category with most debates
        let maxCount = 0;
        Object.entries(categoryCount).forEach(([category, count]) => {
          if (count > maxCount) {
            maxCount = count;
            topCategory = category;
          }
        });
      }

      // Calculate average score from pre-fetched data
      let avgScore = 0;
      const userScores = userScoresMap.get(user.id) || [];
      
      if (userScores.length > 0) {
        const sum = userScores.reduce((acc, score) => acc + score, 0);
        avgScore = (sum / userScores.length).toFixed(1);
      }

      return {
        ...user,
        rank: index + 1, // This will be reassigned after sorting
        totalDebates,
        winRate,
        topCategory,
        averageScore: avgScore
      };
    });

    return enhancedUsers;
  };

  // Calculate top performers for the sidebar - OPTIMIZED
  const calculateTopPerformers = useCallback((users) => {
    // Sort by different metrics
    const sortedByWins = [...users].sort((a, b) => (b.wins || 0) - (a.wins || 0));
    
    // Filter users that have at least 5 debates first
    const eligibleForWinRate = users.filter(user => (user.totalDebates || 0) >= 5);
    
    // Then sort by win rate
    const sortedByWinRate = [...eligibleForWinRate].sort((a, b) => (b.winRate || 0) - (a.winRate || 0));

    // Make sure we have valid data for both categories
    const mostWins = sortedByWins.length > 0 ? sortedByWins[0] : null;
    const highestWinRate = sortedByWinRate.length > 0 ? sortedByWinRate[0] : null;

    return {
      mostWins,
      highestWinRate
    };
  }, []);

  // Filter debaters based on search query - OPTIMIZED
  const filteredDebaters = useMemo(() => {
    if (!searchQuery) return debaters;
    
    const lowerSearchQuery = searchQuery.toLowerCase();
    return debaters.filter(debater => 
      debater.username.toLowerCase().includes(lowerSearchQuery)
    );
  }, [debaters, searchQuery]);

  if (loading) {
    return (
      <div className="leaderboard-page">
        <div className="leaderboard-header">
          <h1>Leaderboard</h1>
          <p className="subtitle">See the top debaters and their performance statistics</p>
        </div>

        <div className="leaderboard-content">
          <div className="leaderboard-main">
            <div className="leaderboard-top-section">
              <h2>Top Debaters</h2>
              <p className="rankings-subtitle">Loading rankings...</p>
              
              <div className="leaderboard-filters">
                <div className="filter-dropdown">
                  <select disabled>
                    <option>Loading...</option>
                  </select>
                </div>
                <div className="filter-dropdown">
                  <select disabled>
                    <option>Loading...</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Skeleton loading for table */}
            <div className="leaderboard-table-skeleton">
              {[...Array(8)].map((_, index) => (
                <div key={index} className="skeleton-row">
                  <div className="skeleton-cell skeleton-rank"></div>
                  <div className="skeleton-cell skeleton-name"></div>
                  <div className="skeleton-cell skeleton-category"></div>
                  <div className="skeleton-cell skeleton-stats"></div>
                  <div className="skeleton-cell skeleton-stats"></div>
                  <div className="skeleton-cell skeleton-stats"></div>
                  <div className="skeleton-cell skeleton-score"></div>
                </div>
              ))}
            </div>
          </div>

          <div className="leaderboard-sidebar">
            <div className="find-debater-section">
              <h2>Find a Debater</h2>
              <div className="search-input">
                <input type="text" placeholder="Loading..." disabled />
              </div>
            </div>

            <div className="top-performers-section">
              <h2>Top Performers</h2>
              <p className="performers-subtitle">Loading top performers...</p>
              
              <div className="performers-list">
                {[...Array(2)].map((_, index) => (
                  <div key={index} className="performer-card-skeleton">
                    <div className="skeleton-avatar"></div>
                    <div className="skeleton-performer-info">
                      <div className="skeleton-title"></div>
                      <div className="skeleton-subtitle"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="leaderboard-page">
        <div className="leaderboard-header">
          <h1>Leaderboard</h1>
          <p className="subtitle">See the top debaters and their performance statistics</p>
        </div>
        <div className="leaderboard-container error">
          <div className="error-content">
            <div className="error-icon">⚠️</div>
            <h3>Unable to load leaderboard</h3>
            <p className="error-message">{error}</p>
            <button 
              className="retry-button" 
              onClick={fetchLeaderboardData}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Add debug logs
  console.log("Current top performers:", topPerformers);

  return (
    <div className="leaderboard-page">
      <div className="leaderboard-header">
        <h1>Leaderboard</h1>
        <p className="subtitle">See the top debaters and their performance statistics</p>
      </div>

      <div className="leaderboard-content">
        <div className="leaderboard-main">
          <div className="leaderboard-top-section">
            <h2>Top Debaters</h2>
            <p className="rankings-subtitle">Ranked by win rate</p>

            <div className="leaderboard-filters">
              <div className="filter-dropdown">
                <select 
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value)}
                >
                  <option value="All Time">All Time</option>
                  <option value="This Month">This Month</option>
                  <option value="This Week">This Week</option>
                </select>
              </div>

              <div className="filter-dropdown">
                <select 
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="All Categories">All Categories</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.name}>{category.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <LeaderboardTable debaters={filteredDebaters} />
        </div>

        <div className="leaderboard-sidebar">
          <div className="find-debater-section">
            <h2>Find a Debater</h2>
            <div className="search-input">
              <input
                type="text"
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <i className="search-icon"></i>
            </div>
          </div>

          <div className="top-performers-section">
            <h2>Top Performers</h2>
            <p className="performers-subtitle">Highest rated debaters this month</p>

            <div className="performers-list">
              {topPerformers.mostWins && (
                <PerformerCard
                  type="wins"
                  title="Most Wins"
                  user={topPerformers.mostWins}
                  subtitle={`${topPerformers.mostWins.wins || 0} wins`}
                  detail={`out of ${topPerformers.mostWins.totalDebates || 0} possible`}
                />
              )}

              {topPerformers.highestWinRate && (
                <PerformerCard
                  type="winRate"
                  title="Highest Win Rate"
                  user={topPerformers.highestWinRate}
                  subtitle={`${topPerformers.highestWinRate.winRate || 0}% win rate`}
                  detail="minimum 5 debates"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LeaderboardPage; 