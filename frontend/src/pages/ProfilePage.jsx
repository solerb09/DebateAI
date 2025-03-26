import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    username: '',
    fullName: '',
    bio: '',
    avatarUrl: '',
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!user) {
      navigate('/login');
    } else {
      fetchProfile();
    }
  }, [user, navigate]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      
      // Get profile data from users table
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      
      // Set profile data
      setProfileData({
        username: data?.username || user.user_metadata?.username || '',
        fullName: data?.full_name || '',
        bio: data?.bio || '',
      });

    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
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
          username: profileData.username,
          bio: profileData.bio,
          updated_at: new Date()
        })
        .eq('id', user.id);
      
      if (error) throw error;
      
      // Update user metadata
      const { error: metadataError } = await supabase.auth.updateUser({
        data: { username: profileData.username }
      });
      
      if (metadataError) throw metadataError;
      
      setSuccess('Profile updated successfully!');
      setEditing(false);
      
      // Refresh profile data
      await fetchProfile();
      
    } catch (error) {
      setError(error.message);
      console.error('Error updating profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !profileData.username) {
    return <div className="home-container">Loading profile...</div>;
  }

  return (
    <div className="home-container">
      <div className="welcome-section">
        <div className="profile-header">
          <h1>My Profile</h1>
          {!editing && (
            <button 
              onClick={() => setEditing(true)}
              className="edit-button"
            >
              Edit Profile
            </button>
          )}
        </div>
        
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}
        
        {editing ? (
          <form onSubmit={handleSubmit} className="profile-form">
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                name="username"
                value={profileData.username}
                onChange={handleChange}
                required
              />
            </div>
            
            
            <div className="form-group">
              <label htmlFor="bio">Bio</label>
              <textarea
                id="bio"
                name="bio"
                value={profileData.bio}
                onChange={handleChange}
                rows="4"
              />
            </div>
            
            <div className="profile-actions">
              <button 
                type="submit" 
                className="save-button"
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
              <button 
                type="button"
                onClick={() => {
                  setEditing(false);
                  fetchProfile(); // Reset form data
                }}
                className="cancel-button"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="profile-info">
            <div className="profile-section">
              <h2>Username</h2>
              <p>{profileData.username || "Not set"}</p>
            </div>
            
            
            <div className="profile-section">
              <h2>Bio</h2>
              <p>{profileData.bio || "No bio provided."}</p>
            </div>
            
            <div className="profile-section">
              <h2>Email</h2>
              <p>{user.email}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProfilePage;
