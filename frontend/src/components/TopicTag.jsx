import React from 'react';
import '../styles/TopicTag.css';

const TopicTag = ({ children }) => {
  return (
    <span className="topic-tag">
      {children}
    </span>
  );
};

export default TopicTag; 