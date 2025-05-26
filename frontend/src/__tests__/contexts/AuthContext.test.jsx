import { render, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';

// Mock supabase client
jest.mock('../../supabaseClient');

// Create a test component that uses the auth context
const TestComponent = () => {
  const auth = useAuth();
  return (
    <div>
      <div data-testid="user">{auth.user ? JSON.stringify(auth.user) : 'No user'}</div>
      <div data-testid="isAuthenticated">{auth.isAuthenticated.toString()}</div>
      <button onClick={() => auth.login('test@example.com', 'password')}>Login</button>
      <button onClick={() => auth.logout()}>Logout</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    // Reset mock implementations
    // Clear all mocks
    jest.clearAllMocks();

    // --- Default Mocks ---
    // Default: No user initially
    supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    // Default: Auth state listener setup
    supabase.auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
    // Default: Sign in resolves (can be overridden)
    supabase.auth.signInWithPassword.mockResolvedValue({ data: { user: null }, error: { message: 'Default mock error' } });
    // Default: Sign out resolves
    supabase.auth.signOut.mockResolvedValue({ error: null });

    // Default: Profile fetch chain (user not found)
    const singleMock = jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'User not found' } }); // Default to user not found
    const eqMock = jest.fn(() => ({ single: singleMock }));
    const selectMock = jest.fn(() => ({ eq: eqMock }));
    supabase.from.mockReturnValue({ select: selectMock });
    // --- End Default Mocks ---

    // Store mocks for easier access in tests
    jest._supabaseMocks = { singleMock }; // Only need singleMock now
  });

  afterEach(() => {
    delete jest._supabaseMocks; // Clean up mocks
  });

  test('initializes with no user when not authenticated', async () => {
    // Default mocks in beforeEach handle this case (getUser returns null)
    let wrapper;
    await act(async () => {
      wrapper = render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
    });
    
    await waitFor(() => {
      expect(wrapper.getByTestId('user')).toHaveTextContent('No user');
      expect(wrapper.getByTestId('isAuthenticated')).toHaveTextContent('false');
    });
  });
  
  test('initializes with user when authenticated', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    const mockProfile = { id: 'user-123', username: 'testuser' };
    const { singleMock } = jest._supabaseMocks;

    // Override default mocks for this specific test *before* rendering
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: mockUser }, error: null });
    singleMock.mockResolvedValueOnce({ data: mockProfile, error: null }); // Mock successful profile fetch

    let wrapper;
    await act(async () => {
      wrapper = render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
    });
    
    await waitFor(() => {
      expect(wrapper.getByTestId('isAuthenticated')).toHaveTextContent('true');
    });
  });
  
  test('login function works correctly', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    const mockProfile = { id: 'user-123', username: 'testuser' };
    const { singleMock } = jest._supabaseMocks;

    // Initial state: No user (handled by default getUser mock)

    // Mock successful login response
    supabase.auth.signInWithPassword.mockResolvedValueOnce({ data: { user: mockUser }, error: null });
    // Mock successful profile fetch *after* login
    singleMock.mockResolvedValueOnce({ data: mockProfile, error: null });

    let wrapper;
    await act(async () => {
      wrapper = render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
    });
    
    // Perform login
    await act(async () => {
      wrapper.getByText('Login').click();
    });
    
    // Verify login was called
    // Verify login was called (ensure this happens *after* click and potential state updates)
     await waitFor(() => {
       expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
         email: 'test@example.com',
         password: 'password'
       });
     });

    // Verify state update after login + profile sync
    await waitFor(() => {
      expect(wrapper.getByTestId('isAuthenticated')).toHaveTextContent('true');
      // Optionally check for user/profile data if needed
    });
  });

  test('logout function works correctly', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    const mockProfile = { id: 'user-123', username: 'testuser' };
    const { singleMock } = jest._supabaseMocks;

    // Set up initial authenticated state *before* render
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: mockUser }, error: null });
    singleMock.mockResolvedValueOnce({ data: mockProfile, error: null }); // Mock profile fetch for initial load

    // Mock successful logout (default signOut mock is likely sufficient)
    // supabase.auth.signOut.mockResolvedValueOnce({ error: null });

    let wrapper;
    await act(async () => {
      wrapper = render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
    });
    
    // Wait for initial authenticated state
    await waitFor(() => {
      expect(wrapper.getByTestId('isAuthenticated')).toHaveTextContent('true');
    });
    
    // Perform logout
    await act(async () => {
      wrapper.getByText('Logout').click();
    });
    
    // Verify logout was called
    // Verify logout was called
    expect(supabase.auth.signOut).toHaveBeenCalled();

    // Verify state update after logout
    await waitFor(() => {
      expect(wrapper.getByTestId('isAuthenticated')).toHaveTextContent('false');
      expect(wrapper.getByTestId('user')).toHaveTextContent('No user');
    });
  });
});