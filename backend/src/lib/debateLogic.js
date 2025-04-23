/**
 * Helper functions for managing debate logic, state, and flow.
 */

// Debug helper to print current room state
const logRoomState = (roomId, debateRooms) => {
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
const initializeDebateRoom = (debateId, debateRooms) => {
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
// updateDebateStatusCallback should be a function like: (debateId, newStatus) => { ... }
const handleUserLeavingDebate = (debateId, debateRooms, updateDebateStatusCallback) => {
  const room = debateRooms[debateId];

  // Clear any active turn timer
  if (room && room.turnTimer) {
    clearTimeout(room.turnTimer);
    room.turnTimer = null;
  }

  // If room is now empty or has only one participant, update debate status to 'open'
  if (room && room.participants.length <= 1) {
    // Use the callback to update the status in the main list
    if (updateDebateStatusCallback && typeof updateDebateStatusCallback === 'function') {
        updateDebateStatusCallback(debateId, 'open');
        console.log(`Requested status update for debate ${debateId} to 'open'`);
    } else {
        console.warn(`No valid updateDebateStatusCallback provided for debate ${debateId}`);
    }
  }

  // Clean up empty rooms
  if (room && room.participants.length === 0) {
    delete debateRooms[debateId];
    console.log(`Deleted empty room ${debateId}`);
  }
};

// Assign roles to debate participants
const assignDebateRoles = async (debateId, allParticipants, debateRooms, supabase) => {
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

// Handle turn timer expiration - needs to be defined before startDebateAfterCountdown uses it in setTimeout
const handleTurnExpiration = async (debateId, debateRooms, io, supabase) => {
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
      timeRemaining: 60 // 1 minute per turn
    });

    // Clear any existing timer
    if (debateRoom.turnTimer) {
      clearTimeout(debateRoom.turnTimer);
      debateRoom.turnTimer = null;
    }

    // Set new turn timer with 60 seconds
    console.log(`[TIMER EXPIRED] Setting new turn timer for 60 seconds`);
    debateRoom.turnTimer = setTimeout(() => {
      // Pass necessary arguments to the handler
      handleTurnExpiration(debateId, debateRooms, io, supabase);
    }, 60000); // 60 seconds turn timer
  } catch (error) {
    console.error(`[TIMER EXPIRED] Error handling turn expiration:`, error);
  } finally {
    // Clear the flag
    debateRoom.isTurnChanging = false;
  }
};


// Start debate after countdown completes
const startDebateAfterCountdown = (debateId, allParticipants, debateRooms, io, supabase) => {
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

  // Initialize turn timer with 60 seconds
  debateRoom.turnTimer = setTimeout(() => {
    // Pass necessary arguments to the handler
    handleTurnExpiration(debateId, debateRooms, io, supabase);
  }, 60000); // 60 seconds turn timer

  // Notify clients that debate has started
  io.to(debateId).emit('debate_start', {
    firstTurn: debateRoom.turn,
    roles: debateRoom.roles
  });

  console.log(`[DEBATE START] Debate ${debateId} started with roles:`, debateRoom.roles);
  console.log(`[DEBATE START] Turn timer set for 60 seconds`);
};


module.exports = {
  logRoomState,
  initializeDebateRoom,
  handleUserLeavingDebate,
  assignDebateRoles,
  startDebateAfterCountdown,
  handleTurnExpiration
};