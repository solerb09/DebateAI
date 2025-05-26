import React from 'react';
import '../styles/HowItWorks.css';
import TranscriptionCard from './TranscriptionCard';
import ScoreCard from './ScoreCard';
import Footer from './Footer';

const HowItWorks = () => {
  // Mock data for demonstration
  const proTranscript = [
    {
      title: "Opening Statement",
      timestamp: "00:00",
      text: "I believe that mandatory voting would strengthen democracy by ensuring all citizens participate in the political process, leading to more representative outcomes."
    },
    {
      title: "Rebuttal",
      timestamp: "02:30",
      text: "While concerns about uninformed voting are valid, research shows that mandatory voting actually increases political awareness and engagement over time."
    }
  ];

  const conTranscript = [
    {
      title: "Opening Statement",
      timestamp: "01:15",
      text: "Forcing citizens to vote violates personal freedom. People should have the right to abstain from voting if they choose to."
    },
    {
      title: "Rebuttal",
      timestamp: "03:45",
      text: "The quality of democratic outcomes relies on informed decision-making, not just quantity of votes. Mandatory voting could lead to random or protest voting."
    }
  ];

  const participant = {
    username: "Sarah C.",
    side: "pro",
    title: "Debate Participant"
  };

  const score_breakdown = {
    total_score: 25,
    argument_quality: {
      score: 8.5,
      explanation: "Excellent use of statistical evidence to support your economic argument."
    },
    communication_skills: {
      score: 7.8,
      explanation: "Clear articulation of key points, but could improve on conciseness."
    },
    topic_understanding: {
      score: 9.2,
      explanation: "Demonstrated comprehensive knowledge of the topic and related contexts."
    }
  };

  return (
    <>
      <div className="how-it-works-section">
        <h2 className="section-title">How It Works</h2>
        
        <div className="steps-container">
          <div className="step-item">
            <div className="step-number">1</div>
            <h3 className="step-title">Pick a topic</h3>
            <p className="step-description">e.g., "Should voting be mandatory?"</p>
          </div>
          
          <div className="step-item">
            <div className="step-number">2</div>
            <h3 className="step-title">Debate 1v1</h3>
            <p className="step-description">in timed, structured rounds</p>
          </div>
          
          <div className="step-item">
            <div className="step-number">3</div>
            <h3 className="step-title">Get AI feedback</h3>
            <p className="step-description">on logic, evidence, clarity, and persuasion</p>
          </div>
          
          <div className="step-item">
            <div className="step-number">4</div>
            <h3 className="step-title">Win, learn, or both</h3>
            <p className="step-description">your transcript and score are instant</p>
          </div>
        </div>
        
        <h3 className="subsection-title">Example Debate Results</h3>
        <div className="example-label">Sample output - Topic: "Should voting be mandatory?"</div>
        <div className="demo-cards-section">
          <div className="score-card-container">
            <ScoreCard 
              participant={participant}
              score_breakdown={score_breakdown}
              isWinner={true}
            />
          </div>
          
          <div className="transcript-card-container">
            <TranscriptionCard
              proTranscript={proTranscript}
              conTranscript={conTranscript}
            />
          </div>
        </div>
      </div>
      
      <div className="full-width-cta">
        <p className="cta-text">Ready to sharpen your arguments and see how you rank?</p>
        <a href="/waitlist" className="cta-button">Join the Waitlist</a>
      </div>
      
      <Footer />
    </>
  );
};

export default HowItWorks; 