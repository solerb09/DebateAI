/**
 * API routes for handling audio uploads and transcription
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Instead of filesystem storage, use memory storage for temporary handling
const storage = multer.memoryStorage();

// Setup file filter for multer
const fileFilter = (req, file, cb) => {
  // Accept only audio files
  if (file.mimetype.startsWith('audio/')) {
    cb(null, true);
  } else {
    cb(new Error('Only audio files are allowed'), false);
  }
};

// Create multer upload instance with memory storage
const upload = multer({ 
  storage, 
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB max file size
  }
});

// In-memory storage for transcription jobs
const transcriptionJobs = {};

/**
 * Upload audio file and start transcription
 */
router.post('/upload', upload.single('audio'), async (req, res) => {
  let supabasePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded' });
    }

    const { debateId, userId, streamType } = req.body;
    
    if (!debateId || !userId || !streamType) {
      return res.status(400).json({ 
        error: 'Missing required fields (debateId, userId, streamType)' 
      });
    }

    console.log(`Received audio file for debate ${debateId}`);

    // Generate a transcription ID for tracking
    const transcriptionId = uuidv4();
    
    // Generate filename for Supabase storage
    const ext = path.extname(req.file.originalname) || '.webm';
    const filename = `${userId}-${streamType}-${Date.now()}${ext}`;
    const storagePath = `${debateId}/${filename}`;
    
    // Upload file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('debate-audio')
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
        cacheControl: '3600'
      });
      
    if (uploadError) {
      console.error('Error uploading to Supabase Storage:', uploadError);
      return res.status(500).json({
        error: 'Failed to store audio file',
        details: uploadError.message
      });
    }
    
    supabasePath = storagePath;
    
    // Create a signed URL with 2 hour expiry for OpenAI processing
    const { data: urlData, error: urlError } = await supabase
      .storage
      .from('debate-audio')
      .createSignedUrl(storagePath, 7200); // 2 hours in seconds
      
    if (urlError) {
      console.error('Error creating signed URL:', urlError);
      return res.status(500).json({
        error: 'Failed to generate access URL for audio',
        details: urlError.message
      });
    }
    
    // Store job info with Supabase details
    transcriptionJobs[transcriptionId] = {
      status: 'pending',
      userId,
      debateId,
      streamType,
      storagePath: storagePath,
      fileUrl: urlData.signedUrl,
      fileName: filename,
      timestamp: new Date(),
      result: null
    };

    // Start transcription process (async)
    startTranscription(transcriptionId);

    // Return success with the transcription ID for later querying
    res.status(200).json({
      success: true,
      message: 'Audio uploaded successfully, transcription started',
      transcriptionId,
      fileName: filename,
      debateId,
      userId,
      streamType
    });
  } catch (error) {
    console.error('Error uploading audio:', error);
    
    // Cleanup: If we uploaded to Supabase but something else failed, delete the file
    if (supabasePath) {
      try {
        await supabase.storage.from('debate-audio').remove([supabasePath]);
        console.log(`Cleaned up Supabase file after error: ${supabasePath}`);
      } catch (cleanupError) {
        console.error('Error during file cleanup:', cleanupError);
      }
    }
    
    res.status(500).json({
      error: 'Failed to process audio',
      details: error.message
    });
  }
});

/**
 * Get transcription status by ID
 */
router.get('/transcription/:id', (req, res) => {
  const transcriptionId = req.params.id;
  const job = transcriptionJobs[transcriptionId];
  
  if (!job) {
    return res.status(404).json({ 
      error: 'Transcription job not found' 
    });
  }
  
  // If job is complete, include the result
  if (job.status === 'completed') {
    return res.status(200).json({
      status: job.status,
      debateId: job.debateId,
      userId: job.userId,
      streamType: job.streamType,
      result: job.result
    });
  }
  
  // Otherwise just return the status
  res.status(200).json({
    status: job.status,
    debateId: job.debateId,
    userId: job.userId,
    streamType: job.streamType
  });
});

/**
 * Start the transcription process for a given job ID
 */
