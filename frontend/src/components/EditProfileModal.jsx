import React from 'react';
import Button from './Button';
import '../styles/ProfilePage.css';

function EditProfileModal({ isOpen, onClose, formData, onChange, onSubmit, error, success, loading }) {
  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(e, formData);
  };

  return (
    <div className="edit-profile-modal">
      <div className="edit-profile-content">
        <h2>Edit Profile</h2>
        
        {error && (
          <div className="error-message">{error}</div>
        )}
        
        {success && (
          <div className="success-message">{success}</div>
        )}
        
        <form onSubmit={handleSubmit} className="profile-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={onChange}
              maxLength={20}
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="bio">Bio</label>
            <textarea
              id="bio"
              name="bio"
              value={formData.bio}
              onChange={onChange}
              maxLength={500}
              disabled={loading}
            />
          </div>
          
          <div className="profile-actions">
            <Button 
              type="submit" 
              disabled={loading}
              className="save-button"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
            
            <Button 
              onClick={onClose}
              disabled={loading}
              className="cancel-button"
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditProfileModal; 