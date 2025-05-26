const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

// Mocks
jest.mock('@supabase/supabase-js', () => {
  const mockStorageInstance = {
    upload: jest.fn().mockResolvedValue({ 
      data: { path: 'some/path' }, 
      error: null 
    }),
    createSignedUrl: jest.fn().mockResolvedValue({ 
      data: { signedUrl: 'https://example.com/signed-url' }, 
      error: null 
    }),
    remove: jest.fn().mockResolvedValue({ 
      data: null, 
      error: null 
    })
  };

  const mockFromInstance = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: { side: 'pro' },
      error: null
    }),
    insert: jest.fn().mockResolvedValue({
      data: { id: 'mock-insert-id' },
      error: null
    })
  };

  return {
    createClient: jest.fn().mockReturnValue({
      storage: {
        from: jest.fn().mockReturnValue(mockStorageInstance)
      },
      from: jest.fn().mockReturnValue(mockFromInstance)
    })
  };
});

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
            ],
            duration: 10
          })
        }
      }
    }))
  };
});

jest.mock('node-fetch', () => jest.fn().mockImplementation(() => 
  Promise.resolve({
    ok: true,
    arrayBuffer: () => Promise.resolve(Buffer.from('mock audio data'))
  })
));

global.fetch = jest.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    arrayBuffer: () => Promise.resolve(Buffer.from('mock audio data'))
  })
);

// Create a test audio file
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

// Setup express app for testing
let app;
let server;

beforeAll(() => {
  // Create test audio file
  createTestAudioFile();

  // Set up the app
  app = express();
  
  // Mock environment variables
  process.env.SUPABASE_URL = 'https://example.com';
  process.env.SUPABASE_SERVICE_KEY = 'mock-service-key';
  process.env.OPENAI_API_KEY = 'mock-openai-key';
  
  // Load the routes
  const audioRoutes = require('../../src/routes/audioRoutes');
  
  // Add middleware
  app.use(express.json());
  
  // Add the routes
  app.use('/api/transcription', audioRoutes);
});

afterAll(() => {
  cleanupTestFiles();
  jest.resetModules();
  jest.clearAllMocks();
});

describe('Audio Routes Integration Tests', () => {
  describe('POST /api/transcription/upload', () => {
    test('should upload audio file and start transcription', async () => {
      // Create a test audio file buffer
      const audioBuffer = Buffer.from('mock audio content');
      
      // Send the request
      const response = await request(app)
        .post('/api/transcription/upload')
        .field('debateId', 'test-debate-id')
        .field('userId', 'test-user-id')
        .field('streamType', 'local')
        .attach('audio', audioBuffer, 'test-audio.webm');
      
      // Check response
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.transcriptionId).toBeDefined();
      expect(response.body.debateId).toBe('test-debate-id');
      expect(response.body.userId).toBe('test-user-id');
      expect(response.body.streamType).toBe('local');
    });

    test('should return 400 if no audio file is provided', async () => {
      const response = await request(app)
        .post('/api/transcription/upload')
        .field('debateId', 'test-debate-id')
        .field('userId', 'test-user-id')
        .field('streamType', 'local');
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No audio file uploaded');
    });

    test('should return 400 if required fields are missing', async () => {
      const audioBuffer = Buffer.from('mock audio content');
      
      const response = await request(app)
        .post('/api/transcription/upload')
        .field('debateId', 'test-debate-id')
        // Missing userId
        .field('streamType', 'local')
        .attach('audio', audioBuffer, 'test-audio.webm');
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing required fields');
    });

    test('should handle Supabase storage upload errors', async () => {
      // Override the mock to simulate an error
      const { createClient } = require('@supabase/supabase-js');
      const mockSupabase = createClient();
      const mockStorageFrom = mockSupabase.storage.from;
      
      mockStorageFrom().upload.mockResolvedValueOnce({
        data: null,
        error: { message: 'Storage upload failed' }
      });
      
      const audioBuffer = Buffer.from('mock audio content');
      
      const response = await request(app)
        .post('/api/transcription/upload')
        .field('debateId', 'test-debate-id')
        .field('userId', 'test-user-id')
        .field('streamType', 'local')
        .attach('audio', audioBuffer, 'test-audio.webm');
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to store audio file');
      expect(response.body.details).toBe('Storage upload failed');
    });

    test('should handle signed URL creation errors', async () => {
      // First make upload succeed
      const { createClient } = require('@supabase/supabase-js');
      const mockSupabase = createClient();
      const mockStorageFrom = mockSupabase.storage.from;
      
      mockStorageFrom().upload.mockResolvedValueOnce({
        data: { path: 'some/path' },
        error: null
      });
      
      // Then make signed URL creation fail
      mockStorageFrom().createSignedUrl.mockResolvedValueOnce({
        data: null,
        error: { message: 'URL creation failed' }
      });
      
      const audioBuffer = Buffer.from('mock audio content');
      
      const response = await request(app)
        .post('/api/transcription/upload')
        .field('debateId', 'test-debate-id')
        .field('userId', 'test-user-id')
        .field('streamType', 'local')
        .attach('audio', audioBuffer, 'test-audio.webm');
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to generate access URL for audio');
      expect(response.body.details).toBe('URL creation failed');
      
      // Verify cleanup was attempted after error
      expect(mockStorageFrom().remove).toHaveBeenCalled();
    });
  });
}); 