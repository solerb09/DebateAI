import React, { useState } from 'react';
import '../styles/WaitlistPage.css';
import VideoDemo from '../components/VideoDemo';

/**
 * WaitlistPage component - landing page for collecting waitlist signups
 */
const WaitlistPage = () => {
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Here you would typically send this to your backend API
    console.log('Waitlist signup:', { email, topic });
    setSubmitted(true);
    
    // Reset form
    setEmail('');
    setTopic('');

    // Reset submitted state after showing success message
    setTimeout(() => {
      setSubmitted(false);
    }, 3000);
  };

  return (
    <div className="waitlist-page-wrapper">
      <div className="waitlist-page">
        <div className="waitlist-container">
          <div className="waitlist-cta">
            <div className="coming-soon-badge">⚡ Coming Soon</div>
            <h1 className="waitlist-title">
              Join the Waitlist for
              <span className="brand-name">Debatably</span>
            </h1>
            <p className="waitlist-subtitle">
              The first platform where structured debates are
              scored, ranked, and settled by AI.
            </p>

            <div className="waitlist-form-container">
              <form onSubmit={handleSubmit} className="waitlist-form">
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="waitlist-input"
                />
                <textarea
                  placeholder="Debate topic you'd like to try (e.g., Is AI art real art?)"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="waitlist-textarea"
                ></textarea>
                <button type="submit" className="waitlist-button">
                  Join the Waitlist
                </button>
                {submitted && (
                  <div className="success-message">
                    Thank you for joining our waitlist! We'll be in touch soon.
                  </div>
                )}
                <p className="waitlist-disclaimer">No spam. Just debates.</p>
              </form>
            </div>
          </div>

          <div className="ai-feedback-demo">
            <div className="ai-feedback-card">
              <div className="feedback-header">
                <div className="feedback-title-section">
                  <div className="feedback-icon">💬</div>
                  <div>
                    <h3 className="feedback-title">AI Debate Analysis</h3>
                    <p className="feedback-subtitle">Instant feedback on your arguments</p>
                  </div>
                </div>
                <div className="live-badge">Live</div>
              </div>

              <div className="feedback-items">
                <div className="feedback-item">
                  <p><strong>Argument Strength:</strong> Your point about economic impacts is well-supported with evidence, but could be strengthened with more specific examples.</p>
                </div>
                
                <div className="feedback-item">
                  <p><strong>Logical Fallacy Detected:</strong> Be careful of the slippery slope fallacy in your third point. Not all regulation necessarily leads to overregulation.</p>
                </div>
                
                <div className="feedback-item">
                  <p><strong>Persuasiveness Score:</strong> 8.4/10 - Your closing argument effectively summarized your position and addressed counterpoints.</p>
                </div>
              </div>

              <div className="feedback-footer">
                <div className="victory-status">
                  <span className="victory-icon">✅</span> Victory
                </div>
                <div className="score">Score: <span className="score-value">87/100</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <VideoDemo />
    </div>
  );
};

export default WaitlistPage; 