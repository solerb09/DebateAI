import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import DefaultAvatar from './DefaultAvatar';
import Button from './Button';
import '../styles/Header.css';

const Header = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef(null);
  const mobileMenuRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      
      // Also handle mobile menu outside clicks
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target) && 
          !event.target.classList.contains('hamburger-btn') &&
          !event.target.parentElement?.classList.contains('hamburger-btn')) {
        setMobileMenuOpen(false);
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

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const handleLogout = () => {
    logout();
    setIsDropdownOpen(false);
    setMobileMenuOpen(false);
  };
  
  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="logo">
          <span className="logo-text-primary">Debate</span>
          <span className="logo-text-secondary">Ai</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="nav-menu">
          <Link to="/" className="nav-link">Home</Link>
          <Link to="/debates" className="nav-link">Debates</Link>
          <Link to="/leaderboard" className="nav-link">Leaderboard</Link>
        </nav>

        {/* Desktop Auth Section */}
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
        
        {/* Hamburger Menu Button */}
        <button className="hamburger-btn" onClick={toggleMobileMenu} aria-label="Menu">
          <span></span>
          <span></span>
          <span></span>
        </button>
        
        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="mobile-menu" ref={mobileMenuRef}>
            <nav className="mobile-nav">
              <Link to="/" className="mobile-nav-link" onClick={closeMobileMenu}>Home</Link>
              <Link to="/debates" className="mobile-nav-link" onClick={closeMobileMenu}>Debates</Link>
              <Link to="/leaderboard" className="mobile-nav-link" onClick={closeMobileMenu}>Leaderboard</Link>
              
              {isAuthenticated ? (
                <>
                  <Link to="/profile" className="mobile-nav-link" onClick={closeMobileMenu}>
                    My Profile
                  </Link>
                  <button className="mobile-nav-button" onClick={handleLogout}>
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="mobile-nav-link" onClick={closeMobileMenu}>
                    Log in
                  </Link>
                  <Link to="/signup" className="mobile-nav-link signup" onClick={closeMobileMenu}>
                    Sign up
                  </Link>
                </>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
