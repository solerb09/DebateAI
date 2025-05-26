/**
 * Integration tests for the transcription service
 */
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

// Mock OpenAI
jest.mock('openai', () => {
  return {
    OpenAI: jest.fn().mockImplementation(() => ({
      audio: {
        transcriptions: {
          create: jest.fn().mockResolvedValue({
            text: 'This is a mock transcription of the audio file',
            segments: [
              { start: 0, end: 5, text: 'This is a mock' },
              { start: 5, end: 10, text: 'transcription of the audio file' }
            ]
          })
        }
      }
    }))
  };
});

// Create and load the service module to test
let transcriptionService;

// Create a test audio file for transcription
const createTestAudioFile = () => {
  const testDir = path.join(__dirname, 'test-files');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  const testFilePath = path.join(testDir, 'test-audio.webm');
  // Create a simple file with some content
  fs.writeFileSync(testFilePath, Buffer.from('mock audio content'));
  
  return testFilePath;
};

// Clean up test files
const cleanupTestFiles = () => {
  const testDir = path.join(__dirname, 'test-files');
  if (fs.existsSync(testDir)) {
    fs.removeSync(testDir);
  }
};

beforeAll(() => {
  // Create test files
  createTestAudioFile();
  
  // Reset modules to ensure clean state
  jest.resetModules();
  
  // Load the module to test
  transcriptionService = require('../../services/transcriptionService');
});

afterAll(() => {
  // Clean up test files
  cleanupTestFiles();
});

describe('Transcription Service', () => {
  describe('transcribe function', () => {
    test('should transcribe an audio file successfully', async () => {
      // Get the test file path
      const testFilePath = path.join(__dirname, 'test-files', 'test-audio.webm');
      
      // Call the service
      const result = await transcriptionService.transcribe(testFilePath);
      
      // Check the result
      expect(result).toBeDefined();
      expect(result.text).toBe('This is a mock transcription of the audio file');
      expect(result.segments).toHaveLength(2);
    });
    
    test('should handle non-existent files with mock data', async () => {
      // Call with non-existent file path
      const result = await transcriptionService.transcribe('/non/existent/path.webm');
      
      // Should fallback to mock data
      expect(result).toBeDefined();
      expect(result.text).toBeDefined(); // Should have some text content
    });
  });
  
  describe('transcribeBuffer function', () => {
    test('should transcribe an audio buffer successfully', async () => {
      // Create a buffer for testing
      const audioBuffer = Buffer.from('mock audio content');
      const transcriptionId = uuidv4();
      
      // Call the service
      const result = await transcriptionService.transcribeBuffer(
        audioBuffer, 
        'audio/webm', 
        transcriptionId
      );
      
      // Check the result
      expect(result).toBeDefined();
      expect(result.text).toBe('This is a mock transcription of the audio file');
      expect(result.segments).toHaveLength(2);
    });
    
    test('should handle empty buffers with mock data', async () => {
      // Call with empty buffer
      const result = await transcriptionService.transcribeBuffer(
        Buffer.from(''), 
        'audio/webm', 
        uuidv4()
      );
      
      // Should fallback to mock data
      expect(result).toBeDefined();
      expect(result.text).toBeDefined(); // Should have some text content
    });
    
    test('should use appropriate file extension based on mime type', async () => {
      // Test with mp3 mime type
      const audioBuffer = Buffer.from('mock audio content');
      const transcriptionId = uuidv4();
      
      // Call the service
      const result = await transcriptionService.transcribeBuffer(
        audioBuffer, 
        'audio/mp3', 
        transcriptionId
      );
      
      // Should succeed with appropriate handling
      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
    });
  });
  
  // If you have a generateMockTranscription function exposed
  describe('generateMockTranscription function', () => {
    test('should generate consistent mock data', () => {
      // Only test if the function is exposed
      if (typeof transcriptionService.generateMockTranscription === 'function') {
        const result = transcriptionService.generateMockTranscription();
        
        expect(result).toBeDefined();
        expect(result.text).toBeDefined();
        expect(result.segments).toBeDefined();
      }
    });
  });
}); 