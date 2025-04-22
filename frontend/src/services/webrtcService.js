/**
 * WebRTC Service for managing peer connections
 * Handles media capture, connection establishment, and signaling
 */

class WebRTCService {
  constructor(socket) {
    this.socket = socket;
    this.localStream = null;
    this.remoteStream = null;
    this.peerConnection = null;
    this.debateId = null;
    this.userId = null;
    this.onRemoteStreamCallback = null;
    this.onConnectionStateChangeCallback = null;
    this.isInitiator = false;
    this.isConnectionEstablished = false; // Add flag to track if connection is established
    this.reconnectAttempts = 0; // Track reconnection attempts
    this.maxReconnectAttempts = 3; // Maximum number of reconnection attempts
    this.lastIceState = null; // Track the last ICE connection state
    
    // Add recording-related properties
    this.localRecorder = null;
    this.localAudioChunks = [];
    
    // Media control flags
    this.isAudioEnabled = true;
    this.isVideoEnabled = true;
  }

  /**
   * Initialize the WebRTC service with a debate ID and user ID
   */
  init(debateId, userId) {
    this.debateId = debateId;
    this.userId = userId;
    
    // Set up socket listeners first
    this.setupSocketListeners();
    
    // Set up peer connection
    this.setupPeerConnection();

    console.log(`WebRTC service initialized for room ${debateId} and user ${userId}`);
  }

  /**
   * Set up the socket event listeners for WebRTC signaling
   */
  setupSocketListeners() {
    console.log('Setting up WebRTC socket listeners');
    
    // Handle incoming offer
    this.socket.on('offer', async ({ offer, from }) => {
      console.log('Received offer from peer', from);
      
      // Only handle offer if we don't already have an established connection
      if (this.isConnectionEstablished && this.peerConnection?.connectionState === 'connected') {
        console.log('Already have an established connection, ignoring offer');
        return;
      }
      
      await this.handleOffer(offer, from);
    });

    // Handle incoming answer
    this.socket.on('answer', async ({ answer }) => {
      console.log('Received answer from peer');
      await this.handleAnswer(answer);
    });

    // Handle incoming ICE candidate
    this.socket.on('ice_candidate', ({ candidate }) => {
      console.log('Received ICE candidate from peer');
      this.handleIceCandidate(candidate);
    });

    // Replace the 'debate_ready' event with 'debate_participants_connected'
    this.socket.on('debate_participants_connected', ({ participants }) => {
      console.log('Both participants are connected, ready for WebRTC:', participants);
      
      // Only initiate connection if we don't already have one established
      if (!this.isConnectionEstablished) {
        // If we are the first participant, initiate the call
        if (participants[0] === this.userId) {
          console.log('I am the initiator, creating offer');
          this.isInitiator = true;
          
          // Add a delay to make sure both peers are ready
          setTimeout(() => {
            this.createOffer();
          }, 1000);
        } else {
          console.log('I am the receiver, waiting for offer');
        }
      } else {
        console.log('Connection already established, skipping new connection setup');
      }
    });
    
    // Listen for debate_ready and other state changes but don't restart connection
    this.socket.on('debate_ready', ({ participants }) => {
      console.log('Debate ready, both participants have indicated readiness:', participants);
      // No WebRTC changes needed - keep existing connection
    });
    
    // Listen for debate start but don't restart connection
    this.socket.on('debate_start', ({ firstTurn, roles }) => {
      console.log('Debate started, maintaining WebRTC connection');
    });
    
    // Listen for debate finish but don't restart connection
    this.socket.on('debate_finished', ({ message }) => {
      console.log('Debate finished, maintaining WebRTC connection');
    });
  }

  /**
   * Join a debate room
   */
  joinDebate() {
    console.log(`Joining debate room: ${this.debateId} as user: ${this.userId}`);
    this.socket.emit('join_debate', {
      debateId: this.debateId,
      userId: this.userId
    });
  }

