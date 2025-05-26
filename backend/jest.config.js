/**
 * Jest configuration for backend tests
 */
module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test pattern matching
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],
  
  // Coverage collection
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js' // Exclude the main server file
  ],
  coverageDirectory: 'coverage',
  
  // Timeouts
  testTimeout: 10000, // 10 seconds
  
  // Setup files
  setupFilesAfterEnv: ['./tests/setup.js'],
  
  // Mock file resolution
  moduleNameMapper: {
    // Mock file paths if needed
  },
  
  // Displayed information during test execution
  verbose: true
}; 