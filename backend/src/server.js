/**
 * Main server file for the Debate Platform API
 * Handles HTTP requests and WebSocket connections for WebRTC signaling
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Import route handlers
const debateRoutes = require('./routes/debateRoutes');
const testRoutes = require('./routes/testRoutes');
const audioRoutes = require('./routes/audioRoutes');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Set up Socket.io with CORS configuration
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for debate rooms and participants
// In a production app, you'd likely use a database
const debateRooms = {};

// Special test room ID (re-add this to fix the error)
const TEST_ROOM_ID = 'test-call-room';

// Initialize test room - always start with an empty participants array
debateRooms[TEST_ROOM_ID] = { participants: [] };

// Track user sessions to prevent duplicate entries
const userSessions = new Map();

// Make debateRooms available to routes
app.locals.debateRooms = debateRooms;
app.locals.TEST_ROOM_ID = TEST_ROOM_ID;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Routes
app.use('/api/debates', debateRoutes);
app.use('/api/test', testRoutes);
app.use('/api/audio', audioRoutes);

// Basic route
app.get('/', (req, res) => {
  res.send('Debate Platform API is running');
});

// Debug helper to print current room state
const logRoomState = (roomId) => {
  if (debateRooms[roomId]) {
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
  } else {
    console.log(`Room ${roomId} does not exist`);
  }
};

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle joining a debate room
  socket.on('join_debate', async ({ debateId, userId }) => {
    if (!debateId || !userId) {
      console.error('Join debate rejected: Missing required information');
      socket.emit('debate_error', { message: 'Missing debate ID or user ID' });
      return;
    }

    try {
      console.log(`User ${userId} (${socket.id.substring(0, 6)}...) joining debate ${debateId}`);
      
      // Create room if it doesn't exist
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
        console.log(`Resetting participants array for room ${debateId} - was:`, JSON.stringify(debateRooms[debateId].participants));
        debateRooms[debateId].participants = [];
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
          // Continue anyway - this is just a check
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
            // Continue anyway - socket connection can still work
          } else {
            console.log(`Added ${userId} to debate_participants table for debate ${debateId}`);
          }
        }
      } catch (dbError) {
        console.error('Database error while joining debate:', dbError);
        // Continue anyway - socket connection can still work
      }
      
      
      // Add user to room
      debateRooms[debateId].participants.push({
        socketId: socket.id,
        userId
      });
      
      console.log(`Added user ${userId} to room ${debateId}, current participants:`, 
        JSON.stringify(debateRooms[debateId].participants.map(p => ({
          userId: p.userId,
          socketId: p.socketId.substring(0, 6) + '...'
        })))
      );
      
      // Join socket.io room
      socket.join(debateId);
      
      // Notify other participants
      socket.to(debateId).emit('user_joined', { userId });
      
      // If this is the test room, broadcast participant count to all users in that room
      if (debateId === TEST_ROOM_ID) {
        // Log current participants for debugging
        logRoomState(TEST_ROOM_ID);
        
        io.to(debateId).emit('participant_count', { 
          count: debateRooms[debateId].participants.length 
        });
      }
      
      // If we have two participants, notify the room but don't mark as ready yet
      if (debateRooms[debateId].participants.length >= 2) {
        console.log(`Two participants in room ${debateId}:`, 
          debateRooms[debateId].participants.map(p => p.userId));
          
        // Don't emit 'debate_ready' here - only emit 'debate_participants_connected'
        io.to(debateId).emit('debate_participants_connected', { 
          participants: debateRooms[debateId].participants.map(p => p.userId) 
        });
      }
    } catch (error) {
      console.error(`Error in join_debate handler: ${error.message}`);
      socket.emit('debate_error', { message: 'Server error when joining debate' });
    }
  });

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

  // Handle leaving a debate
  socket.on('leave_debate', ({ debateId }) => {
    console.log(`User ${socket.id.substring(0, 6)}... leaving debate ${debateId}`);
    
    if (debateRooms[debateId]) {
      // Find and remove the user from the room
      const participantIndex = debateRooms[debateId].participants.findIndex(
        p => p.socketId === socket.id
      );
      
      if (participantIndex !== -1) {
        // Get the user ID before removing
        const userId = debateRooms[debateId].participants[participantIndex].userId;
        
        // Remove from participants array
        debateRooms[debateId].participants.splice(participantIndex, 1);
        
        // For test room, also clean up userSessions
        if (debateId === TEST_ROOM_ID && userId) {
          // Only remove from userSessions if this is the current socket for this user
          if (userSessions.get(userId) === socket.id) {
            userSessions.delete(userId);
          }
        }
        
        // Notify others
        socket.to(debateId).emit('user_left', { socketId: socket.id, userId });
      }
      
      // If this is the test room, broadcast updated participant count
      if (debateId === TEST_ROOM_ID) {
        logRoomState(TEST_ROOM_ID);
        
        io.to(debateId).emit('participant_count', { 
          count: debateRooms[debateId].participants.length 
        });
      }
      
      // If room is now empty or has only one participant, update debate status to 'open'
      if (debateId !== TEST_ROOM_ID && debateRooms[debateId].participants.length <= 1) {
        // Find the debate in the debates array and update its status
        const debateRoutes = require('./routes/debateRoutes');
        const debates = debateRoutes.getDebates();
        const debateIndex = debates.findIndex(d => d.id === debateId);
        
        if (debateIndex !== -1) {
          debates[debateIndex].status = 'open';
          console.log(`Updated debate ${debateId} status to 'open'`);
        }
      }
      
      // Clean up empty rooms (except test room)
      if (debateId !== TEST_ROOM_ID && debateRooms[debateId].participants.length === 0) {
        delete debateRooms[debateId];
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
      
      // Check if this socket is in the room
      const participantIndex = room.participants.findIndex(p => p.socketId === socket.id);
      
      if (participantIndex !== -1) {
        // Get the user ID before removing
        const userId = room.participants[participantIndex].userId;
        
        // Remove from participants
        room.participants.splice(participantIndex, 1);
        
        // For test room, also clean up userSessions
        if (debateId === TEST_ROOM_ID && userId) {
          // Only remove from userSessions if this is the current socket for this user
          if (userSessions.get(userId) === socket.id) {
            userSessions.delete(userId);
          }
        }
        
        // Notify others
        socket.to(debateId).emit('user_left', { socketId: socket.id, userId });
        
        // If this is the test room, broadcast updated participant count
        if (debateId === TEST_ROOM_ID) {
          logRoomState(TEST_ROOM_ID);
          
          io.to(debateId).emit('participant_count', { 
            count: room.participants.length 
          });
        }
        
        // If room is now empty or has only one participant, update debate status to 'open'
        if (debateId !== TEST_ROOM_ID && room.participants.length <= 1) {
          // Find the debate in the debates array and update its status
          const debateRoutes = require('./routes/debateRoutes');
          const debates = debateRoutes.getDebates();
          const debateIndex = debates.findIndex(d => d.id === debateId);
          
          if (debateIndex !== -1) {
            debates[debateIndex].status = 'open';
            console.log(`Updated debate ${debateId} status to 'open' after disconnect`);
          }
        }
        
        // Clean up empty rooms (except test room)
        if (debateId !== TEST_ROOM_ID && room.participants.length === 0) {
          delete debateRooms[debateId];
        }
      }
    });
  });

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
        
        // Send initial countdown event
        io.to(debateId).emit('debate_countdown', { count });
        
        const countdownInterval = setInterval(() => {
          count--;
          
          // Send countdown update
          io.to(debateId).emit('debate_countdown', { count });
          
          // When countdown reaches zero, start the debate
          if (count <= 0) {
            clearInterval(countdownInterval);
            
            console.log(`Countdown reached zero for debate ${debateId}, checking participant data...`);
            console.log(`All participants at this point:`, JSON.stringify(allParticipants));
            
            // Make sure we have valid participants before trying to assign roles
            if (!allParticipants || !Array.isArray(allParticipants) || allParticipants.length < 2) {
              console.error(`Invalid participants data in room ${debateId}`, JSON.stringify(allParticipants));
              io.to(debateId).emit('debate_error', { 
                message: 'Cannot start debate: not enough participants'
              });
              debateRoom.status = 'waiting';
              return;
            }
            
            // Validate that all participants have userId
            for (let i = 0; i < Math.min(allParticipants.length, 2); i++) {
              if (!allParticipants[i] || !allParticipants[i].userId) {
                console.error(`Invalid participant at index ${i} in room ${debateId}`, JSON.stringify(allParticipants[i]));
                io.to(debateId).emit('debate_error', { 
                  message: 'Cannot start debate: invalid participant data'
                });
                debateRoom.status = 'waiting';
                return;
              }
            }
            
            // Fetch participant roles from the database
            (async () => {
              try {
                console.log(`Fetching participant roles from database for debate ${debateId}...`);
                const { data: participantsData, error } = await supabase
                  .from('debate_participants')
                  .select('user_id, side')
                  .eq('room_id', debateId)
                  .is('left_at', null);
                  
                if (error) {
                  console.error('Error fetching participant roles from database:', error);
                  return;
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
                console.log(`Missing roles?`, missingRoles);
                
                // If roles are incomplete in the database, assign them
                if (Object.keys(participantRoles).length < 2 || missingRoles) {
                  console.log('Incomplete role assignments in database, assigning roles dynamically');
                  
                  // Fallback to dynamic assignment if database roles are incomplete
                  debateRoom.roles = {};
                  debateRoom.roles[allParticipants[0].userId] = 'pro';
                  debateRoom.roles[allParticipants[1].userId] = 'con';
                  
                  // Update the roles in the database
                  try {
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
                  } catch (err) {
                    console.error('Error updating roles in database:', err);
                  }
                } else {
                  console.log('Using roles from database:', participantRoles);
                  debateRoom.roles = participantRoles;
                }
                
                // Set first speaking turn
                debateRoom.turn = 'pro';
                debateRoom.status = 'debating';
                
                // Notify clients that debate has started
                io.to(debateId).emit('debate_start', { 
                  firstTurn: debateRoom.turn,
                  roles: debateRoom.roles
                });
                
                console.log(`Debate ${debateId} started with roles:`, debateRoom.roles);
              } catch (err) {
                console.error('Error in role assignment:', err);
                
                // Fallback to simple role assignment if there's an error
                debateRoom.roles = {};
                debateRoom.roles[allParticipants[0].userId] = 'pro';
                debateRoom.roles[allParticipants[1].userId] = 'con';
                
                // Set first speaking turn
                debateRoom.turn = 'pro';
                debateRoom.status = 'debating';
                
                // Notify clients that debate has started
                io.to(debateId).emit('debate_start', { 
                  firstTurn: debateRoom.turn,
                  roles: debateRoom.roles
                });
              }
            })();
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
    console.log(`Turn completed by user ${userId} in debate ${debateId}`);
    
    const debateRoom = debateRooms[debateId];
    if (!debateRoom || debateRoom.status !== 'debating') {
      console.log(`Cannot complete turn - debate ${debateId} is not in debating state`);
      return;
    }
    
    // Verify the user is the current speaker by checking roles
    const userRole = debateRoom.roles && debateRoom.roles[userId];
    if (!userRole || userRole !== debateRoom.turn) {
      console.log(`User ${userId} is not the current speaker`);
      return;
    }
    
    // Switch turns
    const newTurn = debateRoom.turn === 'pro' ? 'con' : 'pro';
    debateRoom.turn = newTurn;
    
    console.log(`Switching turn to ${newTurn}`);
    
    // Notify all clients about the turn change
    io.to(debateId).emit('speaking_turn', {
      turn: newTurn,
      timeRemaining: 120 // Reset to 2 minutes
    });
  });
});


// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 