async function startTranscription(transcriptionId) {
  const job = transcriptionJobs[transcriptionId];
  
  if (!job) {
    console.error(`Transcription job ${transcriptionId} not found`);
    return;
  }
  
  try {
    console.log(`Starting transcription for job ${transcriptionId}`);
    job.status = 'processing';
    
    // Fetch the audio file from the signed URL
    const response = await fetch(job.fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio file: ${response.statusText}`);
    }
    
    const audioBuffer = await response.arrayBuffer();
    const audioFile = new File(
      [audioBuffer], 
      job.fileName, 
      { type: 'audio/webm' }
    );
    
    // Call OpenAI Whisper API with the fetched file
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en',
      response_format: 'verbose_json'
    });
    
    // Update job with transcription result
    job.status = 'completed';
    job.result = transcription;
    
    console.log(`Transcription completed for job ${transcriptionId}`);
    
    // Store the transcription in the database
    try {
      // First, try to determine the user's role in the debate
      const { data: participantData, error: participantError } = await supabase
        .from('debate_participants')
        .select('side')
        .eq('room_id', job.debateId)
        .eq('user_id', job.userId)
        .is('left_at', null)
        .single();
      
      // Default role to the streamType if we can't determine it
      const role = participantData?.side || (job.streamType === 'local' ? 'pro' : 'con');
      
      // Store the transcription in the database
      const { data, error } = await supabase
        .from('transcriptions')
        .insert({
          debate_id: job.debateId,
          user_id: job.userId,
          role: role,
          transcript: transcription.text,
          audio_path: job.storagePath,
          segments: transcription.segments,
          metadata: {
            streamType: job.streamType,
            duration: transcription.duration,
            wordCount: transcription.text.split(' ').length,
            storage_url: job.fileUrl.split('?')[0], // Store base URL without query params
            transcriptionId
          }
        });
      
      if (error) {
        console.error(`Error storing transcription in database:`, error);
      } else {
        console.log(`Transcription stored in database for debate ${job.debateId}, user ${job.userId}`);
      }
    } catch (dbError) {
      console.error(`Database error storing transcription:`, dbError);
    }
  } catch (error) {
    console.error(`Transcription error for job ${transcriptionId}:`, error);
    
    job.status = 'failed';
    job.error = error.message;
    
    // Cleanup the file from storage if transcription failed
    try {
      if (job.storagePath) {
        await supabase.storage.from('debate-audio').remove([job.storagePath]);
        console.log(`Cleaned up failed transcription audio: ${job.storagePath}`);
      }
    } catch (cleanupError) {
      console.error('Error during file cleanup after failed transcription:', cleanupError);
    }
  }
}

/**
 * Get all transcriptions for a specific debate
 */
router.get('/transcriptions/:debateId', async (req, res) => {
  try {
    const { debateId } = req.params;
    
    console.log(`[API] Fetching transcriptions for debate: ${debateId}`);
    
    if (!debateId) {
      return res.status(400).json({
        success: false,
        message: 'Debate ID is required'
      });
    }
    
    // Fetch transcriptions from the database without joining user data
    // This avoids the column name mismatch error
    const { data, error } = await supabase
      .from('transcriptions')
      .select('*')
      .eq('debate_id', debateId);
      
    if (error) {
      console.error(`[API] Error fetching transcriptions:`, error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching transcriptions',
        error: error.message
      });
    }
    
    // If we successfully got transcriptions, let's enrich them with user data if needed
    if (data && data.length > 0) {
      // Get unique user IDs from transcriptions
      const userIds = [...new Set(data.map(t => t.user_id))];
      
      // Fetch user data for those IDs if there are any
      if (userIds.length > 0) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, email, username')
          .in('id', userIds);
          
        if (!userError && userData) {
          // Create a map of user ID to user data for quick lookup
          const userMap = {};
          userData.forEach(user => {
            userMap[user.id] = user;
          });
          
          // Add user data to each transcription
          data.forEach(transcription => {
            transcription.user = userMap[transcription.user_id] || null;
          });
        } else if (userError) {
          console.warn(`[API] Could not fetch user data: ${userError.message}`);
        }
      }
    }
    
    // If no transcriptions found, check if any are in progress
    if (!data || data.length === 0) {
      // Check for in-progress transcriptions for this debate
      const pendingJobs = Object.values(transcriptionJobs).filter(
        job => job.debateId === debateId && job.status !== 'failed'
      );
      
      if (pendingJobs.length > 0) {
        return res.status(200).json({
          success: true,
          message: 'Transcriptions are still being processed',
          data: [],
          pending: pendingJobs.length,
          status: 'processing'
        });
      }
      
      return res.status(200).json({
        success: true,
        message: 'No transcriptions found for this debate',
        data: []
      });
    }
    
    console.log(`[API] Found ${data.length} transcriptions for debate ${debateId}`);
    
    res.status(200).json({
      success: true,
      message: 'Transcriptions retrieved successfully',
      data
    });
  } catch (error) {
    console.error(`[API] Unexpected error fetching transcriptions:`, error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Add a route to manually clean up old audio files
router.post('/cleanup', async (req, res) => {
  try {
    const { ageInHours = 24 } = req.body;
    
    // Get a list of files from the storage bucket
    const { data: files, error } = await supabase
      .storage
      .from('debate-audio')
      .list();
      
    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to list files',
        error: error.message
      });
    }
    
    const cutoffTime = new Date(Date.now() - (ageInHours * 60 * 60 * 1000));
    const filesToDelete = files.filter(file => new Date(file.created_at) < cutoffTime);
    
    if (filesToDelete.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No files to clean up',
        filesChecked: files.length
      });
    }
    
    // Delete the old files
    const filePaths = filesToDelete.map(file => file.name);
    const { error: deleteError } = await supabase
      .storage
      .from('debate-audio')
      .remove(filePaths);
      
    if (deleteError) {
      return res.status(500).json({
        success: false,
        message: 'Error deleting old files',
        error: deleteError.message
      });
    }
    
    res.status(200).json({
      success: true,
      message: `Successfully cleaned up ${filesToDelete.length} old audio files`,
      deletedCount: filesToDelete.length
    });
  } catch (error) {
    console.error('Error in cleanup routine:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during cleanup',
      error: error.message
    });
  }
});

module.exports = router; 