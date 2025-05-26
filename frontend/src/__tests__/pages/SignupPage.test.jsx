import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import SignupPage from '../../pages/SignupPage';

// Mock supabase client directly
// Mock supabase client directly - Exporting the mock directly
const mockSupabase = {
  auth: {
    signUp: jest.fn(),
    // Add other auth methods if needed by the component/tests
  },
  // Mock the 'from' chain structure more robustly
  from: jest.fn(() => mockSupabase.fromChain), // Use a separate chain object
  fromChain: { // Define the chain structure separately
    insert: jest.fn(() => mockSupabase.fromChain), // Return chain for chaining
    select: jest.fn(() => mockSupabase.fromChain), // Return chain for chaining
    single: jest.fn(), // The final method in the chain
    // Add other methods like eq, update etc. if needed
  }
};
jest.mock('../../supabaseClient', () => ({
  supabase: mockSupabase
}));


// Import the mocked supabase after mocking
import { supabase } from '../../supabaseClient'; // Imports the correctly structured mock

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => {
  const originalModule = jest.requireActual('react-router-dom');
  return {
    ...originalModule,
    useNavigate: () => mockNavigate
  };
});

describe('SignupPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mocks before each test
    supabase.auth.signUp.mockReset();
    supabase.from.mockClear(); // Clear calls for 'from'
    // Ensure chained mocks are reset if necessary, accessing them directly
    supabase.from().insert().select().single.mockReset();

    // Set up default mock implementations
    supabase.auth.signUp.mockResolvedValue({ // Use mockResolvedValue for consistency
      data: { user: null, session: null }, // Provide a default structure
      error: null
    });

    // Default mock for the insert chain used after signup
    supabase.from().insert().select().single.mockResolvedValue({
       data: { id: 'new-profile-id' }, // Example successful insert data
       error: null
    });
  });

  test('renders signup form correctly', () => {
    render(
      <BrowserRouter>
        <SignupPage />
      </BrowserRouter>
    );
    
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
  });
  
  test('validates form inputs', async () => {
    render(
      <BrowserRouter>
        <SignupPage />
      </BrowserRouter>
    );
    
    // Submit with empty fields
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/username is required/i)).toBeInTheDocument();
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
    
    // Try with short username and password
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'ab' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: '12345' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: '123456' } });
    
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/username must be at least 3 characters/i)).toBeInTheDocument();
      expect(screen.getByText(/password must be at least 6 characters/i)).toBeInTheDocument();
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
  });
  
  test('handles successful signup', async () => {
    const mockAuthData = {
      user: { id: 'user-123', email: 'test@example.com' },
      session: { /* mock session data if needed */ }
    };
    const mockInsertData = { id: 'user-123', username: 'testuser', email: 'test@example.com' };

    // Override default mocks for this test *before* interaction
    supabase.auth.signUp.mockResolvedValueOnce({ data: mockAuthData, error: null });
    supabase.fromChain.single.mockResolvedValueOnce({ data: mockInsertData, error: null }); // Mock successful insert
    render(
      <BrowserRouter>
        <SignupPage />
      </BrowserRouter>
    );
    
    // Fill the form
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } });
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));
    
    await waitFor(() => {
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        options: {
          data: {
            username: 'testuser'
          }
        }
      });
    });
    
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login', expect.any(Object));
    });
  });
  
  test('handles signup error', async () => {
    const mockError = { message: 'Email already registered' };

    // Override default signUp mock for this test *before* interaction
    supabase.auth.signUp.mockResolvedValueOnce({
      data: { user: null, session: null }, // Supabase often returns this structure even on error
      error: mockError
    });

    // No need to mock insert here as signUp error should prevent it
    render(
      <BrowserRouter>
        <SignupPage />
      </BrowserRouter>
    );
    
    // Fill the form
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'existing@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } });
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));
    
    await waitFor(() => {
      expect(supabase.auth.signUp).toHaveBeenCalled();
    });
    
    await waitFor(() => {
      expect(screen.getByText(/email already registered/i)).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
}); 