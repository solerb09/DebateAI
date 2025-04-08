import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import WebRTCService from '../services/webrtcService';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';

/**
 * DebateRoomPage component - handles debate video chat using WebRTC
 */
const DebateRoomPage = () => {
  const { id: debateRoomId } = useParams();
  const navigate = useNavigate();
  const { authState } = useAuth();
  
  const [debateRoom, setDebateRoom] = useState(null);
  const [debateTopic, setDebateTopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectionState, setConnectionState] = useState('new');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState('idle'); // idle, recording, processing, uploaded, error
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // New state variables for debate structure
  const [debateStatus, setDebateStatus] = useState('connecting'); // connecting, waiting, ready, countdown, debating, finished
  const [isReady, setIsReady] = useState(false);
  const [isPeerReady, setIsPeerReady] = useState(false);
  const [debateRole, setDebateRole] = useState(null); // 'pro' or 'con'
  const [speakingTurn, setSpeakingTurn] = useState(null); // 'pro' or 'con'
  const [countdown, setCountdown] = useState(5);
  const [turnTimer, setTurnTimer] = useState(10); // 10 seconds per turn for testing
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socketRef = useRef(null);
  const webrtcServiceRef = useRef(null);
  const recordingTimerRef = useRef(null);
  
  // New ref to track turn change requests
  const turnChangeRequestRef = useRef(false);
  
  // Get actual user ID from authentication context
  const getUserId = () => {
    // If user is authenticated, use the actual user ID
    if (authState.isAuthenticated && authState.user) {
      return authState.user.id;
    }
    
    
    return userId;
  };
  
  // Fetch debate details
  useEffect(() => {
    const fetchDebateData = async () => {
      try {
        // Get the debate room
        const { data: roomData, error: roomError } = await supabase
          .from('debate_rooms')
          .select('*')
          .eq('id', debateRoomId)
          .single();
          
        if (roomError) {
          throw new Error(roomError.message);
        }
        
        // Check if the user is trying to join their own debate
        if (authState.isAuthenticated && roomData.creator_id === authState.user.id) {
          setError('You cannot join your own debate. Please wait for another user to join or join a different debate.');
          setLoading(false);
          return;
        }
        
        setDebateRoom(roomData);
        
        // Get the debate topic
        const { data: topicData, error: topicError } = await supabase
          .from('debate_topics')
          .select('*, categories(*)')
          .eq('id', roomData.topic_id)
          .single();
          
        if (topicError) {
          throw new Error(topicError.message);
        }
        
        setDebateTopic(topicData);
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch debate data:', err);
        setError('Failed to load debate. Please try again.');
        setLoading(false);
      }
    };
    
    fetchDebateData();
  }, [debateRoomId, authState]);
  
  // Set up WebSocket and WebRTC connections
  useEffect(() => {
    if (loading || error) return;
    
    let mounted = true;
    
    // Create socket connection
    socketRef.current = io();
    
    // Add error handling for socket connection
    socketRef.current.on('connect', () => {
      console.log('Socket connected successfully');
    });
    
    socketRef.current.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      if (mounted) {
        setError('Failed to connect to debate server. Please check your internet connection and try again.');
      }
    });
    
    // Add handler for user-already-in-debate error
    socketRef.current.on('debate_error', (data) => {
      console.error('Debate error:', data.message);
      if (data.code === 'USER_ALREADY_IN_DEBATE') {
        setError('You are already participating in this debate in another window or tab. Please close other instances of this debate.');
      } else {
        setError(`Debate error: ${data.message}`);
      }
    });
    
    // Only create WebRTC service once and don't recreate for state changes
    if (!webrtcServiceRef.current) {
      console.log('Creating new WebRTC service instance');
      // Create WebRTC service
      webrtcServiceRef.current = new WebRTCService(socketRef.current);
      
      const userId = getUserId();
      
      // Initialize WebRTC service
      webrtcServiceRef.current.init(debateRoomId, userId);
      
      // Set up WebRTC callbacks
      webrtcServiceRef.current.onRemoteStream((stream) => {
        if (remoteVideoRef.current && mounted) {
          remoteVideoRef.current.srcObject = stream;
        }
      });
      
      webrtcServiceRef.current.onConnectionStateChange((state) => {
        if (mounted) {
          setConnectionState(state);
          
          // When connection is established, update debate status to 'waiting'
          if (state === 'connected' && debateStatus === 'connecting') {
            setDebateStatus('waiting');
          }
          
          // Handle disconnection
          if (state === 'disconnected' || state === 'failed' || state === 'competed') {
            // Show appropriate UI
            console.log('Peer disconnected or connection failed');
          }
        }
      });
      
      // Start local stream only once
      const startMedia = async () => {
        try {
          const stream = await webrtcServiceRef.current.startLocalStream();
          if (localVideoRef.current && mounted) {
            localVideoRef.current.srcObject = stream;
          }
          
          // Join the debate room after media is ready
          webrtcServiceRef.current.joinDebate();
        } catch (err) {
          console.error('Failed to start media:', err);
          if (mounted) {
            setError('Failed to access camera or microphone. Please check permissions and try again.');
          }
        }
      };
      
      startMedia();
    } else {
      console.log('Using existing WebRTC service instance');
    }
    
    // Socket event listeners for debate structure
    socketRef.current.on('user_joined', ({ userId: joinedUserId }) => {
      console.log(`User ${joinedUserId} joined the debate`);
      // If we're connected and someone joined, update to waiting state
      if (connectionState === 'connected' && debateStatus === 'connecting') {
        console.log('[SOCKET] Updating status to waiting due to user_joined event');
        setDebateStatus('waiting');
      }
    });
    
    // Add new listener for debate_participants_connected event
    socketRef.current.on('debate_participants_connected', ({ participants }) => {
      console.log(`[SOCKET] Both participants connected in room: ${debateRoomId}`, participants);
      
      // If we were still in connecting state, update to waiting
      if (debateStatus === 'connecting') {
        console.log('[SOCKET] Updating status to waiting due to debate_participants_connected event');
        setDebateStatus('waiting');
      }
    });
    
    socketRef.current.on('user_ready', ({ userId: readyUserId, isReady: peerReady }) => {
      console.log(`[SOCKET] User ${readyUserId} ready status: ${peerReady}`);
      // Update peer ready status
      setIsPeerReady(peerReady);
    });
    
    socketRef.current.on('debate_ready', ({ participants }) => {
      console.log('[SOCKET] Debate ready with participants:', participants);
      setDebateStatus('ready');
    });
    
    socketRef.current.on('debate_countdown', ({ count }) => {
      console.log('Debate countdown:', count);
      setDebateStatus('countdown');
      setCountdown(count);
    });
    
    socketRef.current.on('debate_start', ({ firstTurn, roles }) => {
      console.log('Debate started with first turn:', firstTurn);
      setDebateStatus('debating');
      setSpeakingTurn(firstTurn);
      
      // Get our role from the roles object
      if (roles && userId) {
        setDebateRole(roles[userId]);
        console.log(`My role is: ${roles[userId]}`);
      }
      
      // Initialize turn timer with 10 seconds for testing
      setTurnTimer(10);
    });
    
    // Handle speaking turn changes
    socketRef.current.on('speaking_turn', ({ turn, timeRemaining }) => {
      console.log(`[Socket] Speaking turn changed to: ${turn} with ${timeRemaining} seconds remaining`);
      setSpeakingTurn(turn);
      setTurnTimer(timeRemaining || 10); // Use 10 seconds as default if timeRemaining is not provided
      
      // Reset the turn change request flag
      turnChangeRequestRef.current = false;
    });
    
    // Handle debate finished event
    socketRef.current.on('debate_finished', ({ message }) => {
      console.log(`[Socket] Debate finished: ${message}`);
      setDebateStatus('finished');
      
      // Clear any remaining timer
      setTurnTimer(0);
      
      // Reset the turn change request flag
      turnChangeRequestRef.current = false;
    });
    
    // Update debate status to active
    updateDebateStatus('active');
    
    // Add beforeunload event listener to handle tab close
    const handleBeforeUnload = () => {
      console.log('Window closing, cleaning up debate resources');
      if (webrtcServiceRef.current) {
        webrtcServiceRef.current.leaveDebate();
      }
      
      // We don't need to update the debate status here as the server will handle it
      // when it detects the socket disconnection
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Clean up on unmount
    return () => {
      mounted = false;
      
      // Remove beforeunload event listener
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // Ensure we leave the debate properly
      if (webrtcServiceRef.current) {
        webrtcServiceRef.current.leaveDebate();
        webrtcServiceRef.current = null;
      }
      
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      
      // Clean up socket event listeners
      if (socketRef.current) {
        socketRef.current.off('user_joined');
        socketRef.current.off('debate_participants_connected');
        socketRef.current.off('user_ready');
        socketRef.current.off('debate_ready');
        socketRef.current.off('debate_countdown');
        socketRef.current.off('debate_start');
        socketRef.current.off('speaking_turn');
        socketRef.current.off('debate_finished');
      }
    };
  }, [debateRoomId, loading, error]); // Remove debateStatus from dependencies to prevent recreation of WebRTC connection
  
  // Update debate status
  const updateDebateStatus = async (status) => {
    try {
      console.log(`Updating debate ${debateRoomId} status to ${status}`);
      const response = await fetch(`/api/debates/${debateRoomId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to update debate status: ${errorText}`);
        throw new Error(`Failed to update debate status: ${response.status}`);
      }
      
      return response.json();
    } catch (err) {
      console.error('Error updating debate status:', err);
      throw err;
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
    // First update the debate status to open
    updateDebateStatus('open').then(() => {
      // Then leave the debate
      if (webrtcServiceRef.current) {
        webrtcServiceRef.current.leaveDebate();
        webrtcServiceRef.current = null;
      }
      
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      
      navigate('/debates');
    }).catch(err => {
      console.error('Error leaving debate:', err);
      // Still navigate away even if there's an error
      navigate('/debates');
    });
  };
  
  // Format seconds as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      // Clear recording timer if it's running
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);
  
  // Function to toggle ready status
  const toggleReady = () => {
    const newReadyStatus = !isReady;
    setIsReady(newReadyStatus);
    
    // Emit ready status to server
    socketRef.current.emit('user_ready', {
      debateId: debateRoomId,
      userId: getUserId(),
      isReady: newReadyStatus
    });
    
    console.log(`Set ready status to: ${newReadyStatus}`);
  };
  
  // Timer effect for countdown and speaking turns
  useEffect(() => {
    let timerId;
    
    if (debateStatus === 'countdown' && countdown > 0) {
      // Countdown timer before debate starts
      timerId = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (debateStatus === 'debating' && turnTimer > 0) {
      // Speaking turn timer
      timerId = setTimeout(() => {
        setTurnTimer(prev => {
          const newTime = prev - 1;
          
          // If time is up, emit event to change turns
          if (newTime <= 0) {
            console.log(`[Client Timer] Turn timer reached zero for ${speakingTurn} side`);
            
            // Only emit if we haven't already requested a turn change
            if (socketRef.current && !turnChangeRequestRef.current) {
              // Set the flag to prevent multiple requests
              turnChangeRequestRef.current = true;
              console.log(`[Client Timer] Sending turn_complete event to server`);
              
              socketRef.current.emit('turn_complete', {
                debateId: debateRoomId,
                userId: getUserId()
              });
            }
          }
          
          return Math.max(0, newTime); // Don't allow negative times
        });
      }, 1000);
    } else if (debateStatus === 'debating' && turnTimer === 0 && !turnChangeRequestRef.current) {
      // Timer is stuck at 0 and we haven't already requested a turn change
      console.log(`[Client Timer] Timer stuck at 0 for ${speakingTurn} - implementing emergency recovery`);
      
      // Set flag to prevent multiple requests
      turnChangeRequestRef.current = true;
      
      // Send a turn_complete event
      if (socketRef.current) {
        console.log(`[Client Timer] Sending emergency turn_complete event to server`);
        socketRef.current.emit('turn_complete', {
          debateId: debateRoomId,
          userId: getUserId()
        });
      }
      
      // Reset the flag after 5 seconds to prevent deadlock
      timerId = setTimeout(() => {
        turnChangeRequestRef.current = false;
      }, 5000);
    }
    
    // Clean up
    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [debateStatus, countdown, turnTimer, debateRoomId, speakingTurn]);
  
  // Reset the turn change request flag when a new turn starts
  useEffect(() => {
    // Reset the turn change request flag when the speaking turn changes
    turnChangeRequestRef.current = false;
  }, [speakingTurn]);
  
  // Add automatic recording based on debate status
  useEffect(() => {
    // Start recording when debate begins
    if (debateStatus === 'debating' && !isRecording && webrtcServiceRef.current) {
      console.log('Debate started - automatically starting recording');
      try {
        webrtcServiceRef.current.startRecording();
        setIsRecording(true);
        setRecordingStatus('recording');
      } catch (error) {
        console.error('Failed to start automatic recording:', error);
        setRecordingStatus('error');
      }
    }
    
    // Stop recording when debate ends
    if (debateStatus === 'finished' && isRecording && webrtcServiceRef.current) {
      console.log('Debate ended - automatically stopping recording');
      const stopAndUploadRecording = async () => {
        try {
          // Stop the recording timer if it's running
          if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
          }
          
          setRecordingStatus('processing');
          
          // Stop recording and get the audio blobs
          const recordings = await webrtcServiceRef.current.stopRecording();
          
          // If we have recordings, upload them
          if (recordings) {
            console.log('Uploading debate recordings...');
            setRecordingStatus('uploading');
            
            // Upload the recordings to the server
            const results = await webrtcServiceRef.current.uploadRecordings(recordings);
            
            console.log('Debate recordings uploaded:', results);
            setRecordingStatus('uploaded');
          }
          
          setIsRecording(false);
        } catch (error) {
          console.error('Failed to stop and upload automatic recording:', error);
          setRecordingStatus('error');
          setIsRecording(false);
        }
      };
      
      stopAndUploadRecording();
    }
  }, [debateStatus, isRecording]);
  
  // Add an effect to handle the recording timer
  useEffect(() => {
    // Start timer when recording begins
    if (isRecording && recordingStatus === 'recording') {
      console.log('Starting recording timer');
      let seconds = 0;
      recordingTimerRef.current = setInterval(() => {
        seconds += 1;
        setRecordingTime(seconds);
      }, 1000);
    }
    
    // Clean up timer when recording stops
    return () => {
      if (recordingTimerRef.current) {
        console.log('Clearing recording timer');
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    };
  }, [isRecording, recordingStatus]);
  
  // Add CSS styles for the recording indicator
  const styles = {
    recordingStatusIndicator: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '5px 10px',
      borderRadius: '4px',
      margin: '0 5px',
      fontSize: '14px',
      fontWeight: 'bold',
      backgroundColor: 'transparent',
      color: '#888'
    },
    recording: {
      backgroundColor: 'rgba(255, 0, 0, 0.1)',
      color: '#ff3333',
      fontWeight: 'bold'
    },
    recordingDot: {
      display: 'inline-block',
      width: '10px',
      height: '10px',
      borderRadius: '50%',
      backgroundColor: '#ff3333',
      marginRight: '5px'
    }
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
      {console.log(`[Render] Debate Status: ${debateStatus}, Connection State: ${connectionState}, Ready Button Visible: ${debateStatus === 'waiting' && connectionState === 'connected'}`)}
      
      <div className="debate-info card">
        <h1>{debateTopic?.title}</h1>
        <p>{debateTopic?.description}</p>
        {debateTopic?.categories && (
          <div className="category-tag">
            Category: {debateTopic.categories.name}
          </div>
        )}
        
        {/* Debate status display */}
        <div className="debate-status">
          <div className="status-label">
            {debateStatus === 'connecting' && 'Establishing connection with peer...'}
            {debateStatus === 'waiting' && connectionState === 'connected' && 'Both participants connected. Click Ready when you are prepared to begin the debate.'}
            {debateStatus === 'waiting' && connectionState !== 'connected' && 'Waiting for peer to connect...'}
            {debateStatus === 'ready' && 'Both participants are ready'}
            {debateStatus === 'countdown' && `Debate starting in ${countdown}`}
            {debateStatus === 'debating' && 'Debate in progress'}
            {debateStatus === 'finished' && (
              <>
                Debate has ended
                <button 
                  className="btn btn-primary view-results-btn"
                  onClick={() => navigate(`/debates/${debateRoomId}/results`)}
                  style={{
                    marginLeft: '15px',
                    padding: '5px 15px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  View Results
                </button>
              </>
            )}
          </div>
          
          {/* Display peer readiness status */}
          {debateStatus === 'waiting' && connectionState === 'connected' && (
            <div className="peer-status">
              Peer status: {isPeerReady ? 'Ready ✓' : 'Not ready yet'}
            </div>
          )}
          
          {/* Show ready button only in waiting state and when connected */}
          {debateStatus === 'waiting' && connectionState === 'connected' && (
            <button 
              className={`btn ${isReady ? 'btn-accent' : 'btn-primary'}`}
              onClick={toggleReady}
            >
              {isReady ? 'Ready ✓' : 'Ready?'}
            </button>
          )}
          
          {/* Show countdown timer */}
          {debateStatus === 'countdown' && (
            <div className="countdown-timer">
              <div className="countdown-number">{countdown}</div>
            </div>
          )}
          
          {/* Show turn information when debating */}
          {debateStatus === 'debating' && (
            <div className="turn-info">
              <div className="speaking-turn">
                Speaking: <span className={`role-${speakingTurn}`}>
                  {speakingTurn === 'pro' ? 'Affirmative' : 'Negative'} Side
                </span>
              </div>
              <div className="turn-timer">
                Time remaining: {formatTime(turnTimer)}
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="connection-status">
        Connection: 
        <span className={`status-${connectionState}`} style={{ marginLeft: '0.5rem' }}>
          {connectionState === 'connected' 
            ? 'Connected to peer' 
            : connectionState === 'connecting' 
              ? 'Connecting...' 
              : connectionState === 'disconnected' || connectionState === 'failed' || connectionState === 'completed'
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
          <div className="video-label">
            You {debateRole && `(${debateRole === 'pro' ? 'Affirmative' : 'Negative'})`}
            {speakingTurn === debateRole && debateStatus === 'debating' && ' - Speaking'}
          </div>
          {debateStatus === 'debating' && speakingTurn === debateRole && (
            <div className="speaking-indicator">LIVE</div>
          )}
        </div>
        
        <div className="video-wrapper">
          <video 
            ref={remoteVideoRef} 
            className="video-element remote-video" 
            autoPlay 
            playsInline
          />
          <div className="video-label">
            Peer {debateRole && `(${debateRole === 'pro' ? 'Negative' : 'Affirmative'})`}
            {speakingTurn !== debateRole && debateStatus === 'debating' && ' - Speaking'}
          </div>
          {debateStatus === 'debating' && speakingTurn !== debateRole && (
            <div className="speaking-indicator">LIVE</div>
          )}
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
        
        <div 
          style={{
            ...styles.recordingStatusIndicator,
            ...(isRecording ? styles.recording : {})
          }}
          title={isRecording ? 'Recording in progress' : 'Not recording'}
        >
          {isRecording && (
            <>
              <span
                style={styles.recordingDot}
                className="recording-dot"
              />
              Recording
            </>
          )}
        </div>
        
        <button 
          className="control-btn btn-danger"
          onClick={leaveDebate}
          title="Leave Debate"
        >
          ❌
        </button>
      </div>
      
      {/* Recording status indicator */}
      {recordingStatus !== 'idle' && (
        <div className={`recording-status ${recordingStatus}`}>
          {recordingStatus === 'recording' && (
            <span>
              Recording debate... {recordingTime > 0 && `(${formatTime(recordingTime)})`}
            </span>
          )}
          {recordingStatus === 'processing' && <span>Processing recording...</span>}
          {recordingStatus === 'uploading' && <span>Uploading recording... ({uploadProgress}%)</span>}
          {recordingStatus === 'uploaded' && (
            <>
              <span>Recording uploaded successfully!</span>
              <button 
                className="btn btn-primary view-results-btn"
                onClick={() => navigate(`/debates/${debateRoomId}/results`)}
                style={{
                  marginLeft: '10px',
                  padding: '5px 15px',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                View Results
              </button>
            </>
          )}
          {recordingStatus === 'error' && <span>Recording error occurred</span>}
        </div>
      )}
    </div>
  );
};

export default DebateRoomPage; 