import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Header component with navigation links
 */
const Header = () => {
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
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header; 