/**
 * Main server file for the Debate Platform API
 * Handles HTTP requests and WebSocket connections for WebRTC signaling
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

console.log("ci cd CLIENT_URL is set to:", process.env.CLIENT_URL);

const { createClient } = require('@supabase/supabase-js');

// Import route handlers
const debateRoutes = require('./routes/debateRoutes');
const audioRoutes = require('./routes/audioRoutes');
const gradingRoutes = require('./routes/aiGrading');

// Import refactored modules
const debateLogic = require('./lib/debateLogic');
const { initializeSocketEvents } = require('./socket/socketHandlers');
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

// Make debateRooms available globally (or pass explicitly where needed)
// app.locals.debateRooms = debateRooms; // We'll pass it explicitly now

// Callback function for debateLogic to update the main debate list status
const updateDebateStatus = (debateId, newStatus) => {
  const debates = debateRoutes.getDebates(); // Access the shared debates array
  const debateIndex = debates.findIndex(d => d.id === debateId);
  if (debateIndex !== -1) {
    debates[debateIndex].status = newStatus;
    console.log(`Updated debate ${debateId} status to '${newStatus}' via callback`);
  } else {
    console.warn(`Attempted to update status for non-existent debate ${debateId}`);
  }
};
//------------------------------------------------------
// Routes Configuration
//------------------------------------------------------

// API routes
app.use('/api/debates', debateRoutes);
app.use('/api/audio', audioRoutes);
app.use('/api/grading', gradingRoutes)

// Basic route
app.get('/', (req, res) => {
  res.send('Debate Platform API is running');
});

// Helper functions are now in ./lib/debateLogic.js

//------------------------------------------------------
// Socket.io Event Initialization
//------------------------------------------------------

// Initialize all socket event handlers from the dedicated module
initializeSocketEvents(io, supabase, debateRooms, updateDebateStatus);

//------------------------------------------------------
// Start Server
//------------------------------------------------------

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 
