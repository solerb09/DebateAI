import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import WebRTCService from '../services/webrtcService';
import { useAuth } from '../contexts/AuthContext';

/**
 * CallTestPage component - simplified test page for WebRTC functionality
 */
const CallTestPage = () => {
  const TEST_ROOM_ID = 'test-call-room'; // Fixed room ID for testing
  const navigate = useNavigate();
  const { authState } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectionState, setConnectionState] = useState('new');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [participantCount, setParticipantCount] = useState(0);
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socketRef = useRef(null);
  const webrtcServiceRef = useRef(null);
  
  // Get actual user ID from authentication context
  const getUserId = () => {
    // If user is authenticated, use the actual user ID
    if (authState.isAuthenticated && authState.user) {
      return authState.user.id;
    }
    
    // Fallback to localStorage for backward compatibility or guest users
    let userId = localStorage.getItem('userId');
    if (!userId) {
      userId = 'guest_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('userId', userId);
    }
    return userId;
  };
  
  // Reset the test room on the server
  const resetTestRoom = async () => {
    try {
      const response = await fetch('/api/test/reset', {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to reset test room');
      }
      
      // Reload the page to get a fresh start
      window.location.reload();
    } catch (err) {
      console.error('Error resetting test room:', err);
      setError('Failed to reset test room. Please try refreshing the page.');
    }
  };
  
  // Set up WebSocket and WebRTC connections
  useEffect(() => {
    let mounted = true;
    
    const setupConnection = async () => {
      try {
        // Clean up any existing connections first
        if (webrtcServiceRef.current) {
          webrtcServiceRef.current.leaveDebate();
          webrtcServiceRef.current = null;
        }
        
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }
        
        // Create socket connection
        socketRef.current = io();
        console.log('Socket.io connection established');
        
        // Create WebRTC service
        webrtcServiceRef.current = new WebRTCService(socketRef.current);
        
        const userId = getUserId();
        console.log(`Setting up connection as user: ${userId}`);
        
        // Listen for participant count updates
        socketRef.current.on('participant_count', ({ count }) => {
          if (mounted) {
            console.log(`Participant count updated: ${count}`);
            setParticipantCount(count);
          }
        });
        
        // Initialize WebRTC service with the test room ID
        webrtcServiceRef.current.init(TEST_ROOM_ID, userId);
        
        // Set up WebRTC callbacks
        webrtcServiceRef.current.onRemoteStream((stream) => {
          console.log('Received remote stream', stream);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
          }
        });
        
        webrtcServiceRef.current.onConnectionStateChange((state) => {
          if (mounted) {
            console.log('Connection state changed:', state);
            setConnectionState(state);
          }
        });
        
        // Start local stream
        console.log('Requesting local media stream');
        const stream = await webrtcServiceRef.current.startLocalStream();
        console.log('Local stream obtained:', stream);
        
        if (mounted && localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        // Join the test room after media is ready
        console.log('Joining test room');
        webrtcServiceRef.current.joinDebate();
        setLoading(false);
      } catch (err) {
        console.error('Failed to setup connection:', err);
        if (mounted) {
          setError('Failed to access camera or microphone. Please check permissions and try again.');
          setLoading(false);
        }
      }
    };
    
    setupConnection();
    
    // Clean up on unmount
    return () => {
      mounted = false;
      
      if (webrtcServiceRef.current) {
        webrtcServiceRef.current.leaveDebate();
      }
      
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);
  
  // Toggle audio
  const toggleAudio = () => {
    if (webrtcServiceRef.current) {
      const newState = !isAudioEnabled;
      webrtcServiceRef.current.toggleAudio(newState);
      setIsAudioEnabled(newState);
    }
  };
  
  // Toggle video
  const toggleVideo = () => {
    if (webrtcServiceRef.current) {
      const newState = !isVideoEnabled;
      webrtcServiceRef.current.toggleVideo(newState);
      setIsVideoEnabled(newState);
    }
  };
  
  // Leave call
  const leaveCall = () => {
    if (webrtcServiceRef.current) {
      webrtcServiceRef.current.leaveDebate();
    }
    
    navigate('/');
  };
  
  // Refresh page to try again
  const refreshPage = () => {
    // Clean up resources before reloading
    if (webrtcServiceRef.current) {
      webrtcServiceRef.current.leaveDebate();
    }
    
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    
    // Reload the page
    window.location.reload();
  };
  
  if (loading) {
    return <div className="loading">Setting up test call...</div>;
  }
  
  if (error) {
    return (
      <div className="error-container">
        <div className="card">
          <h2>Error</h2>
          <p>{error}</p>
          <button className="btn" onClick={refreshPage}>
            Try Again
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="debate-room-page">
      <div className="debate-info card">
        <h1>WebRTC Test Call</h1>
        <p>This is a test room for WebRTC functionality. Open this page in two different browser windows to test the connection.</p>
        <p className="participant-info">
          Current participants: {participantCount} 
          {participantCount < 2 && " - Waiting for another participant to join..."}
        </p>
        <div style={{ marginTop: '1rem' }}>
          <button className="btn btn-secondary" onClick={resetTestRoom}>
            Reset Test Room
          </button>
          <button className="btn" onClick={refreshPage} style={{ marginLeft: '0.5rem' }}>
            Refresh Page
          </button>
        </div>
      </div>
      
      <div className="connection-status">
        Connection: 
        <span className={`status-${connectionState}`} style={{ marginLeft: '0.5rem' }}>
          {connectionState === 'connected' 
            ? 'Connected to peer' 
            : connectionState === 'connecting' 
              ? 'Connecting...' 
              : connectionState === 'disconnected' || connectionState === 'failed' || connectionState === 'closed'
                ? 'Disconnected'
                : 'Waiting for peer...'}
        </span>
      </div>
      
      <div className="video-container">
        <div className="video-wrapper">
          <video 
            ref={localVideoRef} 
            className="video-element local-video" 
            autoPlay 
            muted 
            playsInline
          />
          <div className="video-label">You</div>
        </div>
        
        <div className="video-wrapper">
          <video 
            ref={remoteVideoRef} 
            className="video-element remote-video" 
            autoPlay 
            playsInline
          />
          <div className="video-label">Peer</div>
        </div>
      </div>
      
      <div className="video-controls">
        <button 
          className={`control-btn ${isAudioEnabled ? '' : 'off'}`}
          onClick={toggleAudio}
          title={isAudioEnabled ? 'Mute Audio' : 'Unmute Audio'}
        >
          {isAudioEnabled ? '🎤' : '🔇'}
        </button>
        
        <button 
          className={`control-btn ${isVideoEnabled ? '' : 'off'}`}
          onClick={toggleVideo}
          title={isVideoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
        >
          {isVideoEnabled ? '📹' : '⛔'}
        </button>
        
        <button 
          className="control-btn btn-danger"
          onClick={leaveCall}
          title="Leave Call"
        >
          ❌
        </button>
      </div>
    </div>
  );
};

export default CallTestPage; 