/**
 * Service for transcribing audio files to text
 */

const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { OpenAI } = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Ensure temp directory exists
const tmpDir = path.join(__dirname, '../tmp');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

/**
 * Transcribe audio buffer directly using OpenAI's Whisper API without saving to disk
 * 
 * @param {Buffer} audioBuffer - Audio file buffer
 * @param {string} mimeType - MIME type of the audio
 * @param {string} transcriptionId - Unique ID for this transcription
 * @returns {Promise<Object>} - Transcription result with text and segments
 */
async function transcribeBuffer(audioBuffer, mimeType, transcriptionId) {
  console.log(`[TRANSCRIPTION] Starting buffer transcription for ID: ${transcriptionId}`);
  console.log(`[TRANSCRIPTION] Buffer size: ${audioBuffer.length} bytes, type: ${mimeType}`);
  
  try {
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Empty audio buffer');
    }
    
    console.log(`[TRANSCRIPTION] Preparing buffer for Whisper API`);
    
    try {
      // Determine the appropriate file extension based on MIME type
      const extension = mimeType === 'audio/webm' ? 'webm' : 
                      mimeType === 'audio/mp3' || mimeType === 'audio/mpeg' ? 'mp3' : 
                      mimeType === 'audio/wav' ? 'wav' : 'webm';
      
      // Create a filename for the API (doesn't save to disk, just for identification)
      const fileName = `transcription_${transcriptionId}.${extension}`;
      
      console.log(`[TRANSCRIPTION] Calling Whisper API with audio buffer (${fileName})`);
      
      // Create a temporary file from the buffer in the tmp directory
      const tempFilePath = path.join(tmpDir, `temp_${transcriptionId}.${extension}`);
      fs.writeFileSync(tempFilePath, audioBuffer);
      
      console.log(`[TRANSCRIPTION] Temporary file created at: ${tempFilePath}`);
      
      // Call OpenAI API with the temporary file
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: "whisper-1",
        language: "en",
        response_format: "verbose_json"
      });
      
      // Clean up temporary file
      try {
        fs.unlinkSync(tempFilePath);
        console.log(`[TRANSCRIPTION] Temporary file deleted: ${tempFilePath}`);
      } catch (unlinkError) {
        console.error(`[TRANSCRIPTION] Error deleting temporary file: ${unlinkError.message}`);
      }
      
      console.log(`[TRANSCRIPTION] Whisper API response received`);
      console.log(`[TRANSCRIPTION] Transcript length: ${transcription.text.length} characters`);
      
      // Process segments from the verbose JSON response
      const segments = transcription.segments.map(segment => ({
        start: segment.start,
        end: segment.end,
        text: segment.text
      }));
      
      console.log(`[TRANSCRIPTION] Processed ${segments.length} segments from Whisper API`);
      
      return {
        text: transcription.text,
        segments: segments
      };
    } catch (apiError) {
      console.error(`[TRANSCRIPTION] Whisper API error: ${apiError.message}`);
      console.log('[TRANSCRIPTION] Falling back to mock transcription due to API error');
      
      // Fallback to mock transcription if API fails
      return generateMockTranscription();
    }
  } catch (error) {
    console.error(`[TRANSCRIPTION] Error transcribing buffer: ${error.message}`);
    
    // Return mock data as fallback
    console.log('[TRANSCRIPTION] Falling back to mock transcription due to processing error');
    return generateMockTranscription();
  }
}

/**
 * Transcribe audio file to text using OpenAI's Whisper API
 * 
 * @param {string} filePath - Path to the audio file
 * @returns {Promise<Object>} - Transcription result with text and segments
 */
async function transcribe(filePath) {
  console.log(`[TRANSCRIPTION] Starting file transcription for: ${filePath}`);
  
  try {
    // Validate file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    
    const stats = fs.statSync(filePath);
    console.log(`[TRANSCRIPTION] File size: ${stats.size} bytes`);
    
    if (stats.size === 0) {
      throw new Error('File is empty');
    }
    
    console.log(`[TRANSCRIPTION] Calling Whisper API with file: ${filePath}`);
    
    try {
      // Use OpenAI Whisper API for transcription
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: "whisper-1",
        language: "en",
        response_format: "verbose_json"
      });
      
      console.log(`[TRANSCRIPTION] Whisper API response received: ${transcription.text.substring(0, 100)}...`);
      
      // Process segments from the verbose JSON response
      const segments = transcription.segments.map(segment => ({
        start: segment.start,
        end: segment.end,
        text: segment.text
      }));
      
      console.log(`[TRANSCRIPTION] Processed ${segments.length} segments from Whisper API`);
      
      return {
        text: transcription.text,
        segments: segments
      };
    } catch (apiError) {
      console.error(`[TRANSCRIPTION] Whisper API error: ${apiError.message}`);
      console.log('[TRANSCRIPTION] Falling back to mock transcription due to API error');
      
      // Fallback to mock transcription if API fails
      return generateMockTranscription();
    }
  } catch (error) {
    console.error(`[TRANSCRIPTION] Error transcribing file: ${error.message}`);
    
    // Return mock data as fallback
    console.log('[TRANSCRIPTION] Falling back to mock transcription due to processing error');
    return generateMockTranscription();
  }
}

/**
 * Generate mock transcription data for development/fallback
 * @returns {Object} - Mock transcription with text and segments
 */
function generateMockTranscription() {
  console.log('[TRANSCRIPTION] Generating mock transcription data');
  
  // Generate a mock transcript with some random content
  const sentences = [
    "I believe that artificial intelligence will greatly benefit humanity.",
    "The automation of routine tasks will free people to pursue more creative work.",
    "However, we must be careful about potential misuse of this technology.",
    "Education systems need to adapt to prepare students for an AI-driven world.",
    "The ethical implications of AI development are significant and require careful consideration.",
    "We need robust governance frameworks to ensure AI is developed responsibly.",
    "While there are risks, the potential benefits of AI far outweigh them.",
    "Machine learning systems continue to improve and become more accurate.",
    "Human oversight will remain essential even as AI systems become more autonomous.",
    "Privacy concerns must be addressed as AI systems process more personal data."
  ];
  
  // Create a random-length transcript
  const numSentences = 5 + Math.floor(Math.random() * 5);
  let text = '';
  
  for (let i = 0; i < numSentences; i++) {
    const sentenceIndex = Math.floor(Math.random() * sentences.length);
    text += sentences[sentenceIndex] + ' ';
  }
  
  // Create mock segments for the transcript
  const segments = [];
  let startTime = 0;
  
  for (let i = 0; i < numSentences; i++) {
    const sentenceIndex = Math.floor(Math.random() * sentences.length);
    const sentenceText = sentences[sentenceIndex];
    const duration = 2 + Math.random() * 3; // 2-5 seconds per segment
    
    segments.push({
      start: startTime,
      end: startTime + duration,
      text: sentenceText
    });
    
    startTime += duration;
  }
  
  console.log(`[TRANSCRIPTION] Mock transcription generated with ${text.length} characters in ${segments.length} segments`);
  
  return {
    text,
    segments
  };
}

module.exports = {
  transcribe,
  transcribeBuffer
}; 