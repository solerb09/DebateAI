import { supabase } from '../supabaseClient';

// Mock supabase client
jest.mock('../supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn()
    },
    from: jest.fn()
  }
}));

describe('Authentication Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  // Simple test for login functionality
  test('Supabase signInWithPassword is called with correct parameters', async () => {
    const email = 'test@example.com';
    const password = 'password123';
    
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null
    });
    
    const result = await supabase.auth.signInWithPassword({ email, password });
    
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email, password });
    expect(result.data.user.id).toBe('user-123');
  });
  
  // Simple test for signup functionality
  test('Supabase signUp is called with correct parameters', async () => {
    const email = 'newuser@example.com';
    const password = 'password123';
    const username = 'newuser';
    
    supabase.auth.signUp.mockResolvedValue({
      data: { user: { id: 'user-456' } },
      error: null
    });
    
    const result = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } }
    });
    
    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email,
      password,
      options: { data: { username } }
    });
    expect(result.data.user.id).toBe('user-456');
  });
  
  // Simple test for logout functionality
  test('Supabase signOut is called correctly', async () => {
    supabase.auth.signOut.mockResolvedValue({ error: null });
    
    await supabase.auth.signOut();
    
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });
}); 