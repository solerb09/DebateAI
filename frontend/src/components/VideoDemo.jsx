import React from 'react';
import '../styles/VideoDemo.css';
import TestimonialCard from './TestimonialCard';
import HowItWorks from './HowItWorks';

const VideoDemo = () => {
  const testimonials = [
    {
      quote: "The AI feedback is incredible. It pointed out logical fallacies I didn't even realize I was making. Game-changer for improving my arguments.",
      name: "Sarah C.",
      title: "Beta Tester",
      initial: "SC",
      avatarClass: "sc-avatar"
    },
    {
      quote: "I've always enjoyed debates but hated how they devolve online. Debatably keeps everything structured and focused on substance, not rhetoric.",
      name: "James W.",
      title: "Beta Tester",
      initial: "JW",
      avatarClass: "jw-avatar"
    },
    {
      quote: "The leaderboard feature is addictive! I've climbed from rank 50 to top 10 in my category. It's like chess for arguments.",
      name: "Emma T.",
      title: "Beta Tester",
      initial: "ET",
      avatarClass: "et-avatar"
    }
  ];

  return (
    <>
      <div className="video-demo-section">
        <div className="video-demo-container">
          <div className="video-demo-text">
            <div className="video-demo-tag">Video Demo</div>
            <h2 className="video-demo-title">See It in Action</h2>
            <p className="video-demo-subtitle">
              Watch a quick demo of Debatably's AI-scored debate experience and see how our platform transforms online debates.
            </p>
            
            <div className="waitlist-members">
              <div className="avatar-group">
                <div className="avatar avatar-sc">SC</div>
                <div className="avatar avatar-jw">JW</div>
                <div className="avatar avatar-et">ET</div>
              </div>
              <span className="members-count">Join 5,000+ waitlist members</span>
            </div>
          </div>
          
          <div className="video-preview">
            <div className="video-card">
              <div className="video-placeholder">
                <div className="video-mockup-content">
                  <div className="mockup-debate-interface">
                    <div className="mockup-header">Debate: Is AI Consciousness Possible?</div>
                    <div className="mockup-participants">
                      <div className="mockup-participant">Pro: Sarah C.</div>
                      <div className="mockup-participant">Con: James W.</div>
                    </div>
                  </div>
                </div>
                <button className="play-button">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="play-icon">
                    <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="testimonials-section">
          <h3 className="testimonials-title">What Our Users Say</h3>
          <div className="testimonial-cards">
            {testimonials.map((testimonial, index) => (
              <TestimonialCard
                key={index}
                quote={testimonial.quote}
                name={testimonial.name}
                title={testimonial.title}
                initial={testimonial.initial}
                avatarClass={testimonial.avatarClass}
              />
            ))}
          </div>
        </div>
      </div>
      
      <HowItWorks />
    </>
  );
};

export default VideoDemo; 