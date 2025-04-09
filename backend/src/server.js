/**
 * Main server file for the Debate Platform API
 * Handles HTTP requests and WebSocket connections for WebRTC signaling
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

console.log("CLIENT_URL is set to:", process.env.CLIENT_URL);

const { createClient } = require('@supabase/supabase-js');

// Import route handlers
const debateRoutes = require('./routes/debateRoutes');
const audioRoutes = require('./routes/audioRoutes');

//------------------------------------------------------
// Initialize Express and Socket.io
//------------------------------------------------------

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Set up Socket.io with CORS configuration
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors());
app.use(express.json());

//------------------------------------------------------
// Database and State Management
//------------------------------------------------------

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// In-memory storage for debate rooms and participants
const debateRooms = {};

// Make debateRooms available to routes
app.locals.debateRooms = debateRooms;

//------------------------------------------------------
// Routes Configuration
//------------------------------------------------------

// API routes
app.use('/api/debates', debateRoutes);
app.use('/api/audio', audioRoutes);

// Basic route
app.get('/', (req, res) => {
  res.send('Debate Platform API is running');
});

//------------------------------------------------------
// Helper Functions
//------------------------------------------------------

// Debug helper to print current room state
const logRoomState = (roomId) => {
  if (!debateRooms[roomId]) {
    console.log(`Room ${roomId} does not exist`);
    return;
  }
  
  console.log(`Room ${roomId} state:`, {
    participantCount: debateRooms[roomId].participants.length,
    participants: debateRooms[roomId].participants.map(p => ({ 
      socketId: p.socketId.substring(0, 6) + '...', // Truncate for readability
      userId: p.userId,
      isReady: p.isReady 
    })),
    status: debateRooms[roomId].status || 'unknown',
    roles: debateRooms[roomId].roles || {},
    turn: debateRooms[roomId].turn || null
  });
};

// Create or initialize a debate room
const initializeDebateRoom = (debateId) => {
  if (!debateRooms[debateId]) {
    debateRooms[debateId] = { 
      participants: [],
      roles: {},
      status: 'waiting'
    };
    console.log(`Created new debate room ${debateId}`);
  }
  
  // Ensure participants array exists and is valid
  if (!debateRooms[debateId].participants || !Array.isArray(debateRooms[debateId].participants)) {
    console.log(`Resetting participants array for room ${debateId}`);
    debateRooms[debateId].participants = [];
  }
  
  return debateRooms[debateId];
};

// Update debate status when a user leaves or disconnects
const handleUserLeavingDebate = (debateId) => {
  const room = debateRooms[debateId];
  
  // Clear any active turn timer
  if (room && room.turnTimer) {
    clearTimeout(room.turnTimer);
    room.turnTimer = null;
  }
  
  // If room is now empty or has only one participant, update debate status to 'open'
  if (room && room.participants.length <= 1) {
    // Find the debate in the debates array and update its status
    const debates = debateRoutes.getDebates();
    const debateIndex = debates.findIndex(d => d.id === debateId);
    
    if (debateIndex !== -1) {
      debates[debateIndex].status = 'open';
      console.log(`Updated debate ${debateId} status to 'open'`);
    }
  }
  
  // Clean up empty rooms
  if (room && room.participants.length === 0) {
    delete debateRooms[debateId];
    console.log(`Deleted empty room ${debateId}`);
  }
};

// Assign roles to debate participants
const assignDebateRoles = async (debateId, allParticipants) => {
  const debateRoom = debateRooms[debateId];
  
  try {
    console.log(`Fetching participant roles from database for debate ${debateId}...`);
    const { data: participantsData, error } = await supabase
      .from('debate_participants')
      .select('user_id, side')
      .eq('room_id', debateId)
      .is('left_at', null);
      
    if (error) {
      console.error('Error fetching participant roles from database:', error);
      throw error;
    }
    
    console.log(`Database participants for ${debateId}:`, JSON.stringify(participantsData));
    
    // Map user IDs to their roles from the database
    const participantRoles = {};
    participantsData.forEach(p => {
      if (p.side) { // Only include participants with assigned sides
        participantRoles[p.user_id] = p.side;
      }
    });
    
    // Check if we have roles for each participant
    const participantIds = allParticipants.map(p => p.userId);
    const missingRoles = participantIds.some(id => !participantRoles[id]);
    
    console.log(`Participant IDs in memory:`, JSON.stringify(participantIds));
    console.log(`Roles from database:`, JSON.stringify(participantRoles));
    
    // If roles are incomplete in the database, assign them dynamically
    if (Object.keys(participantRoles).length < 2 || missingRoles) {
      console.log('Incomplete role assignments in database, assigning roles dynamically');
      
      // Fallback to dynamic assignment
      debateRoom.roles = {};
      debateRoom.roles[allParticipants[0].userId] = 'pro';
      debateRoom.roles[allParticipants[1].userId] = 'con';
      
      // Update the roles in the database
      const updates = [
        {
          user_id: allParticipants[0].userId,
          side: 'pro',
          room_id: debateId
        },
        {
          user_id: allParticipants[1].userId,
          side: 'con',
          room_id: debateId
        }
      ];
      
      for (const update of updates) {
        await supabase
          .from('debate_participants')
          .update({ side: update.side })
          .eq('room_id', update.room_id)
          .eq('user_id', update.user_id)
          .is('left_at', null);
      }
    } else {
      console.log('Using roles from database:', participantRoles);
      debateRoom.roles = participantRoles;
    }
    
    return true;
  } catch (err) {
    console.error('Error in role assignment:', err);
    
    // Fallback to simple role assignment if there's an error
    debateRoom.roles = {};
    debateRoom.roles[allParticipants[0].userId] = 'pro';
    debateRoom.roles[allParticipants[1].userId] = 'con';
    
    return true;
  }
};

// Start debate after countdown completes
const startDebateAfterCountdown = (debateId, allParticipants) => {
  const debateRoom = debateRooms[debateId];
  
  console.log(`[DEBATE START] Starting debate ${debateId}`);
  
  // Clear any existing state to prevent issues
  if (debateRoom.turnTimer) {
    clearTimeout(debateRoom.turnTimer);
    debateRoom.turnTimer = null;
  }
  
  // Set STRICT debate structure:
  // 1. First turn is ALWAYS 'pro' (affirmative)
  // 2. Second turn is ALWAYS 'con' (negative)
  // 3. Then debate ends
  debateRoom.debateStructure = {
    // Strictly define the turns in order
    turnSequence: ['pro', 'con'],
    // Current position in the sequence (0-indexed, so 0 = first turn)
    currentPosition: 0,
    // Track which turns have been completed
    completedTurns: [],
    // Store when we started (for debugging)
    startTime: new Date().toISOString()
  };
  
  // Set first speaking turn to pro (affirmative)
  debateRoom.turn = 'pro';
  debateRoom.status = 'debating';
  
  console.log(`[DEBATE START] First turn is 'pro' (affirmative)`);
  console.log(`[DEBATE START] Debate structure: ${JSON.stringify(debateRoom.debateStructure)}`);
  
  // Initialize turn timer with 10 seconds for testing
  debateRoom.turnTimer = setTimeout(() => {
    handleTurnExpiration(debateId);
  }, 10000); // 10 seconds turn timer for testing
  
  // Notify clients that debate has started
  io.to(debateId).emit('debate_start', { 
    firstTurn: debateRoom.turn,
    roles: debateRoom.roles
  });
  
  console.log(`[DEBATE START] Debate ${debateId} started with roles:`, debateRoom.roles);
  console.log(`[DEBATE START] Turn timer set for 10 seconds`);
};

// Handle turn timer expiration
const handleTurnExpiration = (debateId) => {
  console.log(`[TIMER EXPIRED] Turn timer expired for debate ${debateId}`);
  
  // Get the debate room with validation
  const debateRoom = debateRooms[debateId];
  
  if (!debateRoom) {
    console.error(`[TIMER EXPIRED] Debate room ${debateId} not found`);
    return;
  }
  
  if (debateRoom.status !== 'debating') {
    console.log(`[TIMER EXPIRED] Debate ${debateId} is not in debating state (current: ${debateRoom.status})`);
    return;
  }
  
  // Prevent concurrent turn changes
  if (debateRoom.isTurnChanging) {
    console.log(`[TIMER EXPIRED] Turn change already in progress for debate ${debateId}`);
    return;
  }
  
  // Set the flag to prevent concurrent changes
  debateRoom.isTurnChanging = true;
  
  try {
    // CRITICAL: Ensure debate structure exists
    if (!debateRoom.debateStructure) {
      console.error(`[TIMER EXPIRED] Missing debate structure for ${debateId}, recreating it`);
      debateRoom.debateStructure = {
        turnSequence: ['pro', 'con'],
        currentPosition: 0,
        completedTurns: [],
        startTime: new Date().toISOString()
      };
      // Set to pro since we're recreating from scratch
      debateRoom.turn = 'pro';
    }
    
    // Get the current turn info
    const currentTurn = debateRoom.turn;
    const currentPosition = debateRoom.debateStructure.currentPosition;
    
    console.log(`[TIMER EXPIRED] Current turn is ${currentTurn} at position ${currentPosition}`);
    console.log(`[TIMER EXPIRED] Turn sequence: ${debateRoom.debateStructure.turnSequence.join(' → ')}`);
    console.log(`[TIMER EXPIRED] Completed turns: ${debateRoom.debateStructure.completedTurns.join(', ') || 'none'}`);
    
    // Mark the current turn as completed
    if (!debateRoom.debateStructure.completedTurns.includes(currentTurn)) {
      debateRoom.debateStructure.completedTurns.push(currentTurn);
      console.log(`[TIMER EXPIRED] Marked turn ${currentTurn} as completed`);
    }
    
    // Log the debate structure before advancing
    console.log(`[TIMER EXPIRED] Debate structure before advancing: ${JSON.stringify(debateRoom.debateStructure)}`);
    
    // CRITICAL: Current turn is done, advance to the next position in the sequence
    debateRoom.debateStructure.currentPosition++;
    const newPosition = debateRoom.debateStructure.currentPosition;
    console.log(`[TIMER EXPIRED] Advanced to position ${newPosition}`);
    
    // Check if we've reached the end of the sequence (both turns done)
    if (newPosition >= debateRoom.debateStructure.turnSequence.length) {
      // Both turns are completed - end the debate
      console.log(`[TIMER EXPIRED] DEBATE COMPLETE - All turns completed (position ${newPosition} >= ${debateRoom.debateStructure.turnSequence.length})`);
      console.log(`[TIMER EXPIRED] Completed turns: ${debateRoom.debateStructure.completedTurns.join(', ')}`);
      
      // Clear any existing timer
      if (debateRoom.turnTimer) {
        clearTimeout(debateRoom.turnTimer);
        debateRoom.turnTimer = null;
      }
      
      // Update debate status
      debateRoom.status = 'finished';
      
      // Notify clients that the debate has ended
      io.to(debateId).emit('debate_finished', {
        message: 'Debate has concluded'
      });
      
      // Also update the database status
      (async () => {
        try {
          const { error } = await supabase
            .from('debate_rooms')
            .update({ status: 'completed', ended_at: new Date().toISOString() })
            .eq('id', debateId);
            
          if (error) {
            console.error('[TIMER EXPIRED] Error updating debate status in database:', error);
          }
        } catch (err) {
          console.error('[TIMER EXPIRED] Failed to update debate status in database:', err);
        }
      })();
      
      debateRoom.isTurnChanging = false;
      return;
    }
    
    // If we're here, we need to set up the next turn
    const newTurn = debateRoom.debateStructure.turnSequence[newPosition];
    console.log(`[TIMER EXPIRED] Setting up next turn: '${newTurn}' (position ${newPosition})`);
    
    // Update the current turn
    debateRoom.turn = newTurn;
    
    // Notify all clients about the turn change
    console.log(`[TIMER EXPIRED] Broadcasting new turn ${newTurn} to room ${debateId}`);
    io.to(debateId).emit('speaking_turn', {
      turn: newTurn,
      timeRemaining: 10 // 10 seconds for testing
    });
    
    // Clear any existing timer
    if (debateRoom.turnTimer) {
      clearTimeout(debateRoom.turnTimer);
      debateRoom.turnTimer = null;
    }
    
    // Set new turn timer with 10 seconds for testing
    console.log(`[TIMER EXPIRED] Setting new turn timer for 10 seconds`);
    debateRoom.turnTimer = setTimeout(() => {
      handleTurnExpiration(debateId);
    }, 10000); // 10 seconds turn timer for testing
  } catch (error) {
    console.error(`[TIMER EXPIRED] Error handling turn expiration:`, error);
  } finally {
    // Clear the flag
    debateRoom.isTurnChanging = false;
  }
};

//------------------------------------------------------
// Socket.io Connection Handling
//------------------------------------------------------

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  //------------------
  // Room Management
  //------------------
  
  // Handle joining a debate room
  socket.on('join_debate', async ({ debateId, userId }) => {
    if (!debateId || !userId) {
      console.error('Join debate rejected: Missing required information');
      socket.emit('debate_error', { 
        code: 'MISSING_INFO',
        message: 'Missing debate ID or user ID' 
      });
      return;
    }

    try {
      console.log(`User ${userId} (${socket.id.substring(0, 6)}...) joining debate ${debateId}`);
      
      // Create or initialize room
      const debateRoom = initializeDebateRoom(debateId);
      
      // Check if this user is already in the room (same user connecting from a different tab/window)
      const existingUserIndex = debateRoom.participants.findIndex(p => p.userId.toString() === userId.toString());
      if (existingUserIndex >= 0) {
        console.log(`User ${userId} is already in debate ${debateId} with socket ID ${debateRoom.participants[existingUserIndex].socketId.substring(0, 6)}...`);
        socket.emit('debate_error', { 
          code: 'USER_ALREADY_IN_DEBATE',
          message: 'You are already participating in this debate in another window or tab.' 
        });
        return;
      }
      
      // Check if we already have 2 participants
      if (debateRoom.participants.length >= 2) {
        console.log(`Debate room ${debateId} is full, cannot add user ${userId}`);
        socket.emit('debate_error', { 
          code: 'DEBATE_ROOM_FULL',
          message: 'This debate already has two participants. Please join a different debate.' 
        });
        return;
      }
      
      // Get debate room information to check if this user created the debate
      try {
        const { data: roomData, error: roomError } = await supabase
          .from('debate_rooms')
          .select('creator_id')
          .eq('id', debateId)
          .single();
        
        if (!roomError && roomData) {
          // Prevent user from joining their own debate (if user ID matches creator_id)
          // Normalize the strings for comparison to handle potential format differences
          if (roomData.creator_id && roomData.creator_id.toString() === userId.toString()) {
            console.log(`User ${userId} attempted to join their own debate ${debateId}`);
            socket.emit('debate_error', { 
              code: 'CANNOT_JOIN_OWN_DEBATE',
              message: 'You cannot join your own debate. Please wait for another user to join.' 
            });
            return;
          }
        }
      } catch (dbError) {
        console.warn('Error checking debate creator:', dbError);
        // Continue - we can still let them join if this check fails
      }
      
      // Check if user is already in the debate_participants table
      try {
        const { data: existingParticipant, error: queryError } = await supabase
          .from('debate_participants')
          .select('id')
          .eq('room_id', debateId)
          .eq('user_id', userId)
          .is('left_at', null)
          .single();
        
        if (queryError && queryError.code !== 'PGRST116') { // PGRST116 is "no rows returned" which is fine
          console.warn('Error checking for existing participant:', queryError);
        }
        
        // If not found, insert a new record
        if (!existingParticipant) {
          const { error: insertError } = await supabase
            .from('debate_participants')
            .insert({
              room_id: debateId,
              user_id: userId,
              joined_at: new Date().toISOString(),
              is_ready: false
            });
          
          if (insertError) {
            console.warn('Error inserting participant record:', insertError);
          } else {
            console.log(`Added ${userId} to debate_participants table for debate ${debateId}`);
          }
        }
      } catch (dbError) {
        console.error('Database error while joining debate:', dbError);
      }
      
      // Add user to room
      debateRoom.participants.push({
        socketId: socket.id,
        userId
      });
        
      console.log(`Added user ${userId} to room ${debateId}, current participants:`, 
        JSON.stringify(debateRoom.participants.map(p => ({
          userId: p.userId,
          socketId: p.socketId.substring(0, 6) + '...'
        })))
      );
      
      // Join socket.io room
      socket.join(debateId);
      
      // Notify other participants
      socket.to(debateId).emit('user_joined', { userId });
      
      // If we have two participants, notify the room
      if (debateRoom.participants.length >= 2) {
        console.log(`Two participants in room ${debateId}:`, 
          debateRoom.participants.map(p => p.userId));
        
        io.to(debateId).emit('debate_participants_connected', { 
          participants: debateRoom.participants.map(p => p.userId) 
        });
      }
    } catch (error) {
      console.error(`Error in join_debate handler: ${error.message}`);
      socket.emit('debate_error', { 
        code: 'SERVER_ERROR',
        message: 'Server error when joining debate' 
      });
    }
  });

  // Handle leaving a debate
  socket.on('leave_debate', ({ debateId }) => {
    console.log(`User ${socket.id.substring(0, 6)}... leaving debate ${debateId}`);
    
    if (debateRooms[debateId]) {
      // Clear any active turn timer
      if (debateRooms[debateId].turnTimer) {
        clearTimeout(debateRooms[debateId].turnTimer);
        debateRooms[debateId].turnTimer = null;
      }
      
      // Find and remove the user from the room
      const participantIndex = debateRooms[debateId].participants.findIndex(
        p => p.socketId === socket.id
      );
      
      if (participantIndex !== -1) {
        // Get the user ID before removing
        const userId = debateRooms[debateId].participants[participantIndex].userId;
        
        // Remove from participants array
        debateRooms[debateId].participants.splice(participantIndex, 1);
        
        // Notify others
        socket.to(debateId).emit('user_left', { socketId: socket.id, userId });
        
        // Update debate status and clean up if needed
        handleUserLeavingDebate(debateId);
      }
    }
    
    // Leave socket.io room
    socket.leave(debateId);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id.substring(0, 6)}...`);
    
    // Check all rooms for this socket and clean up
    Object.keys(debateRooms).forEach(debateId => {
      const room = debateRooms[debateId];
      
      // Clear any active turn timer
      if (room.turnTimer) {
        clearTimeout(room.turnTimer);
        room.turnTimer = null;
      }
      
      // Check if this socket is in the room
      const participantIndex = room.participants.findIndex(p => p.socketId === socket.id);
      
      if (participantIndex !== -1) {
        // Get the user ID before removing
        const userId = room.participants[participantIndex].userId;
        
        // Remove from participants
        room.participants.splice(participantIndex, 1);
        
        // Notify others
        socket.to(debateId).emit('user_left', { socketId: socket.id, userId });
        
        // Update debate status and clean up if needed
        handleUserLeavingDebate(debateId);
      }
    });
  });

  //------------------
  // WebRTC Signaling
  //------------------
  
  // Handle WebRTC signaling: offer
  socket.on('offer', ({ debateId, offer }) => {
    console.log(`Received offer from ${socket.id.substring(0, 6)}... in debate ${debateId}`);
    
    // Find other participants in the room to send the offer to
    if (debateRooms[debateId]) {
      const otherParticipants = debateRooms[debateId].participants.filter(
        p => p.socketId !== socket.id
      );
      
      console.log(`Broadcasting offer to ${otherParticipants.length} other participants`);
      
      // Send the offer to all other participants
      otherParticipants.forEach(participant => {
        io.to(participant.socketId).emit('offer', {
          offer,
          from: socket.id
        });
      });
    }
  });

  // Handle WebRTC signaling: answer
  socket.on('answer', ({ debateId, answer }) => {
    console.log(`Received answer from ${socket.id.substring(0, 6)}... in debate ${debateId}`);
    
    // Find other participants in the room to send the answer to
    if (debateRooms[debateId]) {
      const otherParticipants = debateRooms[debateId].participants.filter(
        p => p.socketId !== socket.id
      );
      
      console.log(`Broadcasting answer to ${otherParticipants.length} other participants`);
      
      // Send the answer to all other participants
      otherParticipants.forEach(participant => {
        io.to(participant.socketId).emit('answer', {
          answer,
          from: socket.id
        });
      });
    }
  });

  // Handle WebRTC signaling: ICE candidate
  socket.on('ice_candidate', ({ debateId, candidate }) => {
    console.log(`Received ICE candidate from ${socket.id.substring(0, 6)}... in debate ${debateId}`);
    
    // Find other participants in the room to send the ICE candidate to
    if (debateRooms[debateId]) {
      const otherParticipants = debateRooms[debateId].participants.filter(
        p => p.socketId !== socket.id
      );
      
      console.log(`Broadcasting ICE candidate to ${otherParticipants.length} other participants`);
      
      // Send the ICE candidate to all other participants
      otherParticipants.forEach(participant => {
        io.to(participant.socketId).emit('ice_candidate', {
          candidate,
          from: socket.id
        });
      });
    }
  });

  //------------------
  // Debate Flow Management
  //------------------
  
  // Handle user readiness status 
  socket.on('user_ready', ({ debateId, userId, isReady }) => {
    try {
      console.log(`User ${userId} in debate ${debateId} set ready status: ${isReady}`);
      
      if (!debateId || !userId) {
        console.error('Ready status rejected: Missing required information');
        socket.emit('debate_error', { message: 'Missing debate ID or user ID' });
        return;
      }
      
      const debateRoom = debateRooms[debateId];
      if (!debateRoom) {
        console.log(`Debate room ${debateId} does not exist`);
        socket.emit('debate_error', { message: 'Debate room not found' });
        return;
      }
      
      // Validate we have enough participants
      if (!debateRoom.participants || !Array.isArray(debateRoom.participants) || debateRoom.participants.length < 2) {
        console.error(`Not enough participants in room ${debateId} to mark ready`);
        socket.emit('debate_error', { message: 'Cannot mark ready: waiting for another participant' });
        return;
      }
      
      // Find participant
      const participant = debateRoom.participants.find(p => p.userId === userId);
      if (!participant) {
        console.log(`Participant ${userId} not found in debate ${debateId}`);
        socket.emit('debate_error', { message: 'Your participant data was not found' });
        return;
      }
      
      // Store the ready status on the participant
      participant.isReady = isReady;
      
      // Update the readiness status in the database
      (async () => {
        try {
          const { error } = await supabase
            .from('debate_participants')
            .update({ is_ready: isReady })
            .eq('room_id', debateId)
            .eq('user_id', userId)
            .is('left_at', null);

          if (error) {
            console.error('Error updating ready status in database:', error);
          }
        } catch (err) {
          console.error('Failed to update ready status in database:', err);
        }
      })();
      
      // Notify other participants about the ready status change
      socket.to(debateId).emit('user_ready', { 
        userId, 
        isReady 
      });
      
      // Check if all participants are ready
      const allParticipants = debateRoom.participants;
      const readyParticipants = allParticipants.filter(p => p.isReady);
      
      console.log(`Debate ${debateId}: ${readyParticipants.length}/${allParticipants.length} participants ready`);
      
      // If all participants are ready and there are at least 2, start the countdown
      if (readyParticipants.length >= 2 && readyParticipants.length === allParticipants.length) {
        console.log(`All participants in debate ${debateId} are ready, starting countdown`);
        
        // Set debate status to 'ready'
        debateRoom.status = 'ready';
        
        // Emit ready event
        io.to(debateId).emit('debate_ready', {
          participants: allParticipants.map(p => p.userId)
        });
        
        // Start countdown (5 seconds)
        let count = 5;
        debateRoom.status = 'countdown';
        
        // IMPORTANT: Save a reference to the participants at the start of the countdown
        const countdownParticipants = [...debateRoom.participants];
        console.log(`Saving participants at start of countdown:`, JSON.stringify(countdownParticipants.map(p => ({
          userId: p.userId,
          socketId: p.socketId.substring(0, 6) + '...',
          isReady: p.isReady
        }))));
        
        // Send initial countdown event
        io.to(debateId).emit('debate_countdown', { count });
        
        const countdownInterval = setInterval(async () => {
          count--;
          
          // Send countdown update
          io.to(debateId).emit('debate_countdown', { count });
          
          // When countdown reaches zero, start the debate
          if (count <= 0) {
            clearInterval(countdownInterval);
            
            // If participants array is empty, restore it from our saved reference
            if (!debateRoom.participants || !Array.isArray(debateRoom.participants) || debateRoom.participants.length === 0) {
              console.log(`Participants array was empty, restoring from saved reference`);
              debateRoom.participants = countdownParticipants;
            }
            
            console.log(`Countdown reached zero for debate ${debateId}, checking participant data...`);
            console.log(`All participants at this point:`, JSON.stringify(debateRoom.participants.map(p => ({ 
              userId: p.userId, 
              isReady: p.isReady 
            }))));
            
            // Make sure we have valid participants before trying to assign roles
            if (!debateRoom.participants || !Array.isArray(debateRoom.participants) || debateRoom.participants.length < 2) {
              console.error(`Invalid participants data in room ${debateId}`, JSON.stringify(debateRoom.participants));
              
              // Last resort - try to fetch participants from the database
              try {
                console.log(`Attempting to recover participants from database for debate ${debateId}`);
                const { data: dbParticipants, error } = await supabase
                  .from('debate_participants')
                  .select('user_id, side, is_ready')
                  .eq('room_id', debateId)
                  .is('left_at', null);
                
                if (error) {
                  console.error(`Error fetching participants from database:`, error);
                } else if (dbParticipants && dbParticipants.length >= 2) {
                  console.log(`Recovered ${dbParticipants.length} participants from database`);
                  
                  // Reconstruct participants array from database
                  debateRoom.participants = dbParticipants.map(p => ({
                    userId: p.user_id,
                    isReady: p.is_ready,
                    socketId: `recovered_${p.user_id.substring(0, 6)}` // Create a placeholder socket ID
                  }));
                  
                  console.log(`Reconstructed participants:`, JSON.stringify(debateRoom.participants));
                } else {
                  console.error(`Not enough participants found in database:`, dbParticipants);
                }
              } catch (dbError) {
                console.error(`Exception while trying to recover participants:`, dbError);
              }
              
              // Check again if we have enough participants after recovery attempt
              if (!debateRoom.participants || !Array.isArray(debateRoom.participants) || debateRoom.participants.length < 2) {
                io.to(debateId).emit('debate_error', { 
                  message: 'Cannot start debate: not enough participants'
                });
                return;
              }
            }
            
            // Validate that all participants have userId
            for (let i = 0; i < Math.min(debateRoom.participants.length, 2); i++) {
              if (!debateRoom.participants[i] || !debateRoom.participants[i].userId) {
                console.error(`Invalid participant at index ${i} in room ${debateId}`, JSON.stringify(debateRoom.participants[i]));
                io.to(debateId).emit('debate_error', { 
                  message: 'Cannot start debate: invalid participant data'
                });
                debateRoom.status = 'waiting';
                return;
              }
            }
            
            // Assign roles to participants
            const rolesAssigned = await assignDebateRoles(debateId, debateRoom.participants);
            
            if (rolesAssigned) {
              // Start the debate
              startDebateAfterCountdown(debateId, debateRoom.participants);
            } else {
              // Handle role assignment failure
              io.to(debateId).emit('debate_error', { 
                message: 'Failed to assign debate roles'
              });
              debateRoom.status = 'waiting';
            }
          }
        }, 1000);
      }
    } catch (error) {
      console.error(`Error in user_ready handler: ${error.message}`);
      socket.emit('debate_error', { message: 'Server error when marking ready' });
    }
  });

  // Handle turn completion (when a speaker's time is up)
  socket.on('turn_complete', ({ debateId, userId }) => {
    console.log(`[TURN COMPLETE] Received turn_complete event from ${userId} for debate ${debateId}`);
    
    // Get the debate room
    const debateRoom = debateRooms[debateId];
    
    // Additional validation
    if (!debateRoom) {
      console.error(`[TURN COMPLETE] Debate room ${debateId} not found`);
      return;
    }
    
    // Prevent concurrent turn changes
    if (debateRoom.isTurnChanging) {
      console.log(`[TURN COMPLETE] Turn change already in progress for debate ${debateId}`);
      return;
    }
    
    // Set the flag to prevent multiple turn changes
    debateRoom.isTurnChanging = true;
    
    try {
      // CRITICAL: Ensure debate structure exists
      if (!debateRoom.debateStructure) {
        console.error(`[TURN COMPLETE] Missing debate structure for ${debateId}, recreating it`);
        debateRoom.debateStructure = {
          turnSequence: ['pro', 'con'],
          currentPosition: 0,
          completedTurns: [],
          startTime: new Date().toISOString()
        };
        // Set to pro since we're recreating from scratch
        debateRoom.turn = 'pro';
      }
      
      // Get the current turn info
      const currentTurn = debateRoom.turn;
      const currentPosition = debateRoom.debateStructure.currentPosition;
      
      console.log(`[TURN COMPLETE] Current turn is ${currentTurn} at position ${currentPosition}`);
      console.log(`[TURN COMPLETE] Turn sequence: ${debateRoom.debateStructure.turnSequence.join(' → ')}`);
      console.log(`[TURN COMPLETE] Completed turns: ${debateRoom.debateStructure.completedTurns.join(', ') || 'none'}`);
      
      // Log the full state
      console.log(`[TURN COMPLETE] Current debate state:`, {
        status: debateRoom.status,
        turn: debateRoom.turn,
        roles: debateRoom.roles,
        participantCount: debateRoom.participants?.length,
        debateStructure: debateRoom.debateStructure
      });
      
      // Mark the current turn as completed
      if (!debateRoom.debateStructure.completedTurns.includes(currentTurn)) {
        debateRoom.debateStructure.completedTurns.push(currentTurn);
        console.log(`[TURN COMPLETE] Marked turn ${currentTurn} as completed`);
      }
      
      // Log the debate structure before advancing
      console.log(`[TURN COMPLETE] Debate structure before advancing: ${JSON.stringify(debateRoom.debateStructure)}`);
      
      // CRITICAL: Current turn is done, advance to the next position in the sequence
      debateRoom.debateStructure.currentPosition++;
      const newPosition = debateRoom.debateStructure.currentPosition;
      console.log(`[TURN COMPLETE] Advanced to position ${newPosition}`);
      
      // Check if we've reached the end of the sequence (both turns done)
      if (newPosition >= debateRoom.debateStructure.turnSequence.length) {
        // Both turns are completed - end the debate
        console.log(`[TURN COMPLETE] DEBATE COMPLETE - All turns completed (position ${newPosition} >= ${debateRoom.debateStructure.turnSequence.length})`);
        console.log(`[TURN COMPLETE] Completed turns: ${debateRoom.debateStructure.completedTurns.join(', ')}`);
        
        // Clear any existing timer
        if (debateRoom.turnTimer) {
          clearTimeout(debateRoom.turnTimer);
          debateRoom.turnTimer = null;
        }
        
        // Update debate status
        debateRoom.status = 'finished';
        
        // Notify clients that the debate has ended
        io.to(debateId).emit('debate_finished', {
          message: 'Debate has concluded'
        });
        
        // Also update the database status
        (async () => {
          try {
            const { error } = await supabase
              .from('debate_rooms')
              .update({ status: 'completed', ended_at: new Date().toISOString() })
              .eq('id', debateId);
              
            if (error) {
              console.error('[TURN COMPLETE] Error updating debate status in database:', error);
            }
          } catch (err) {
            console.error('[TURN COMPLETE] Failed to update debate status in database:', err);
          }
        })();
        
        debateRoom.isTurnChanging = false;
        return;
      }
      
      // If we're here, we need to set up the next turn
      const newTurn = debateRoom.debateStructure.turnSequence[newPosition];
      console.log(`[TURN COMPLETE] Setting up next turn: '${newTurn}' (position ${newPosition})`);
      
      // Update the current turn
      debateRoom.turn = newTurn;
      
      // Clear the current turn timer if it exists
      if (debateRoom.turnTimer) {
        console.log(`[TURN COMPLETE] Clearing existing turn timer`);
        clearTimeout(debateRoom.turnTimer);
        debateRoom.turnTimer = null;
      }
      
      // Broadcast the new turn to all clients in the room
      console.log(`[TURN COMPLETE] Broadcasting new turn ${newTurn} to room ${debateId}`);
      io.to(debateId).emit('speaking_turn', {
        turn: newTurn,
        timeRemaining: 10 // 10 seconds for testing
      });
      
      // Set new turn timer
      console.log(`[TURN COMPLETE] Setting new turn timer for 10 seconds`);
      debateRoom.turnTimer = setTimeout(() => {
        console.log(`[TURN TIMER] Turn timer expired for debate ${debateId}`);
        handleTurnExpiration(debateId);
      }, 10000); // 10 seconds turn timer for testing
    } catch (error) {
      console.error(`[TURN COMPLETE] Error handling turn complete:`, error);
    } finally {
      // Clear the flag
      debateRoom.isTurnChanging = false;
    }
  });
});

//------------------------------------------------------
// Start Server
//------------------------------------------------------

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 