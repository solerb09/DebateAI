// backend/src/socket/socketHandlers.js

const debateLogic = require('../lib/debateLogic');

// This function will be called from server.js to set up all socket event listeners
const initializeSocketEvents = (io, supabase, debateRooms, updateDebateStatusCallback) => {

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

        // Create or initialize room using debateLogic
        const debateRoom = debateLogic.initializeDebateRoom(debateId, debateRooms);

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
          userId,
          isReady: false // Initialize readiness
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

          // Update debate status and clean up if needed using debateLogic
          debateLogic.handleUserLeavingDebate(debateId, debateRooms, updateDebateStatusCallback);
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

          // Notify others
          socket.to(debateId).emit('user_left', { socketId: socket.id, userId });

          // Update debate status and clean up if needed using debateLogic
          debateLogic.handleUserLeavingDebate(debateId, debateRooms, updateDebateStatusCallback);
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

              // Assign roles to participants using debateLogic
              const rolesAssigned = await debateLogic.assignDebateRoles(debateId, debateRoom.participants, debateRooms, supabase);

              if (rolesAssigned) {
                // Start the debate using debateLogic
                debateLogic.startDebateAfterCountdown(debateId, debateRoom.participants, debateRooms, io, supabase);
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

    // Handle turn completion (when a speaker's time is up or they finish early)
    socket.on('turn_complete', ({ debateId, userId }) => {
        console.log(`[TURN COMPLETE EVENT] Received turn_complete event from ${userId} for debate ${debateId}`);
        // Call the handleTurnExpiration logic directly, as it handles advancing the turn or ending the debate
        debateLogic.handleTurnExpiration(debateId, debateRooms, io, supabase);
    });

  }); // End io.on('connection')
};

module.exports = { initializeSocketEvents };