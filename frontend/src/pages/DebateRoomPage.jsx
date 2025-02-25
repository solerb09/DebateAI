import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import WebRTCService from '../services/webrtcService';

/**
 * DebateRoomPage component - handles debate video chat using WebRTC
 */
const DebateRoomPage = () => {
  const { id: debateId } = useParams();
  const navigate = useNavigate();
  
  const [debate, setDebate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectionState, setConnectionState] = useState('new');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socketRef = useRef(null);
  const webrtcServiceRef = useRef(null);
  
  // Get user ID from localStorage or generate a new one
  const getUserId = () => {
    let userId = localStorage.getItem('userId');
    if (!userId) {
      userId = 'user_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('userId', userId);
    }
    return userId;
  };
  
  // Fetch debate details
  useEffect(() => {
    const fetchDebate = async () => {
      try {
        const response = await fetch(`/api/debates/${debateId}`);
        
        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }
        
        const data = await response.json();
        setDebate(data);
      } catch (err) {
        console.error('Failed to fetch debate:', err);
        setError('Failed to load debate details. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchDebate();
  }, [debateId]);
  
  // Set up WebSocket and WebRTC connections
  useEffect(() => {
    if (loading || error) return;
    
    // Create socket connection
    socketRef.current = io();
    
    // Create WebRTC service
    webrtcServiceRef.current = new WebRTCService(socketRef.current);
    
    const userId = getUserId();
    
    // Initialize WebRTC service
    webrtcServiceRef.current.init(debateId, userId);
    
    // Set up WebRTC callbacks
    webrtcServiceRef.current.onRemoteStream((stream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    });
    
    webrtcServiceRef.current.onConnectionStateChange((state) => {
      setConnectionState(state);
      
      // Handle disconnection
      if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        // Show appropriate UI
        console.log('Peer disconnected or connection failed');
      }
    });
    
    // Start local stream
    const startMedia = async () => {
      try {
        const stream = await webrtcServiceRef.current.startLocalStream();
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        // Join the debate room after media is ready
        webrtcServiceRef.current.joinDebate();
      } catch (err) {
        console.error('Failed to start media:', err);
        setError('Failed to access camera or microphone. Please check permissions and try again.');
      }
    };
    
    startMedia();
    
    // Update debate status to active
    updateDebateStatus('active');
    
    // Clean up on unmount
    return () => {
      if (webrtcServiceRef.current) {
        webrtcServiceRef.current.leaveDebate();
      }
      
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      
      // Update debate status back to open when leaving
      updateDebateStatus('open');
    };
  }, [debateId, loading, error]);
  
  // Update debate status
  const updateDebateStatus = async (status) => {
    try {
      const response = await fetch(`/api/debates/${debateId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      
      if (!response.ok) {
        console.error('Failed to update debate status');
      }
    } catch (err) {
      console.error('Error updating debate status:', err);
    }
  };
  
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
  
  // Leave debate
  const leaveDebate = () => {
    if (webrtcServiceRef.current) {
      webrtcServiceRef.current.leaveDebate();
    }
    
    navigate('/debates');
  };
  
  if (loading) {
    return <div className="loading">Loading debate room...</div>;
  }
  
  if (error) {
    return (
      <div className="error-container">
        <div className="card">
          <h2>Error</h2>
          <p>{error}</p>
          <button className="btn" onClick={() => navigate('/debates')}>
            Back to Debates
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="debate-room-page">
      <div className="debate-info card">
        <h1>{debate?.title}</h1>
        <p>{debate?.description}</p>
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
          onClick={leaveDebate}
          title="Leave Debate"
        >
          ❌
        </button>
      </div>
    </div>
  );
};

export default DebateRoomPage; 