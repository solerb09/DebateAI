import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import DefaultAvatar from './DefaultAvatar';
import Button from './Button';
import '../styles/Header.css';
import logo from '../assets/logo.png';

const Header = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleLogout = () => {
    logout();
    setIsDropdownOpen(false);
  };

  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="logo">
          <img src={logo} alt="DebateAI Logo" className="logo-image" />
        </Link>

        <nav className="nav-menu">
          <Link to="/" className="nav-link">Home</Link>
          <Link to="/debates" className="nav-link">Debates</Link>
          <Link to="/leaderboard" className="nav-link">Leaderboard</Link>
         
        </nav>

        <div className="auth-section">
          {isAuthenticated ? (
            <div className="profile-dropdown" ref={dropdownRef}>
              <button className="profile-button" onClick={toggleDropdown}>
                {user?.avatar_url ? (
                  <img 
                    src={user.avatar_url} 
                    alt="Profile" 
                    className="profile-image"
                  />
                ) : (
                  <DefaultAvatar />
                )}
              </button>
              {isDropdownOpen && (
                <div className="dropdown-menu">
                  <Button
                    as="link"
                    href="/profile"
                    variant="text"
                    onClick={() => setIsDropdownOpen(false)}
                    className="dropdown-item"
                  >
                    My Profile
                  </Button>
                  <Button
                    variant="text"
                    onClick={handleLogout}
                    className="dropdown-item"
                  >
                    Logout
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="auth-buttons">
              <Button
                as="link"
                href="/login"
                variant="secondary"
                size="medium"
              >
                Log in
              </Button>
              <Button
                as="link"
                href="/signup"
                variant="primary"
                size="medium"
              >
                Sign up
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
