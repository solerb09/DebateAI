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

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
fs.ensureDirSync(uploadsDir);

// Setup storage for multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const debateDir = path.join(uploadsDir, req.body.debateId || 'unknown');
    fs.ensureDirSync(debateDir);
    cb(null, debateDir);
  },
  filename: function (req, file, cb) {
    const userId = req.body.userId || 'unknown';
    const streamType = req.body.streamType || 'unknown';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${userId}-${streamType}-${uniqueSuffix}${ext}`);
  }
});

// Setup file filter for multer
const fileFilter = (req, file, cb) => {
  // Accept only audio files
  if (file.mimetype.startsWith('audio/')) {
    cb(null, true);
  } else {
    cb(new Error('Only audio files are allowed'), false);
  }
};

// Create multer upload instance
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

    console.log(`Received audio file: ${req.file.filename} for debate ${debateId}`);

    // Generate a transcription ID for tracking
    const transcriptionId = uuidv4();
    
    // Store job info
    transcriptionJobs[transcriptionId] = {
      status: 'pending',
      userId,
      debateId,
      streamType,
      filePath: req.file.path,
      fileName: req.file.filename,
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
      fileName: req.file.filename,
      debateId,
      userId,
      streamType
    });
  } catch (error) {
    console.error('Error uploading audio:', error);
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
    
    // Call OpenAI Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(job.filePath),
      model: 'whisper-1',
      language: 'en', // Specify language if known, or let Whisper auto-detect
      response_format: 'verbose_json'
    });
    
    // Update job with transcription result
    job.status = 'completed';
    job.result = transcription;
    
    console.log(`Transcription completed for job ${transcriptionId}`);
    
    // Store the transcription in database or perform additional processing
    // For now, we're just keeping it in memory
    
  } catch (error) {
    console.error(`Transcription error for job ${transcriptionId}:`, error);
    
    job.status = 'failed';
    job.error = error.message;
  }
}

module.exports = router; 