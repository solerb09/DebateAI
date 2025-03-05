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
    
    // Add recording-related properties
    this.localRecorder = null;
    this.remoteRecorder = null;
    this.localAudioChunks = [];
    this.remoteAudioChunks = [];
    this.isRecording = false;
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

    // Handle debate ready event (both users present)
    this.socket.on('debate_ready', ({ participants }) => {
      console.log('Debate ready, participants:', participants);
      
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
      // Close any existing connection before creating a new one
      this.peerConnection.close();
    }
    
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
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
      console.log('ICE connection state:', this.peerConnection.iceConnectionState);
      if (this.peerConnection.iceConnectionState === 'connected') {
        console.log('ICE connected - peer connection established');
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
          this.remoteAudioChunks.push(event.data);
        }
      };
      
      this.remoteRecorder.onstop = () => {
        console.log('Remote recording stopped, chunks collected:', this.remoteAudioChunks.length);
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
        offerToReceiveVideo: true
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
    
    // Stop any active recordings
    if (this.isRecording) {
      if (this.localRecorder && this.localRecorder.state !== 'inactive') {
        this.localRecorder.stop();
      }
      
      if (this.remoteRecorder && this.remoteRecorder.state !== 'inactive') {
        this.remoteRecorder.stop();
      }
      
      this.isRecording = false;
    }
    
    // Clean up recorder objects
    this.localRecorder = null;
    this.remoteRecorder = null;
    this.localAudioChunks = [];
    this.remoteAudioChunks = [];
    
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
  }

  /**
   * Start recording both local and remote audio streams
   */
  startRecording() {
    if (this.isRecording) {
      console.log('Recording already in progress');
      return;
    }

    this.localAudioChunks = [];
    this.remoteAudioChunks = [];
    
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
    
    // Set up remote audio recording if we have a remote stream
    if (this.remoteStream) {
      // Create a new audio-only stream from the remote stream's audio tracks
      const remoteAudioStream = new MediaStream(this.remoteStream.getAudioTracks());
      
      const options = {
        mimeType: 'audio/webm',
        audioBitsPerSecond: 128000
      };
      
      try {
        this.remoteRecorder = new MediaRecorder(remoteAudioStream, options);
        
        this.remoteRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.remoteAudioChunks.push(event.data);
          }
        };
        
        this.remoteRecorder.onstop = () => {
          console.log('Remote recording stopped, chunks collected:', this.remoteAudioChunks.length);
        };
        
        // Start recording remote audio with 1-second chunks
        this.remoteRecorder.start(1000);
        console.log('Started remote audio recording');
      } catch (error) {
        console.error('Failed to start remote recording:', error);
      }
    } else {
      console.warn('No remote stream available for recording yet');
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
      
      // Stop remote recording if active
      if (this.remoteRecorder && this.remoteRecorder.state !== 'inactive') {
        pendingStops++;
        
        this.remoteRecorder.onstop = () => {
          console.log('Remote recording stopped');
          
          // Create a single blob from all chunks
          const remoteAudioBlob = new Blob(this.remoteAudioChunks, { type: 'audio/webm' });
          recordings.remote = {
            blob: remoteAudioBlob,
            url: URL.createObjectURL(remoteAudioBlob),
            size: remoteAudioBlob.size
          };
          
          checkComplete();
        };
        
        this.remoteRecorder.stop();
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
        const response = await fetch('/api/audio/upload', {
          method: 'POST',
          body: formData
        });
        
        if (response.ok) {
          results.local = await response.json();
          console.log('Local recording uploaded successfully');
        } else {
          throw new Error(`Server responded with ${response.status}`);
        }
      } catch (error) {
        console.error('Failed to upload local recording:', error);
        results.local = { error: error.message };
      }
    }
    
    // Upload remote recording if available
    if (recordings.remote) {
      try {
        const formData = new FormData();
        formData.append('audio', recordings.remote.blob, 'remote-audio.webm');
        formData.append('debateId', this.debateId);
        formData.append('userId', this.userId);
        formData.append('streamType', 'remote');
        
        console.log('Uploading remote recording...');
        const response = await fetch('/api/audio/upload', {
          method: 'POST',
          body: formData
        });
        
        if (response.ok) {
          results.remote = await response.json();
          console.log('Remote recording uploaded successfully');
        } else {
          throw new Error(`Server responded with ${response.status}`);
        }
      } catch (error) {
        console.error('Failed to upload remote recording:', error);
        results.remote = { error: error.message };
      }
    }
    
    return results;
  }
}

export default WebRTCService; 