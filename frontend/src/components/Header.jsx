import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Header = () => {
  // Get the complete auth state
  const { user, profile, isAuthenticated, loading, logout } = useAuth();
  
  // For debugging
  console.log("Auth state in Header:", { isAuthenticated, userId: user?.id });

  return (
    <header className="header">
      <div className="container">
        <nav className="nav">
          <Link to="/" className="nav-logo">
            Debate Platform
          </Link>
          <ul className="nav-links">
            {/* Always visible links */}
            <li className="nav-link">
              <Link to="/debates">Debates</Link>
            </li>
            
            {/* Protected links */}
            {isAuthenticated && (
              <li className="nav-link">
                <Link to="/debates/create">Create Debate</Link>
              </li>
            )}
            
            {/* Show Test Call link */}
            <li className="nav-link">
              <Link to="/call">Test Call</Link>
            </li>
            
            {/* Auth links */}
            {isAuthenticated ? (
              <>
                <li className="nav-link">
                  <Link to="/profile">
                    {profile?.username || user?.email?.split('@')[0] || 'Profile'}
                  </Link>
                </li>
                <li className="nav-link">
                  <button 
                    onClick={() => logout()}
                    className="nav-button"
                  >
                    Sign Out
                  </button>
                </li>
              </>
            ) : (
              <>
                <li className="nav-link">
                  <Link to="/login">Login</Link>
                </li>
                <li className="nav-link">
                  <Link to="/signup">Sign Up</Link>
                </li>
              </>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header;
