import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * CreateDebatePage component - form to create a new debate topic
 */
const CreateDebatePage = () => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Generate a simple user ID if not already set
  const getUserId = () => {
    let userId = localStorage.getItem('userId');
    if (!userId) {
      userId = 'user_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('userId', userId);
    }
    return userId;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!title.trim() || !description.trim()) {
      setError('Please provide both a title and description');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/debates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          description,
          creator: getUserId(),
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const newDebate = await response.json();
      
      // Redirect to the newly created debate room
      navigate(`/debates/${newDebate.id}`);
    } catch (err) {
      console.error('Failed to create debate:', err);
      setError('Failed to create debate. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="create-debate-page">
      <h1>Create a New Debate</h1>
      
      {error && (
        <div className="error-message" style={{ color: 'var(--error-color)', marginBottom: '1rem' }}>
          {error}
        </div>
      )}
      
      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="title">Debate Title</label>
            <input
              type="text"
              id="title"
              className="form-control"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Should AI be regulated?"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              className="form-control"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide context and key points for the debate..."
              rows={5}
              required
            />
          </div>
          
          <div className="form-actions" style={{ marginTop: '1.5rem' }}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => navigate('/debates')}
              style={{ marginRight: '1rem' }}
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn" 
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Debate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateDebatePage; 