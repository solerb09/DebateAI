import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import '../styles/ProfilePage.css'; // Import the new stylesheet

function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    bio: '',
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Populate form with data
  useEffect(() => {
    if (user) {
      setFormData({
        username: profile?.username || user?.user_metadata?.username || '',
        bio: profile?.bio || '',
      });
      setLoading(false);
    } else {
      navigate('/login');
    }
  }, [user, profile, navigate]);

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
    <div className="profile-container">
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
                setFormData({
                  username: profile?.username || user?.user_metadata?.username || '',
                  bio: profile?.bio || '',
                });
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
            <p>{profile?.username || user?.user_metadata?.username || "Not set"}</p>
          </div>
          
          <div className="profile-section">
            <h2>Bio</h2>
            <p>{profile?.bio || "No bio provided."}</p>
          </div>
          
          <div className="profile-section">
            <h2>Email</h2>
            <p>{user?.email}</p>
          </div>
          
          <div className="profile-section">
            <h2>Account Created</h2>
            <p>{profile?.created_at 
              ? new Date(profile.created_at).toLocaleDateString() 
              : new Date(user?.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfilePage;
