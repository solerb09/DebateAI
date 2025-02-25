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
      this.localStream.getTracks().forEach(track => {
        console.log(`Adding ${track.kind} track to peer connection`);
        this.peerConnection.addTrack(track, this.localStream);
      });
    } else {
      console.warn('Cannot add tracks - localStream or peerConnection not available');
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
   * Set callback for when remote media stream is received
   */
  onRemoteStream(callback) {
    this.onRemoteStreamCallback = callback;
    // If we already have a remote stream, call the callback immediately
    if (this.remoteStream) {
      callback(this.remoteStream);
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
      this.peerConnection.close();
      this.peerConnection = null;
      console.log('Closed peer connection');
    }

    // Reset state
    this.isInitiator = false;
  }
}

export default WebRTCService; 