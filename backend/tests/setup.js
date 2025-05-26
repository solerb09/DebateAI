/**
 * Global setup for all Jest tests
 */

// Set environment variables for testing
process.env.NODE_ENV = 'test';

// Mock environment variables that might be needed
if (!process.env.SUPABASE_URL) process.env.SUPABASE_URL = 'https://example.com';
if (!process.env.SUPABASE_SERVICE_KEY) process.env.SUPABASE_SERVICE_KEY = 'mock-service-key';
if (!process.env.OPENAI_API_KEY) process.env.OPENAI_API_KEY = 'mock-openai-key';

// Mock global fetch if not already available
if (!global.fetch) {
  global.fetch = jest.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
      arrayBuffer: () => Promise.resolve(Buffer.from('mock audio data'))
    })
  );
}

// Silence console methods during tests (comment out if you want to see logs)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn()
// };

// Add custom matchers if needed
// expect.extend({
//   // Your custom matchers here
// });

// Global setup before all tests
beforeAll(() => {
  // Any global setup needed
});

// Global teardown after all tests
afterAll(() => {
  // Any global cleanup needed
}); 