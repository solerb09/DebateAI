/**
 * API routes for testing functionality
 */

const express = require('express');
const router = express.Router();

// Get test call status
router.get('/call', (req, res) => {
  res.json({
    status: 'active',
    message: 'Test call room is active and ready for connections'
  });
});

// Get current participants in test room
router.get('/call/participants', (req, res) => {
  // This will be filled in by the server since it has access to the debateRooms object
  const TEST_ROOM_ID = 'test-call-room';
  const participants = req.app.locals.debateRooms?.[TEST_ROOM_ID]?.participants || [];
  
  res.json({
    count: participants.length,
    participants: participants.map(p => ({ userId: p.userId }))
  });
});

module.exports = router; 