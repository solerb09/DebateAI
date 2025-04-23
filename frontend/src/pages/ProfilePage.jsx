import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import '../styles/ProfilePage.css';
import Header from '../components/Header';
import UserProfile from '../components/UserProfile';
import PerformanceStats from '../components/PerformanceStats';
import TopCategories from '../components/TopCategories';
import DebateHistory from '../components/DebateHistory';
import Button from '../components/Button';

function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [debatesLoading, setDebatesLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    bio: '',
  });
  const [error, setError] = useState(null);
  const [debatesError, setDebatesError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Profile data state
  const [profileData, setProfileData] = useState({
    username: '',
    bio: '',
    memberSince: '',
    totalDebates: 0,
    winRate: '0%',
    winLossRatio: '0 W - 0 L',
    wins: 0,
    losses: 0,
    tags: []
  });

  // Performance stats state
  const [performanceStats, setPerformanceStats] = useState([
    { name: 'Argument Quality', score: 0 },
    { name: 'Evidence Use', score: 0 },
    { name: 'Rebuttals', score: 0 },
    { name: 'Speaking Skills', score: 0 },
    { name: 'Critical Thinking', score: 0 }
  ]);

  // Top categories state
  const [topCategories, setTopCategories] = useState([]);

  // Debate history state
  const [debates, setDebates] = useState([]);

  // Fetch user debates from Supabase
  useEffect(() => {
    const fetchUserDebates = async () => {
      if (!user) return;
      
      try {
        setDebatesLoading(true);
        setDebatesError(null);
        
        // Get all debates the user has participated in
        const { data: participations, error: participationsError } = await supabase
          .from('debate_participants')
          .select(`
            id,
            room_id,
            side,
            score_breakdown,
            is_winner,
            joined_at,
            debate_rooms(
              id,
              status,
              created_at,
              ended_at,
              topic_id,
              debate_topics(
                id,
                title,
                description,
                category_id,
                categories(name)
              )
            )
          `)
          .eq('user_id', user.id)
          .order('joined_at', { ascending: false });

        if (participationsError) {
          throw new Error(participationsError.message);
        }

        // Get other participants for these debates
        const roomIds = participations.map(p => p.room_id);
        
        // Get all participants in these rooms
        const { data: allParticipants, error: participantsError } = await supabase
          .from('debate_participants')
          .select(`
            id,
            user_id,
            room_id,
            side,
            score_breakdown,
            is_winner
          `)
          .in('room_id', roomIds)
          .not('user_id', 'eq', user.id); // Exclude current user

        if (participantsError) {
          throw new Error(participantsError.message);
        }

        // Get usernames for all participants
        const participantIds = allParticipants.map(p => p.user_id);
        
        const { data: userProfiles, error: profilesError } = await supabase
          .from('users')
          .select('id, username')
          .in('id', participantIds);

        if (profilesError) {
          throw new Error(profilesError.message);
        }

        // Create map of user_id to username
        const usernameMap = {};
        userProfiles.forEach(u => {
          usernameMap[u.id] = u.username;
        });

        // Process debates
        const processedDebates = participations.map(participation => {
          const room = participation.debate_rooms;
          const topic = room?.debate_topics;
          
          // Find opponent
          const opponent = allParticipants.find(p => 
            p.room_id === participation.room_id && 
            p.side !== participation.side
          );
          
          const opponentName = opponent ? usernameMap[opponent.user_id] || 'Unknown' : 'No opponent';
          
          // Determine debate result
          const isCompleted = room?.status === 'completed';
          let result = 'In Progress';
          
          if (isCompleted) {
            if (participation.is_winner !== null) {
              result = participation.is_winner ? 'Won' : 'Lost';
            } else {
              result = 'Completed';
            }
          }
          
          // Calculate total score from score_breakdown if available
          const totalScore = participation.score_breakdown ? 
            Object.values(JSON.parse(participation.score_breakdown)).reduce((sum, val) => sum + val, 0) : 
            null;
          
          return {
            id: room.id,
            title: topic?.title || 'Unknown Debate',
            description: topic?.description || 'No description available',
            date: new Date(participation.joined_at).toLocaleDateString('en-US', {
              month: 'long', 
              day: 'numeric', 
              year: 'numeric'
            }),
            result: result,
            type: participation.side === 'pro' ? 'Pro' : 'Con',
            score: totalScore ? `${totalScore}/10` : 'N/A',
            opponent: opponentName,
            duration: calculateDuration(room.created_at, room.ended_at),
            category: topic?.categories?.name || 'Uncategorized'
          };
        });

        // Update wins/losses counts
        const wins = processedDebates.filter(d => d.result === 'Won').length;
        const losses = processedDebates.filter(d => d.result === 'Lost').length;
        const totalDebates = processedDebates.length;
        
        // Calculate win rate
        const winRate = totalDebates > 0 
          ? Math.round((wins / totalDebates) * 100) + '%' 
          : '0%';
          
        // Update profile data
        setProfileData(prev => ({
          ...prev,
          totalDebates,
          winRate,
          winLossRatio: `${wins} W - ${losses} L`,
          wins,
          losses
        }));

        // Process categories
        const categoryMap = {};
        processedDebates.forEach(debate => {
          if (!debate.category) return;
          
          if (!categoryMap[debate.category]) {
            categoryMap[debate.category] = {
              name: debate.category,
              wins: 0,
              losses: 0,
              debates: 0
            };
          }
          
          categoryMap[debate.category].debates++;
          
          if (debate.result === 'Won') {
            categoryMap[debate.category].wins++;
          } else if (debate.result === 'Lost') {
            categoryMap[debate.category].losses++;
          }
        });
        
        // Convert to array and calculate win rates
        const processedCategories = Object.values(categoryMap)
          .map(category => ({
            name: category.name,
            winRate: category.debates > 0 
              ? Math.round((category.wins / category.debates) * 100) + '%' 
              : '0%',
            wins: category.wins,
            debates: category.debates
          }))
          .sort((a, b) => b.wins - a.wins)
          .slice(0, 3); // Top 3 categories
          
        setTopCategories(processedCategories);
        setDebates(processedDebates);
        
        // Calculate performance stats from score_breakdown
        if (processedDebates.length > 0) {
          const scoreCategories = {
            'Argument Quality': 0,
            'Communication Skills': 0,
            'Topic Understanding': 0
          };
          
          let debatesWithScores = 0;
          
          participations.forEach(participation => {
            if (participation.score_breakdown) {
              try {
                const scores = JSON.parse(participation.score_breakdown);
                for (const [key, value] of Object.entries(scores)) {
                  if (scoreCategories.hasOwnProperty(key)) {
                    scoreCategories[key] += value;
                  }
                }
                debatesWithScores++;
              } catch (err) {
                console.error('Error parsing score breakdown:', err);
              }
            }
          });
          
          // Calculate average scores
          if (debatesWithScores > 0) {
            const updatedStats = Object.entries(scoreCategories).map(([name, score]) => ({
              name,
              score: Math.round((score / debatesWithScores) * 10) / 10
            }));
            
            setPerformanceStats(updatedStats);
          }
        }
      } catch (err) {
        console.error('Error fetching user debates:', err);
        setDebatesError('Failed to load debate history');
      } finally {
        setDebatesLoading(false);
      }
    };
    
    fetchUserDebates();
  }, [user]);

  // Helper function to calculate debate duration
  const calculateDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return 'Unknown';
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffInMinutes = Math.round((end - start) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m`;
    } else {
      const hours = Math.floor(diffInMinutes / 60);
      const minutes = diffInMinutes % 60;
      return `${hours}h ${minutes}m`;
    }
  };

  // Populate form and profile data with user data
  useEffect(() => {
    if (user) {
      // Format profile data for display
      const formattedData = {
        username: profile?.username || user?.user_metadata?.username || user.email,
        bio: profile?.bio || 'No bio available.',
        memberSince: profile?.created_at 
          ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
          : new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        totalDebates: profileData.totalDebates,
        winRate: profileData.winRate,
        winLossRatio: profileData.winLossRatio,
        wins: profileData.wins,
        losses: profileData.losses,
        tags: profile?.tags || []
      };
      
      setProfileData(prev => ({
        ...prev,
        ...formattedData
      }));
      
      setFormData({
        username: profile?.username || user?.user_metadata?.username || '',
        bio: profile?.bio || '',
      });
      
      setLoading(false);
    } else {
      navigate('/login');
    }
  }, [user, profile, navigate, profileData.totalDebates, profileData.winRate, profileData.winLossRatio, profileData.wins, profileData.losses]);

  const handleEditProfile = () => {
    setEditing(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError(null);
      
      // Update the profile in the database
      const { error } = await supabase
        .from('users')
        .update({
          username: formData.username,
          bio: formData.bio,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
      
      if (error) throw error;
      
      // Update user metadata
      const { error: metadataError } = await supabase.auth.updateUser({
        data: { username: formData.username }
      });
      
      if (metadataError) throw metadataError;
      
      setSuccess('Profile updated successfully!');
      setEditing(false);
      
      // Refresh profile data in context
      refreshProfile();
      
    } catch (error) {
      setError(error.message);
      console.error('Error updating profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !profile) {
    return <div className="profile-container">Loading profile...</div>;
  }

  return (
    <div className="profile-page">
      <Header />
      <div className="profile-content">
        <div className="profile-left-column">
          <UserProfile 
            userData={profileData} 
            onEditProfile={handleEditProfile} 
          />
          
          <PerformanceStats stats={performanceStats} />
          
          <TopCategories categories={topCategories} />
        </div>
        
        <div className="profile-right-column">
          <DebateHistory 
            debates={debates} 
            loading={debatesLoading} 
            error={debatesError} 
          />
        </div>
      </div>
      
      {editing && (
        <div className="edit-profile-modal">
          <div className="edit-profile-content">
            <h2>Edit Profile</h2>
            
            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}
            
            <form onSubmit={handleSubmit} className="profile-form">
              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="bio">Bio</label>
                <textarea
                  id="bio"
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  rows="4"
                  placeholder="Tell us about yourself..."
                />
              </div>
              
              <div className="profile-actions">
                <Button 
                  type="submit" 
                  variant="primary"
                  size="medium"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button 
                  type="button"
                  variant="secondary"
                  size="medium"
                  onClick={() => {
                    setEditing(false);
                    setFormData({
                      username: profile?.username || user?.user_metadata?.username || '',
                      bio: profile?.bio || '',
                    });
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfilePage;
