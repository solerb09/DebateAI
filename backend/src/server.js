/**
 * Main server file for the Debate Platform API
 * Handles HTTP requests and WebSocket connections for WebRTC signaling
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

// Import route handlers
const debateRoutes = require('./routes/debateRoutes');
const testRoutes = require('./routes/testRoutes');

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

// Special test room ID
const TEST_ROOM_ID = 'test-call-room';

// Initialize test room - always start with an empty participants array
debateRooms[TEST_ROOM_ID] = { participants: [] };

// Track user sessions to prevent duplicate entries
const userSessions = new Map();

// Make debateRooms available to routes
app.locals.debateRooms = debateRooms;
app.locals.TEST_ROOM_ID = TEST_ROOM_ID;

// Routes
app.use('/api/debates', debateRoutes);
app.use('/api/test', testRoutes);

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
        userId: p.userId 
      }))
    });
  } else {
    console.log(`Room ${roomId} does not exist`);
  }
};

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle joining a debate room
  socket.on('join_debate', ({ debateId, userId }) => {
    console.log(`User ${userId} (${socket.id.substring(0, 6)}...) joining debate ${debateId}`);
    
    // Create room if it doesn't exist
    if (!debateRooms[debateId]) {
      debateRooms[debateId] = { participants: [] };
    }
    
    // For test room: Check if this socket is already in the room's participants
    if (debateId === TEST_ROOM_ID) {
      // Remove any existing entries for this socket ID or user ID in the test room
      const initialCount = debateRooms[TEST_ROOM_ID].participants.length;
      debateRooms[TEST_ROOM_ID].participants = debateRooms[TEST_ROOM_ID].participants.filter(
        p => p.socketId !== socket.id && p.userId !== userId
      );
      
      const afterFilterCount = debateRooms[TEST_ROOM_ID].participants.length;
      if (initialCount !== afterFilterCount) {
        console.log(`Removed existing participant(s) for user ${userId}`);
      }
      
      // Map this user ID to this socket ID
      userSessions.set(userId, socket.id);
    }
    
    // Add user to room
    debateRooms[debateId].participants.push({
      socketId: socket.id,
      userId
    });
    
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
    
    // If we have two participants, start the debate
    if (debateRooms[debateId].participants.length >= 2) {
      console.log(`Debate ready in room ${debateId} with participants:`, 
        debateRooms[debateId].participants.map(p => p.userId));
        
      io.to(debateId).emit('debate_ready', { 
        participants: debateRooms[debateId].participants.map(p => p.userId) 
      });
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
});

// Add a route to reset the test room for debugging
app.post('/api/test/reset', (req, res) => {
  debateRooms[TEST_ROOM_ID] = { participants: [] };
  userSessions.clear();
  console.log('Test room has been reset');
  res.json({ success: true, message: 'Test room has been reset' });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 