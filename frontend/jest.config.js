module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  moduleNameMapper: {
    '\\.(css|less|scss)$': 'identity-obj-proxy',
    '^.+\\.svg$': 'jest-svg-transformer',
    // Mock out supabaseClient directly
    '^../supabaseClient$': '<rootDir>/src/__mocks__/supabaseClient.js'
  },
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  // Add transformIgnorePatterns to process ESM modules
  transformIgnorePatterns: [
    '/node_modules/(?!(@supabase|superjson|reflect-metadata))'
  ]
}; 