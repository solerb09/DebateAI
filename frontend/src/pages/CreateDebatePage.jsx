import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
const API_URL = import.meta.env.VITE_API_URL;

/**
 * CreateDebatePage component - form to create a new debate topic
 */
const CreateDebatePage = () => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { user,isAuthenticated } = useAuth();


  // Fetch categories on component mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .order('name');
          
        if (error) {
          console.error('Error fetching categories:', error);
          return;
        }
        
        setCategories(data || []);
        if (data && data.length > 0) {
          setCategoryId(data[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch categories:', err);
      }
    };
    
    fetchCategories();
  }, []);

  // Get actual user ID from authentication context
  const getUserId = () => {
    // If user is authenticated, use the actual user ID
    if (isAuthenticated && user) {
      return user.id;
    }
    
    // Fallback to localStorage for backward compatibility or guest users
    let userId = localStorage.getItem('userId');
    if (!userId) {
      userId = 'guest_' + Math.random().toString(36).substring(2, 9);
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
      
      // Create debate topic in the database
      const { data: topicData, error: topicError } = await supabase
        .from('debate_topics')
        .insert({
          title,
          description,
          creator_id: getUserId(),
          category_id: categoryId
        })
        .select();
      
      if (topicError) {
        throw new Error(topicError.message);
      }
      
      // Create a debate room for this topic
      const { data: roomData, error: roomError } = await supabase
        .from('debate_rooms')
        .insert({
          topic_id: topicData[0].id,
          status: 'waiting'
        })
        .select();
        
      if (roomError) {
        throw new Error(roomError.message);
      }
      
      // Redirect to the newly created debate room
      navigate(`/debates/${roomData[0].id}`);
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
            <label htmlFor="category">Category</label>
            <select
              id="category"
              className="form-control"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
            >
              {categories.length === 0 && (
                <option value="">Loading categories...</option>
              )}
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
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