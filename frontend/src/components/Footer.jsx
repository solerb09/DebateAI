import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Footer.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="site-footer">
      <div className="footer-container">
        <div className="footer-logo-section">
          <h3 className="footer-logo">DebateAI</h3>
          <p className="footer-tagline">Debate smarter, not harder</p>
        </div>
        
        <div className="footer-links">
          <div className="footer-link-column">
            <h4>Platform</h4>
            <ul>
              <li><Link to="/">Home</Link></li>
              <li><Link to="/how-it-works">How It Works</Link></li>
              <li><Link to="/debates">Browse Debates</Link></li>
              <li><Link to="/waitlist">Join Waitlist</Link></li>
            </ul>
          </div>
          
          <div className="footer-link-column">
            <h4>Resources</h4>
            <ul>
              <li><Link to="/faq">FAQ</Link></li>
              <li><Link to="/blog">Blog</Link></li>
              <li><Link to="/support">Support</Link></li>
            </ul>
          </div>
          
          <div className="footer-link-column">
            <h4>Company</h4>
            <ul>
              <li><Link to="/about">About Us</Link></li>
              <li><Link to="/contact">Contact</Link></li>
              <li><Link to="/careers">Careers</Link></li>
            </ul>
          </div>
          
          <div className="footer-link-column">
            <h4>Legal</h4>
            <ul>
              <li><Link to="/terms">Terms of Service</Link></li>
              <li><Link to="/privacy">Privacy Policy</Link></li>
              <li><Link to="/cookies">Cookie Policy</Link></li>
            </ul>
          </div>
        </div>
      </div>
      
      <div className="footer-bottom">
        <p>&copy; {currentYear} DebateAI. All rights reserved.</p>
        <div className="social-links">
          <a href="https://twitter.com/" target="_blank" rel="noopener noreferrer" aria-label="Twitter">
            <i className="fab fa-twitter"></i>
          </a>
          <a href="https://linkedin.com/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
            <i className="fab fa-linkedin"></i>
          </a>
          <a href="https://facebook.com/" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
            <i className="fab fa-facebook"></i>
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 