// Add custom jest matchers from @testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock Vite environment variables
global.import = {
  meta: {
    env: {
      VITE_SUPABASE_URL: 'https://mock-supabase-url.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'mock-anon-key',
      VITE_API_URL: 'http://localhost:3000'
    }
  }
};

// Mock URL.createObjectURL
if (typeof window !== 'undefined') {
  window.URL.createObjectURL = jest.fn(() => 'mock-url');
  window.URL.revokeObjectURL = jest.fn();
}

// Suppress React Router warnings in tests
jest.mock('react-router-dom', () => {
  const originalModule = jest.requireActual('react-router-dom');
  return {
    ...originalModule,
    // Mock useNavigate
    useNavigate: () => jest.fn(),
    // Suppress warnings
    UNSAFE_logV6DeprecationWarnings: () => {},
  };
}); 