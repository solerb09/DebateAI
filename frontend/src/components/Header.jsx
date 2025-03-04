import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Header = () => {
  const { authState, logout } = useAuth(); 

  return (
    <header className="header">
      <div className="container">
        <nav className="nav">
          <Link to="/" className="nav-logo">
            Debate Platform
          </Link>
          <ul className="nav-links">
            <li className="nav-link">
              <Link to="/debates">Debates</Link>
            </li>
            <li className="nav-link">
              <Link to="/debates/create">Create Debate</Link>
            </li>
            <li className="nav-link">
              <Link to="/call">Test Call</Link>
            </li>
            {authState.isAuthenticated ? ( // if authenticated, show logout
              <li className="nav-link">
                <button onClick={logout} className="nav-button">Logout</button>
              </li>
            ) : (
              // if not authenticated, show login
              <li className="nav-link"> 
                <Link to="/login">Login</Link>
              </li>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header;
