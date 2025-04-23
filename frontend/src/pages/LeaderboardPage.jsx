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
    highestWinRate: null,
    mostImproved: null
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
          `)
          .order('wins', { ascending: false });

        if (userError) throw userError;

        // Get top debaters with additional data
        const topUsers = await processUserData(userData || []);
        setDebaters(topUsers);

        // Calculate top performers
        const performers = calculateTopPerformers(topUsers);
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

      // Fetch average score
      const { data: scores, error: scoresError } = await supabase
        .from('debate_participants')
        .select('final_score')
        .eq('user_id', user.id)
        .not('final_score', 'is', null);

      let avgScore = 0;
      if (!scoresError && scores && scores.length > 0) {
        const sum = scores.reduce((acc, curr) => acc + (curr.final_score || 0), 0);
        avgScore = (sum / scores.length).toFixed(1);
      }

      return {
        ...user,
        rank: index + 1,
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
    const sortedByWinRate = [...users]
      .filter(user => (user.totalDebates || 0) >= 5) // Minimum 5 debates
      .sort((a, b) => (b.winRate || 0) - (a.winRate || 0));

    // For most improved, we would need historical data
    // This is a placeholder implementation
    const mostImproved = {
      username: 'Jennifer Lee',
      improvement: '+35%',
      timeframe: 'this month'
    };

    return {
      mostWins: sortedByWins[0] || null,
      highestWinRate: sortedByWinRate[0] || null,
      mostImproved: mostImproved
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
            <p className="rankings-subtitle">All-time rankings</p>

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

              {topPerformers.mostImproved && (
                <PerformerCard
                  type="improved"
                  title="Most Improved"
                  user={{ username: topPerformers.mostImproved.username }}
                  subtitle={`${topPerformers.mostImproved.improvement} improvement`}
                  detail={topPerformers.mostImproved.timeframe}
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