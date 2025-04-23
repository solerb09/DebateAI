import React, { useState, useEffect } from 'react';
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

  // Fetch debaters data from Supabase
  useEffect(() => {
    const fetchLeaderboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch categories
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('categories')
          .select('id, name');

        if (categoriesError) throw categoriesError;
        setCategories(categoriesData || []);

        // Fetch users with their debate statistics
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select(`
            id, 
            username,
            bio,
            wins,
            losses
          `);

        if (userError) throw userError;

        // Get top debaters with additional data
        const topUsers = await processUserData(userData || []);
        
        // Sort by win rate instead of wins
        const sortedUsers = topUsers.sort((a, b) => (b.winRate || 0) - (a.winRate || 0));
        
        // Reassign ranks based on new sorting
        sortedUsers.forEach((user, index) => {
          user.rank = index + 1;
        });
        
        setDebaters(sortedUsers);

        // Calculate top performers
        const performers = calculateTopPerformers(sortedUsers);
        console.log("Top performers:", performers); // Debug log
        setTopPerformers(performers);

      } catch (err) {
        console.error('Error fetching leaderboard data:', err);
        setError('Failed to load leaderboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboardData();
  }, [timeFilter, categoryFilter]);

  // Process user data to add additional stats
  const processUserData = async (users) => {
    const enhancedUsers = await Promise.all(users.map(async (user, index) => {
      // Calculate total debates
      const totalDebates = (user.wins || 0) + (user.losses || 0);
      
      // Calculate win rate
      const winRate = totalDebates > 0 
        ? Math.round(((user.wins || 0) / totalDebates) * 100)
        : 0;

      // Fetch user's top category
      const { data: participations, error: participationsError } = await supabase
        .from('debate_participants')
        .select(`
          id,
          debate_rooms(
            id,
            debate_topics(
              id,
              category_id,
              categories(name)
            )
          )
        `)
        .eq('user_id', user.id);

      let topCategory = 'N/A';
      if (!participationsError && participations && participations.length > 0) {
        // Count categories
        const categoryCount = {};
        participations.forEach(participation => {
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

      // Fetch average score - updated to get scores out of 30
      const { data: scores, error: scoresError } = await supabase
        .from('debate_participants')
        .select(`
          id,
          score_breakdown
        `)
        .eq('user_id', user.id)
        .not('score_breakdown', 'is', null);

      let avgScore = 0;
      if (!scoresError && scores && scores.length > 0) {
        // Filter valid scores (those with score_breakdown that has scores.total)
        const validScores = scores.filter(item => 
          item.score_breakdown && 
          item.score_breakdown.scores && 
          typeof item.score_breakdown.scores.total === 'number'
        );
        
        if (validScores.length > 0) {
          // Calculate average of total scores
          const sum = validScores.reduce((acc, curr) => {
            return acc + curr.score_breakdown.scores.total;
          }, 0);
          
          avgScore = (sum / validScores.length).toFixed(1);
          console.log(`User ${user.username} has average score: ${avgScore}/30 from ${validScores.length} debates`);
        }
      }

      return {
        ...user,
        rank: index + 1, // This will be reassigned after sorting
        totalDebates,
        winRate,
        topCategory,
        averageScore: avgScore
      };
    }));

    return enhancedUsers;
  };

  // Calculate top performers for the sidebar
  const calculateTopPerformers = (users) => {
    // Sort by different metrics
    const sortedByWins = [...users].sort((a, b) => (b.wins || 0) - (a.wins || 0));
    
    // Filter users that have at least 5 debates first
    const eligibleForWinRate = users.filter(user => (user.totalDebates || 0) >= 5);
    console.log("Eligible users for win rate:", eligibleForWinRate.length); // Debug log
    
    // Then sort by win rate
    const sortedByWinRate = [...eligibleForWinRate].sort((a, b) => (b.winRate || 0) - (a.winRate || 0));
    console.log("Sorted by win rate:", sortedByWinRate.map(u => u.username)); // Debug log

    // Make sure we have valid data for both categories
    const mostWins = sortedByWins.length > 0 ? sortedByWins[0] : null;
    const highestWinRate = sortedByWinRate.length > 0 ? sortedByWinRate[0] : null;

    return {
      mostWins,
      highestWinRate
    };
  };

  // Filter debaters based on search query
  const filteredDebaters = searchQuery
    ? debaters.filter(debater => 
        debater.username.toLowerCase().includes(searchQuery.toLowerCase()))
    : debaters;

  if (loading) {
    return (
      <div className="leaderboard-page">
        <div className="leaderboard-container loading">
          <h1>Leaderboard</h1>
          <p>Loading leaderboard data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="leaderboard-page">
        <div className="leaderboard-container error">
          <h1>Leaderboard</h1>
          <p className="error-message">{error}</p>
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