  /**
   * Set up the RTCPeerConnection with ICE servers and event handlers
   */
  setupPeerConnection() {
    if (this.peerConnection) {
      if (this.peerConnection.connectionState === 'connected' || 
          this.peerConnection.iceConnectionState === 'connected') {
        console.log('Connection already established, not recreating peer connection');
        return; // Don't recreate if already connected
      }
      
      // Close existing connection only if it's problematic
      console.log('Closing existing peer connection with state:', this.peerConnection.connectionState);
      this.peerConnection.close();
    }
    
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        // Add TURN servers for better reliability behind NATs
        {
          urls: 'turn:global.turn.twilio.com:3478?transport=udp',
          username: 'anyuser',  // These are placeholders - use actual credentials
          credential: 'anypass' // in a production environment
        }
      ]
    };

    this.peerConnection = new RTCPeerConnection(configuration);
    console.log('RTCPeerConnection created');

    // Handle ICE candidate events
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Generated ICE candidate');
        this.socket.emit('ice_candidate', {
          debateId: this.debateId,
          candidate: event.candidate
        });
      }
    };
    
    // Log ICE connection state changes
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection.iceConnectionState;
      console.log('ICE connection state changed:', state);
      
      // Track the state change for reconnection logic
      this.lastIceState = state;
      
      if (state === 'connected' || state === 'completed') {
        console.log('ICE connected - peer connection established');
        this.isConnectionEstablished = true;
        this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
      } 
      else if (state === 'disconnected') {
        console.log('ICE disconnected - may be temporary');
        // Don't do anything immediate - might recover on its own
      }
      else if (state === 'failed') {
        console.log('ICE connection failed - attempting to recover');
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
          // Don't recreate the whole connection - just restart ICE
          this.peerConnection.restartIce();
        }
      }
    };

    // Handle remote track arrival
    this.peerConnection.ontrack = (event) => {
      console.log('Received remote track', event.streams[0]);
      this.remoteStream = event.streams[0];
      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(this.remoteStream);
      }
      
      // If recording is already in progress, set up remote stream recording
      if (this.isRecording) {
        this.setupRemoteStreamRecording();
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      console.log('Connection state changed:', state);
      
      if (state === 'connected') {
        console.log('WebRTC connection established successfully');
        this.isConnectionEstablished = true;
      }
      
      if (this.onConnectionStateChangeCallback) {
        this.onConnectionStateChangeCallback(state);
      }
    };
  }
  
  /**
   * Add local media stream to peer connection
   */
  addLocalStreamToPeerConnection() {
    if (this.localStream && this.peerConnection) {
      console.log('Adding local tracks to peer connection');
      
      // Get current senders to check if tracks are already added
      const currentSenders = this.peerConnection.getSenders();
      const currentTrackIds = currentSenders.map(sender => 
        sender.track ? sender.track.id : null
      );
      
      this.localStream.getTracks().forEach(track => {
        // Only add the track if it's not already added
        if (!currentTrackIds.includes(track.id)) {
          console.log(`Adding ${track.kind} track to peer connection`);
          this.peerConnection.addTrack(track, this.localStream);
        } else {
          console.log(`Track ${track.kind} already exists in peer connection, skipping`);
        }
      });
    } else {
      console.warn('Cannot add tracks - localStream or peerConnection not available');
    }
  }

  /**
   * Set up remote stream recording when stream becomes available
   */
  setupRemoteStreamRecording() {
    if (!this.remoteStream || !this.isRecording) {
      return;
    }
    
    console.log('Setting up remote stream recording');
    
    // Create a new audio-only stream from the remote stream's audio tracks
    const remoteAudioTracks = this.remoteStream.getAudioTracks();
    
    if (remoteAudioTracks.length === 0) {
      console.warn('No audio tracks found in remote stream');
      return;
    }
    
    const remoteAudioStream = new MediaStream(remoteAudioTracks);
    
    const options = {
      mimeType: 'audio/webm',
      audioBitsPerSecond: 128000
    };
    
    try {
      // Stop any existing remote recorder
      if (this.remoteRecorder && this.remoteRecorder.state !== 'inactive') {
        this.remoteRecorder.stop();
      }
      
      this.remoteRecorder = new MediaRecorder(remoteAudioStream, options);
      
      this.remoteRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.localAudioChunks.push(event.data);
        }
      };
      
      this.remoteRecorder.onstop = () => {
        console.log('Remote recording stopped, chunks collected:', this.localAudioChunks.length);
      };
      
      // Start recording remote audio with 1-second chunks
      this.remoteRecorder.start(1000);
      console.log('Started remote audio recording');
    } catch (error) {
      console.error('Failed to start remote recording:', error);
    }
  }

  /**
   * Capture local media stream (audio and video)
   */
  async startLocalStream() {
    // If we already have a local stream with active tracks, reuse it
    if (this.localStream && this.localStream.getTracks().some(track => track.readyState === 'live')) {
      console.log('Reusing existing local stream');
      return this.localStream;
    }
    
    try {
      const mediaConstraints = {
        audio: true,
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      console.log('Requesting user media with constraints');
      this.localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      console.log('Local stream obtained with tracks:', this.localStream.getTracks().map(t => t.kind).join(', '));
      
      // Add tracks to the peer connection
      this.addLocalStreamToPeerConnection();
      
      return this.localStream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw error;
    }
  }

  /**
   * Create and send an offer to the remote peer
   */
  async createOffer() {
    try {
      // If we already have an established connection, don't create a new offer
      if (this.isConnectionEstablished && 
          (this.peerConnection.connectionState === 'connected' || 
           this.peerConnection.iceConnectionState === 'connected')) {
        console.log('Connection already established, not creating new offer');
        return;
      }
      
      console.log('Creating offer');
      
      // Make sure we have tracks added before creating offer
      this.addLocalStreamToPeerConnection();

      // Check if we already have a local description
      if (this.peerConnection.signalingState !== 'stable') {
        console.log('Cannot create offer - signaling state is not stable:', this.peerConnection.signalingState);
        return;
      }

      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
        iceRestart: true // Enable ICE restart to help with connectivity issues
      });
      
      console.log('Setting local description (offer)');
      await this.peerConnection.setLocalDescription(offer);

      console.log('Sending offer to peer');
      this.socket.emit('offer', {
        debateId: this.debateId,
        offer: offer
      });
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  }

  /**
   * Handle an incoming offer from a remote peer
   */
  async handleOffer(offer, from) {
    try {
      // Check if we're in a state where we can set a remote description
      if (this.peerConnection.signalingState !== 'stable') {
        console.log('Cannot handle offer - signaling state is not stable:', this.peerConnection.signalingState);
        
        // If we have a local description but no remote description, we can reset
        if (this.peerConnection.signalingState === 'have-local-offer') {
          console.log('Rolling back local description to handle incoming offer');
          await this.peerConnection.setLocalDescription({type: 'rollback'});
        } else {
          return; // Cannot proceed in current state
        }
      }
      
      console.log('Setting remote description from offer');
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      
      // Make sure we have tracks added before creating answer
      this.addLocalStreamToPeerConnection();
      
      console.log('Creating answer');
      const answer = await this.peerConnection.createAnswer();
      
      console.log('Setting local description (answer)');
      await this.peerConnection.setLocalDescription(answer);

      console.log('Sending answer to peer');
      this.socket.emit('answer', {
        debateId: this.debateId,
        answer: answer
      });
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }

  /**
   * Handle an incoming answer from a remote peer
   */
  async handleAnswer(answer) {
    try {
      // Check if we're in a state where we can set a remote answer
      if (this.peerConnection.signalingState !== 'have-local-offer') {
        console.log('Cannot handle answer - not in have-local-offer state:', this.peerConnection.signalingState);
        return;
      }
      
      console.log('Setting remote description from answer');
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('Remote description set successfully');
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }

  /**
   * Handle an incoming ICE candidate from a remote peer
   */
  async handleIceCandidate(candidate) {
    try {
      if (this.peerConnection) {
        console.log('Adding received ICE candidate');
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('ICE candidate added successfully');
      }
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  }

  /**
   * Handle remote track arrival
   */
  onRemoteStream(callback) {
    this.onRemoteStreamCallback = callback;
    
    // If we already have a remote stream (could happen if this is called after stream is received)
    if (this.remoteStream) {
      callback(this.remoteStream);
      
      // If recording is already in progress, set up remote stream recording
      if (this.isRecording) {
        this.setupRemoteStreamRecording();
      }
    }
  }

  /**
   * Set callback for connection state changes
   */
  onConnectionStateChange(callback) {
    this.onConnectionStateChangeCallback = callback;
  }

  /**
   * Toggle local audio
   */
  toggleAudio(enabled) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
        console.log(`Audio ${enabled ? 'enabled' : 'disabled'}`);
      });
    }
  }

  /**
   * Toggle local video
   */
  toggleVideo(enabled) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
        console.log(`Video ${enabled ? 'enabled' : 'disabled'}`);
      });
    }
  }

  /**
   * Leave the debate and clean up resources
   */
  leaveDebate() {
    console.log(`Leaving debate: ${this.debateId}`);
    this.socket.emit('leave_debate', { debateId: this.debateId });
    this.cleanup();
  }

  /**
   * Clean up resources
   */
  cleanup() {
    console.log('Cleaning up WebRTC resources');
    
    // Remove socket event listeners
    if (this.socket) {
      this.socket.off('offer');
      this.socket.off('answer');
      this.socket.off('ice_candidate');
      this.socket.off('debate_ready');
      this.socket.off('debate_participants_connected');
      this.socket.off('debate_start');
      this.socket.off('debate_finished');
    }
    
    // Stop any active recordings
    if (this.isRecording) {
      if (this.localRecorder && this.localRecorder.state !== 'inactive') {
        try {
          this.localRecorder.stop();
        } catch (e) {
          console.error('Error stopping local recorder:', e);
        }
      }
      
      this.isRecording = false;
      this.localRecorder = null;
      this.localAudioChunks = [];
    }
    
    // Clean up recorder objects
    
    // Stop all tracks in the local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped local track', track.kind);
      });
      this.localStream = null;
    }
    
    // Remove all tracks in the remote stream
    if (this.remoteStream) {
      this.remoteStream = null;
    }

    // Close the peer connection
    if (this.peerConnection) {
      // Remove all event listeners
      this.peerConnection.onicecandidate = null;
      this.peerConnection.oniceconnectionstatechange = null;
      this.peerConnection.ontrack = null;
      this.peerConnection.onconnectionstatechange = null;
      
      // Close the connection
      this.peerConnection.close();
      this.peerConnection = null;
      console.log('Closed peer connection');
    }
    
    // Reset state
    this.isInitiator = false;
    this.isConnectionEstablished = false;
    this.reconnectAttempts = 0;
    this.lastIceState = null;
  }

  /**
   * Start audio recording
   */
  startRecording() {
    if (this.isRecording) {
      console.log('Recording already in progress');
      return;
    }

    this.localAudioChunks = [];
    
    // Set up local audio recording if we have a local stream
    if (this.localStream) {
      // Create a new audio-only stream from the local stream's audio tracks
      const localAudioStream = new MediaStream(this.localStream.getAudioTracks());
      
      const options = {
        mimeType: 'audio/webm',
        audioBitsPerSecond: 128000
      };
      
      try {
        this.localRecorder = new MediaRecorder(localAudioStream, options);
        
        this.localRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.localAudioChunks.push(event.data);
          }
        };
        
        this.localRecorder.onstop = () => {
          console.log('Local recording stopped, chunks collected:', this.localAudioChunks.length);
        };
        
        // Start recording local audio with 1-second chunks
        this.localRecorder.start(1000);
        console.log('Started local audio recording');
      } catch (error) {
        console.error('Failed to start local recording:', error);
      }
    } else {
      console.warn('No local stream available for recording');
    }
    
    this.isRecording = true;
  }
  
  /**
   * Stop recording and return the audio blobs
   */
  stopRecording() {
    if (!this.isRecording) {
      console.log('No recording in progress');
      return null;
    }
    
    return new Promise((resolve) => {
      const recordings = {};
      let pendingStops = 0;
      
      const checkComplete = () => {
        pendingStops--;
        if (pendingStops <= 0) {
          this.isRecording = false;
          resolve(recordings);
        }
      };
      
      // Stop local recording if active
      if (this.localRecorder && this.localRecorder.state !== 'inactive') {
        pendingStops++;
        
        this.localRecorder.onstop = () => {
          console.log('Local recording stopped');
          
          // Create a single blob from all chunks
          const localAudioBlob = new Blob(this.localAudioChunks, { type: 'audio/webm' });
          recordings.local = {
            blob: localAudioBlob,
            url: URL.createObjectURL(localAudioBlob),
            size: localAudioBlob.size
          };
          
          checkComplete();
        };
        
        this.localRecorder.stop();
      }
      
      // If no recorders were active, resolve immediately
      if (pendingStops === 0) {
        this.isRecording = false;
        resolve(recordings);
      }
    });
  }
  
  /**
   * Upload the recorded audio to the server
   */
  async uploadRecordings(recordings) {
    if (!recordings) {
      console.error('No recordings to upload');
      return null;
    }
    
    const results = {};
    
    // Upload local recording if available
    if (recordings.local) {
      try {
        const formData = new FormData();
        formData.append('audio', recordings.local.blob, 'local-audio.webm');
        formData.append('debateId', this.debateId);
        formData.append('userId', this.userId);
        formData.append('streamType', 'local');
        
        console.log('Uploading local recording...');
        // Construct the full API URL using the environment variable
        const apiUrl = `${import.meta.env.VITE_API_URL}/api/audio/upload`;
        console.log(`Uploading to: ${apiUrl}`); // Log the actual URL being used
        const response = await fetch(apiUrl, {
          method: 'POST',
          body: formData
        });
        
        if (response.ok) {
          results.local = await response.json();
          console.log('Local recording uploaded successfully');
        } else {
          // Try to read the response body for more details, even if not JSON
          const errorText = await response.text(); 
          console.error(`Server responded with ${response.status}: ${errorText}`);
          // Check if the error text looks like HTML
          if (errorText.trim().startsWith('<!DOCTYPE') || errorText.trim().startsWith('<html')) {
            throw new Error(`Server responded with status ${response.status} and returned HTML, not JSON. Check API endpoint configuration.`);
          } else {
            // Attempt to parse as JSON if it wasn't HTML, might still fail
            try {
              results.local = { error: JSON.parse(errorText) };
            } catch (jsonError) {
              // If JSON parsing fails, use the raw text
              results.local = { error: `Server responded with ${response.status}: ${errorText}` };
            }
          }
          // Re-throw the specific error if it was HTML
          if (errorText.trim().startsWith('<!DOCTYPE') || errorText.trim().startsWith('<html')) {
             throw new Error(`Server responded with status ${response.status} and returned HTML.`);
          }
        }
      } catch (error) {
        // Log the specific error caught
        console.error('Failed to upload local recording:', error); 
        // Ensure the error message is captured in the results
        results.local = { error: error.message || 'Upload failed' }; 
      }
    }
    
    return results;
  }

  resetConnection() {
    console.log('Resetting WebRTC connection');
    
    // Clean up recording
    if (this.isRecording) {
      if (this.localRecorder && this.localRecorder.state !== 'inactive') {
        try {
          this.localRecorder.stop();
        } catch (e) {
          console.error('Error stopping local recorder:', e);
        }
      }
      
      this.isRecording = false;
      this.localRecorder = null;
      this.localAudioChunks = [];
    }
    
    // Close peer connection
    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch (err) {
        console.error('Error closing peer connection:', err);
      }
      this.peerConnection = null;
    }
    
    // Release media streams
    if (this.localStream) {
      this.stopMediaTracks(this.localStream);
      this.localStream = null;
    }
    
    // We don't stop remote stream tracks as they're managed by the peer connection
    this.remoteStream = null;
  }
}

export default WebRTCService;