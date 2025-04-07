import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';  

function LoginPage() {
  const { authState, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();  

  // Redirect if user is already authenticated and not in loading state
  useEffect(() => {
    if (authState.isAuthenticated && !authState.isLoading) {
      navigate('/');
    }
  }, [authState.isAuthenticated, authState.isLoading, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); // Clear previous errors

    const response = await login(email, password);

    if (!response.success) {
      setError(response.message || 'Invalid email or password.');
    } else {
      navigate('/');  
    }
  };

  // Show loading state or nothing during authentication check
  if (authState.isLoading) {
    return <div className="loading">Loading...</div>;
  }

  // If already authenticated, this will be redirected by the useEffect above
  // But we render the form to avoid flash of content
  return (
    <div className="container login-container">
      <div className="login-card">
        <h2 className="login-title">Login</h2>
        <form className="login-form" onSubmit={handleLogin}>
          <input 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            placeholder="Email" 
            required 
          />
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            placeholder="Password" 
            required 
          />
          <button type="submit">Login</button>
        </form>
        <div className="login-signup-link">
          Don't have an account?{' '}
          <Link to="/signup">
            Sign up
          </Link>
        </div>
        {error && <p className="login-error">{error}</p>}
      </div>
    </div>
  );
}

export default LoginPage;