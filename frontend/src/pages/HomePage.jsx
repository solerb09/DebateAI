import React from 'react';
import { Link } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import TopicTag from '../components/TopicTag';
import DebateCard from '../components/DebateCard';
import '../styles/HomePage.css';

/**
 * Home page component - landing page for the application
 */
const HomePage = () => {
  const featuredDebates = [
    {
      status: 'Live',
      title: 'Should Artificial Intelligence Development Be Regulated?',
      description: 'Discussing the ethical implications and potential regulations for AI development.',
      proponent: 'Dr. Sarah Chen',
      opponent: 'Prof. James Wilson',
      duration: '1:30:00',
      datetime: 'Today, 7:00 PM',
    },
    {
      status: 'Upcoming',
      title: 'Is Universal Basic Income a Viable Economic Policy?',
      description: 'Examining the economic and social impacts of implementing UBI.',
      proponent: 'Michael Rodriguez',
      opponent: 'Emma Thompson',
      duration: '1:00:00',
      datetime: 'Tomorrow, 6:00 PM',
    },
    {
      status: 'Completed',
      title: 'Should College Education Be Free?',
      description: 'Debating the pros and cons of free higher education and its implementation.',
      proponent: 'David Johnson',
      opponent: 'Lisa Garcia',
      duration: '1:15:00',
      datetime: 'Yesterday, 8:00 PM',
    },
  ];

  return (
    <div className="home-page">
      <div className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">
            Debate. Connect. Grow.
          </h1>
          <p className="hero-subtitle">
            Join our platform to engage in meaningful debates, challenge your perspectives, and improve your communication skills.
          </p>
          <div className="hero-buttons">
            <Link to="/debates/create" className="button button-primary">
              Start a Debate
            </Link>
            <Link to="/debates" className="button button-secondary">
              Browse Debates
            </Link>
          </div>
        </div>

        <div className="search-section">
          <SearchBar />
          <div className="trending-topics">
            <h2>Trending Topics</h2>
            <div className="topics-grid">
              <TopicTag>Climate Change</TopicTag>
              <TopicTag>AI Ethics</TopicTag>
              <TopicTag>Universal Healthcare</TopicTag>
              <TopicTag>Free Speech</TopicTag>
              <TopicTag>Economic Policy</TopicTag>
            </div>
          </div>
        </div>
      </div>

      <div className="featured-debates-section">
        <h2 className="featured-debates-title">Featured Debates</h2>
        <p className="featured-debates-subtitle">
          Join these upcoming debates or watch previous ones to learn from the best debaters on our platform.
        </p>
        <div className="debates-grid">
          {featuredDebates.map((debate, index) => (
            <DebateCard key={index} {...debate} />
          ))}
        </div>
        <div className="view-all-debates">
          <Link to="/debates" className="button button-secondary">
            View All Debates
          </Link>
        </div>
      </div>
    </div>
  );
};

export default HomePage; 