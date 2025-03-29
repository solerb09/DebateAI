/**
 * API routes for debate topics management
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// In-memory storage for debate topics
// In a production app, you'd use a database instead
let debates = [
  {
    id: '1',
    title: 'Should AI be regulated?',
    description: 'A debate on the ethics and necessity of AI regulation',
    creator: 'user1',
    status: 'open', // open, active, closed
    createdAt: new Date()
  }
];

// Get all debates
router.get('/', (req, res) => {
  res.json(debates);
});

// Get a specific debate
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    // First look in the in-memory array for backward compatibility
    const debate = debates.find(d => d.id === id);
    if (debate) {
      return res.json(debate);
    }
    
    // If not found in memory, check the database
    const { data, error } = await supabase
      .from('debate_rooms')
      .select('*, debate_topics(title, description)')
      .eq('id', id)
      .single();
      
    if (error) {
      if (error.code === 'PGRST116') { // No rows found
        return res.status(404).json({ error: 'Debate not found' });
      }
      console.error(`Error fetching debate from database: ${error.message}`);
      return res.status(500).json({ error: 'Database error', details: error.message });
    }
    
    // Format the debate data to match the expected structure
    const formattedDebate = {
      id: data.id,
      title: data.debate_topics?.title || 'Unknown Topic',
      description: data.debate_topics?.description || '',
      status: data.status,
      createdAt: data.created_at,
      endedAt: data.ended_at,
      topicId: data.topic_id
    };
    
    res.json(formattedDebate);
  } catch (err) {
    console.error(`Unexpected error fetching debate: ${err.message}`);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Create a new debate
router.post('/', (req, res) => {
  const { title, description, creator } = req.body;
  
  // Validate required fields
  if (!title || !description || !creator) {
    return res.status(400).json({ error: 'Title, description, and creator are required' });
  }
  
  // Create new debate
  const newDebate = {
    id: Date.now().toString(),
    title,
    description,
    creator,
    status: 'open',
    createdAt: new Date()
  };
  
  debates.push(newDebate);
  res.status(201).json(newDebate);
});

// Update a debate (e.g., changing status)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  try {
    // First try to update in the in-memory array for backward compatibility
    const index = debates.findIndex(d => d.id === id);
    let inMemoryUpdated = false;
    
    if (index !== -1) {
      // Update in-memory debate
      debates[index] = {
        ...debates[index],
        ...req.body,
        updatedAt: new Date()
      };
      inMemoryUpdated = true;
    }
    
    // Also update the debate in the database - updating just the status, not timestamps
    const { data, error } = await supabase
      .from('debate_rooms')
      .update({ status }) // Remove the updated_at field that doesn't exist
      .eq('id', id)
      .select()
      .single();
      
    if (error) {
      console.error(`Error updating debate in database: ${error.message}`);
      
      // If we updated in-memory but database failed, still consider it a success
      if (inMemoryUpdated) {
        return res.json(debates[index]);
      }
      
      // Otherwise, handle as not found or another error
      if (error.code === 'PGRST116') { // No rows updated
        return res.status(404).json({ error: 'Debate not found' });
      }
      
      return res.status(500).json({ error: 'Database error', details: error.message });
    }
    
    // Update the in-memory room state if it exists
    if (req.app.locals.debateRooms && req.app.locals.debateRooms[id]) {
      req.app.locals.debateRooms[id].status = status;
    }
    
    res.json(data || (inMemoryUpdated ? debates[index] : { id, status }));
  } catch (err) {
    console.error(`Unexpected error updating debate: ${err.message}`);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Delete a debate
router.delete('/:id', (req, res) => {
  const index = debates.findIndex(d => d.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Debate not found' });
  }
  
  debates.splice(index, 1);
  res.status(204).send();
});

// Get debate participants
router.get('/:debateId/participants', async (req, res) => {
  try {
    const { debateId } = req.params;
    
    if (!debateId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing debate ID' 
      });
    }
    
    // Get participants from the database
    const { data: dbParticipants, error } = await supabase
      .from('debate_participants')
      .select('id, user_id, side, is_ready, joined_at, left_at')
      .eq('room_id', debateId)
      .is('left_at', null);
      
    if (error) {
      console.error('Error fetching debate participants:', error);
      return res.status(500).json({ success: false, message: 'Error fetching debate participants' });
    }
    
    // Get in-memory participants if they exist
    let memoryParticipants = [];
    if (req.app.locals.debateRooms && req.app.locals.debateRooms[debateId]) {
      memoryParticipants = req.app.locals.debateRooms[debateId].participants;
    }
    
    // Get debate status from memory
    const debateStatus = req.app.locals.debateRooms && req.app.locals.debateRooms[debateId]?.status || 'unknown';
    const debateRoles = req.app.locals.debateRooms && req.app.locals.debateRooms[debateId]?.roles || {};
    const currentTurn = req.app.locals.debateRooms && req.app.locals.debateRooms[debateId]?.turn || null;
    
    res.json({ 
      success: true,
      data: {
        database_participants: dbParticipants,
        memory_participants: memoryParticipants,
        debate_status: debateStatus,
        roles: debateRoles,
        current_turn: currentTurn
      }
    });
  } catch (error) {
    console.error('Error checking debate participants:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Manually assign debate roles
router.post('/:debateId/assign-roles', async (req, res) => {
  try {
    const { debateId } = req.params;
    const { pro_user_id, con_user_id } = req.body;
    
    if (!debateId || !pro_user_id || !con_user_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required parameters. Please provide debateId, pro_user_id, and con_user_id.' 
      });
    }
    
    // Update the pro participant
    const { error: proError } = await supabase
      .from('debate_participants')
      .update({ side: 'pro' })
      .eq('room_id', debateId)
      .eq('user_id', pro_user_id)
      .is('left_at', null);
      
    if (proError) {
      console.error('Error updating pro role:', proError);
      return res.status(500).json({ success: false, message: 'Error updating pro role' });
    }
    
    // Update the con participant
    const { error: conError } = await supabase
      .from('debate_participants')
      .update({ side: 'con' })
      .eq('room_id', debateId)
      .eq('user_id', con_user_id)
      .is('left_at', null);
      
    if (conError) {
      console.error('Error updating con role:', conError);
      return res.status(500).json({ success: false, message: 'Error updating con role' });
    }
    
    // If this debate exists in memory, update its roles too
    if (req.app.locals.debateRooms && req.app.locals.debateRooms[debateId]) {
      // Create roles object if it doesn't exist
      if (!req.app.locals.debateRooms[debateId].roles) {
        req.app.locals.debateRooms[debateId].roles = {};
      }
      
      // Set roles in memory
      req.app.locals.debateRooms[debateId].roles[pro_user_id] = 'pro';
      req.app.locals.debateRooms[debateId].roles[con_user_id] = 'con';
      
      console.log(`Updated roles in memory for debate ${debateId}`);
    }
    
    res.json({ 
      success: true, 
      message: 'Debate roles assigned successfully',
      data: {
        pro: pro_user_id,
        con: con_user_id
      }
    });
  } catch (error) {
    console.error('Error assigning debate roles:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create or update debate participants
router.post('/:debateId/create-participants', async (req, res) => {
  try {
    const { debateId } = req.params;
    const { participants } = req.body;
    
    if (!debateId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing debate ID' 
      });
    }
    
    if (!participants || !Array.isArray(participants) || participants.length < 1) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid participants data. Please provide an array of participants.' 
      });
    }
    
    const results = [];
    
    // Insert each participant
    for (const participant of participants) {
      if (!participant.user_id) {
        return res.status(400).json({ 
          success: false, 
          message: 'Each participant must have a user_id' 
        });
      }
      
      // Check if participant already exists
      const { data: existingParticipant, error: checkError } = await supabase
        .from('debate_participants')
        .select('id, user_id, side')
        .eq('room_id', debateId)
        .eq('user_id', participant.user_id)
        .is('left_at', null)
        .single();
        
      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "no rows returned" which is fine
        console.error('Error checking for existing participant:', checkError);
        results.push({
          user_id: participant.user_id,
          status: 'error',
          message: 'Error checking for existing participant'
        });
        continue;
      }
      
      // If participant already exists, update their data
      if (existingParticipant) {
        const { error: updateError } = await supabase
          .from('debate_participants')
          .update({
            side: participant.side || existingParticipant.side,
            is_ready: participant.is_ready !== undefined ? participant.is_ready : false
          })
          .eq('id', existingParticipant.id);
          
        if (updateError) {
          console.error('Error updating participant:', updateError);
          results.push({
            user_id: participant.user_id,
            status: 'error',
            message: 'Error updating participant'
          });
        } else {
          results.push({
            user_id: participant.user_id,
            status: 'updated',
            side: participant.side || existingParticipant.side
          });
        }
      } else {
        // Insert new participant
        const { data: newParticipant, error: insertError } = await supabase
          .from('debate_participants')
          .insert({
            room_id: debateId,
            user_id: participant.user_id,
            side: participant.side || null,
            is_ready: participant.is_ready !== undefined ? participant.is_ready : false,
            joined_at: new Date().toISOString()
          })
          .select()
          .single();
          
        if (insertError) {
          console.error('Error inserting participant:', insertError);
          results.push({
            user_id: participant.user_id,
            status: 'error',
            message: 'Error inserting participant'
          });
        } else {
          results.push({
            user_id: participant.user_id,
            status: 'created',
            id: newParticipant.id,
            side: newParticipant.side
          });
        }
      }
    }
    
    // If the debate room exists in memory, update it
    if (req.app.locals.debateRooms && req.app.locals.debateRooms[debateId]) {
      // Update roles in memory if sides were provided
      if (!req.app.locals.debateRooms[debateId].roles) {
        req.app.locals.debateRooms[debateId].roles = {};
      }
      
      for (const participant of participants) {
        if (participant.side) {
          req.app.locals.debateRooms[debateId].roles[participant.user_id] = participant.side;
        }
      }
      
      console.log(`Updated roles in memory for debate ${debateId}`);
    }
    
    res.json({
      success: true,
      message: 'Participants processed successfully',
      data: results
    });
  } catch (error) {
    console.error('Error creating/updating participants:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Debug endpoint to fix participant issues
router.post('/:debateId/fix-participants', async (req, res) => {
  try {
    const { debateId } = req.params;
    const { user_ids } = req.body;
    
    if (!debateId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing debate ID' 
      });
    }

    console.log(`Attempting to fix participants for debate ${debateId}`);
    
    // First, check if the debate room exists in memory
    const debateRoom = req.app.locals.debateRooms[debateId];
    if (!debateRoom) {
      console.log(`Creating empty debate room for ${debateId}`);
      req.app.locals.debateRooms[debateId] = { 
        participants: [],
        status: 'waiting',
        roles: {}
      };
    }
    
    // If we received user IDs, we can try to use those
    if (user_ids && Array.isArray(user_ids) && user_ids.length >= 2) {
      console.log(`Using provided user IDs for debate ${debateId}:`, user_ids);
      
      // Clear existing participants
      if (req.app.locals.debateRooms[debateId].participants) {
        req.app.locals.debateRooms[debateId].participants = [];
      } else {
        req.app.locals.debateRooms[debateId].participants = [];
      }
      
      // Add fake participants with socketIds (they won't receive events but will allow the debate to start)
      user_ids.forEach((userId, index) => {
        req.app.locals.debateRooms[debateId].participants.push({
          socketId: `debug-socket-${index}`,
          userId: userId,
          isReady: true // Mark them as ready
        });
      });
      
      // Set roles
      if (!req.app.locals.debateRooms[debateId].roles) {
        req.app.locals.debateRooms[debateId].roles = {};
      }
      req.app.locals.debateRooms[debateId].roles[user_ids[0]] = 'pro';
      req.app.locals.debateRooms[debateId].roles[user_ids[1]] = 'con';
      
      // Update or create database records
      for (let i = 0; i < Math.min(user_ids.length, 2); i++) {
        const userId = user_ids[i];
        const side = i === 0 ? 'pro' : 'con';
        
        // Check if participant already exists
        const { data: existingParticipant, error: checkError } = await supabase
          .from('debate_participants')
          .select('id')
          .eq('room_id', debateId)
          .eq('user_id', userId)
          .is('left_at', null)
          .single();
          
        if (checkError && checkError.code !== 'PGRST116') {
          console.error(`Error checking for participant ${userId}:`, checkError);
          continue;
        }
        
        if (existingParticipant) {
          // Update existing participant
          const { error: updateError } = await supabase
            .from('debate_participants')
            .update({
              side: side,
              is_ready: true
            })
            .eq('id', existingParticipant.id);
            
          if (updateError) {
            console.error(`Error updating participant ${userId}:`, updateError);
          } else {
            console.log(`Updated participant ${userId} to side ${side}`);
          }
        } else {
          // Create new participant
          const { error: insertError } = await supabase
            .from('debate_participants')
            .insert({
              room_id: debateId,
              user_id: userId,
              side: side,
              is_ready: true,
              joined_at: new Date().toISOString()
            });
            
          if (insertError) {
            console.error(`Error creating participant ${userId}:`, insertError);
          } else {
            console.log(`Created participant ${userId} with side ${side}`);
          }
        }
      }
    } else {
      // If we don't have user IDs, just log the current state
      console.log(`No user IDs provided for debate ${debateId}`);
    }
    
    // Log the current state of the room
    console.log(`Current state of room ${debateId}:`, JSON.stringify({
      participants: req.app.locals.debateRooms[debateId].participants,
      roles: req.app.locals.debateRooms[debateId].roles,
      status: req.app.locals.debateRooms[debateId].status
    }));
    
    // Return the current state
    res.json({
      success: true,
      message: 'Participant data debugging completed',
      data: {
        memory_state: req.app.locals.debateRooms[debateId],
        debug_info: 'Check server logs for more details'
      }
    });
  } catch (error) {
    console.error('Error in fix-participants:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Export the debates array for access from other modules
const getDebates = () => debates;

module.exports = router;
module.exports.getDebates = getDebates; 