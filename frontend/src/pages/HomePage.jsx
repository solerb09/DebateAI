import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Home page component - landing page for the application
 */
const HomePage = () => {
  return (
    <div className="home-page">
      <section className="hero">
        <h1>Welcome to the Debate Platform</h1>
        <p className="lead">
          Connect with others through real-time one-on-one debates using your webcam and microphone.
        </p>
        <div className="cta-buttons">
          <Link to="/debates" className="btn">
            Browse Debates
          </Link>
          <Link to="/debates/create" className="btn btn-accent" style={{ marginLeft: '1rem' }}>
            Start a Debate
          </Link>
        </div>
      </section>

      <section className="features">
        <h2>How It Works</h2>
        <div className="feature-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem', marginTop: '2rem' }}>
          <div className="feature-card card">
            <h3>Create a Topic</h3>
            <p>
              Post a debate topic that you're passionate about and provide a brief description.
            </p>
          </div>
          <div className="feature-card card">
            <h3>Connect with Others</h3>
            <p>
              Another user can join your debate topic for a one-on-one discussion.
            </p>
          </div>
          <div className="feature-card card">
            <h3>Debate in Real-Time</h3>
            <p>
              Once connected, engage in a P2P video debate with no time delay.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage; 