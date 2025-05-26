import React from 'react';
import '../styles/TestimonialCard.css';

const TestimonialCard = ({ quote, name, title, initial, avatarClass }) => {
  return (
    <div className="testimonial-card">
      <div className="star-rating">
        <span className="star">★</span>
        <span className="star">★</span>
        <span className="star">★</span>
        <span className="star">★</span>
        <span className="star">★</span>
      </div>
      <p className="testimonial-quote">"{quote}"</p>
      <div className="testimonial-user">
        <div className={`testimonial-avatar ${avatarClass}`}>{initial}</div>
        <div className="user-info">
          <p className="user-name">{name}</p>
          <p className="user-title">{title}</p>
        </div>
      </div>
    </div>
  );
};

export default TestimonialCard; 