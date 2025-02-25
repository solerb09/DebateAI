import React from 'react';
import { Link } from 'react-router-dom';

/**
 * NotFoundPage component - displayed when a route is not found
 */
const NotFoundPage = () => {
  return (
    <div className="not-found-page">
      <div className="card" style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
        <h1>404 - Page Not Found</h1>
        <p>The page you are looking for does not exist.</p>
        <Link to="/" className="btn" style={{ marginTop: '1.5rem' }}>
          Return to Home
        </Link>
      </div>
    </div>
  );
};

export default NotFoundPage; 