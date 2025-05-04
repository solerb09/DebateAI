import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import '../styles/ProfilePage.css';
import Header from '../components/Header';
import UserProfile from '../components/UserProfile';
import PerformanceStats from '../components/PerformanceStats';
import TopCategories from '../components/TopCategories';
import DebateHistory from '../components/DebateHistory';
import Button from '../components/Button';
import EditProfileModal from '../components/EditProfileModal';
import { calculateDuration } from '../utils/helpers';

function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { userId } = useParams(); // Get userId from URL params
  const [loading, setLoading] = useState(true);
  const [debatesLoading, setDebatesLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    bio: '',
    profile_picture_url: '',
  });
  const [error, setError] = useState(null);
  const [debatesError, setDebatesError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [viewedUser, setViewedUser] = useState(null);
  const [isOwnProfile, setIsOwnProfile] = useState(true);

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

  // Determine if viewing own profile or another user's profile
  useEffect(() => {
    if (userId) {
      // Viewing another user's profile
      setIsOwnProfile(userId === user?.id);
      fetchUserProfile(userId);
    } else if (user) {
      // Viewing own profile
      setIsOwnProfile(true);
      setViewedUser(user);
    }
  }, [userId, user]);

  // Fetch the profile of the user being viewed
  const fetchUserProfile = async (id) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      
      if (data) {
        setViewedUser(data);
      } else {
        // User not found
        setError('User not found');
        navigate('/404');
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
      setError('Failed to load user profile');
    } finally {
      setLoading(false);
    }
  };

  // Fetch user debates from Supabase - modified to use viewedUser instead of current user
  useEffect(() => {
    const fetchUserDebates = async () => {
      const targetUserId = userId || user?.id;
      if (!targetUserId) return;
      
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
          .eq('user_id', targetUserId)
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
          .not('user_id', 'eq', targetUserId); // Exclude current user

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
            (typeof participation.score_breakdown === 'string' 
              ? (() => {
                  const parsed = JSON.parse(participation.score_breakdown);
                  // Check for new scoring format directly from query
                  if (parsed.argument_quality !== undefined) {
                    return parsed.total || 
                           (parsed.argument_quality + parsed.topic_understanding + parsed.communication_skills);
                  }
                  // Check for new scoring format with scores property
                  else if (parsed.scores) {
                    return Object.values(parsed.scores).reduce((sum, val) => sum + val, 0);
                  }
                  // Legacy format (direct properties)
                  else {
                    return Object.values(parsed).reduce((sum, val) => sum + val, 0);
                  }
                })()
              : (participation.score_breakdown.argument_quality !== undefined
                ? participation.score_breakdown.total || 
                  (participation.score_breakdown.argument_quality + 
                   participation.score_breakdown.topic_understanding + 
                   participation.score_breakdown.communication_skills)
                : (participation.score_breakdown.scores 
                  ? (() => {
                      // Handle the case where scores has a total property
                      if (participation.score_breakdown.scores.total !== undefined) {
                        console.log('Using scores.total format (object):', participation.score_breakdown.scores.total);
                        return participation.score_breakdown.scores.total;
                      }
                      // Otherwise sum the individual scores
                      const nestedScore = Object.values(participation.score_breakdown.scores).reduce((sum, val) => sum + val, 0);
                      console.log('Using nested scores format (object):', { 
                        scores: participation.score_breakdown.scores, 
                        calculatedTotal: nestedScore 
                      });
                      return nestedScore;
                    })()
                  : 0)
                )
            ) : null;
          
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
            score: totalScore ? `${totalScore}/30` : 'N/A',
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
                // Check if score_breakdown is already an object or is a JSON string
                const parseScoreBreakdown = (breakdown) => {
                  if (typeof breakdown === 'string') {
                    breakdown = JSON.parse(breakdown);
                  }
                  
                  // Direct format as in query
                  if (breakdown.argument_quality !== undefined) {
                    return {
                      'Argument Quality': breakdown.argument_quality || 0,
                      'Communication Skills': breakdown.communication_skills || 0,
                      'Topic Understanding': breakdown.topic_understanding || 0
                    };
                  }
                  // New format with scores property
                  else if (breakdown.scores) {
                    return {
                      'Argument Quality': breakdown.scores.argument_quality || 0,
                      'Communication Skills': breakdown.scores.communication_skills || 0,
                      'Topic Understanding': breakdown.scores.topic_understanding || 0
                    };
                  }
                  // Legacy format
                  else {
                    return breakdown;
                  }
                };
                
                const scores = parseScoreBreakdown(participation.score_breakdown);
                
                for (const [key, value] of Object.entries(scores)) {
                  if (scoreCategories.hasOwnProperty(key)) {
                    scoreCategories[key] += value;
                  }
                }
                debatesWithScores++;
              } catch (err) {
                console.error('Error parsing score breakdown:', err, participation.score_breakdown);
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
    
    if (viewedUser || user) {
      fetchUserDebates();
    }
  }, [viewedUser, user, userId]);

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
        tags: profile?.tags || [],
        profile_picture_url: profile?.profile_picture_url || user?.user_metadata?.profile_picture_url || ''
      };
      
      setProfileData(prev => ({
        ...prev,
        ...formattedData
      }));
      
      setFormData({
        username: profile?.username || user?.user_metadata?.username || '',
        bio: profile?.bio || '',
        profile_picture_url: profile?.profile_picture_url || '',
      });
      
      setLoading(false);
    } else if (viewedUser) {
      // Format profile data for display for other user's profile
      const formattedData = {
        username: viewedUser.username || 'Unknown User',
        bio: viewedUser.bio || 'No bio available.',
        memberSince: viewedUser.created_at 
          ? new Date(viewedUser.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
          : 'Unknown',
        totalDebates: profileData.totalDebates,
        winRate: profileData.winRate,
        winLossRatio: profileData.winLossRatio,
        wins: viewedUser.wins || 0,
        losses: viewedUser.losses || 0,
        tags: viewedUser.tags || [],
        profile_picture_url: viewedUser.profile_picture_url || ''
      };
      
      setProfileData(prev => ({
        ...prev,
        ...formattedData
      }));
      
      setLoading(false);
    } else if (!user && !userId) {
      navigate('/login');
    }
  }, [user, profile, viewedUser, navigate, isOwnProfile, profileData.totalDebates, profileData.winRate, profileData.winLossRatio]);

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

  const handleSubmit = async (e, updatedFormData) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError(null);
      
      // Use either the provided updated form data (from the modal) or the component's form data
      const dataToUpdate = updatedFormData || formData;

      // Validate username length
      if (!dataToUpdate.username.trim()) {
        throw new Error('Username is required');
      }
      if (dataToUpdate.username.length < 3) {
        throw new Error('Username must be at least 3 characters');
      }
      if (dataToUpdate.username.length > 20) {
        throw new Error('Username cannot exceed 30 characters');
      }
      
      // Update the profile in the database
      const { error } = await supabase
        .from('users')
        .update({
          username: dataToUpdate.username,
          bio: dataToUpdate.bio,
          profile_picture_url: dataToUpdate.profile_picture_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
      
      if (error) throw error;
      
      // Update user metadata
      const { error: metadataError } = await supabase.auth.updateUser({
        data: { 
          username: dataToUpdate.username,
          profile_picture_url: dataToUpdate.profile_picture_url
        }
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

  if (loading && !profile && !viewedUser) {
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
      
      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={editing}
        onClose={() => {
          setEditing(false);
          setFormData({
            username: profile?.username || user?.user_metadata?.username || '',
            bio: profile?.bio || '',
            profile_picture_url: profile?.profile_picture_url || '',
          });
        }}
        formData={formData}
        onChange={handleChange}
        onSubmit={handleSubmit}
        error={error}
        success={success}
        loading={loading}
        profile={profile}
        user={user}
      />
    </div>
  );
}

export default ProfilePage;
