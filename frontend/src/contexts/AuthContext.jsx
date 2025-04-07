import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState({ 
    user: null,
    profile: null,
    isAuthenticated: false,
    loading: true 
  });
  
  // Use refs to track component mount state
  const isMounted = useRef(true);
  
  // Safe state setter that checks if component is still mounted
  const safeSetAuthState = (newState) => {
    if (isMounted.current) {
      setAuthState(newState);
    }
  };

  // Function to fetch user profile from users table
  const fetchUserProfile = async (userId) => {
    if (!userId) return null;
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        if (error.code !== 'PGRST116') {
          console.error("Error fetching user profile:", error);
        }
        return null;
      }
      
      return data;
    } catch (error) {
      console.error("Exception in fetchUserProfile:", error);
      return null;
    }
  };

  // Function to create a user profile in the users table
  const createUserProfile = async (authUser) => {
    if (!authUser || !authUser.id) return null;
    
    try {
      const username = authUser.user_metadata?.username || 
                      authUser.email?.split('@')[0] || 
                      `user_${Math.floor(Math.random() * 10000)}`;
                      
      const newProfile = {
        id: authUser.id,
        email: authUser.email,
        username: username,
        created_at: new Date().toISOString()
      };
      
      const { data, error } = await supabase
        .from('users')
        .insert([newProfile])
        .select()
        .single();
        
      if (error) {
        console.error("Error creating user profile:", error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error("Exception in createUserProfile:", error);
      return null;
    }
  };

  // Function to sync auth user with profile - wrapped with mount check
  const syncUserWithProfile = async (authUser) => {
    if (!authUser || !isMounted.current) {
      return;
    }
    
    try {
      // First check if user has a profile
      let profile = await fetchUserProfile(authUser.id);
      
      // If no profile exists, create one
      if (!profile) {
        profile = await createUserProfile(authUser);
      }
      
      // Only update state if still mounted
      if (isMounted.current) {
        safeSetAuthState({
          user: authUser,
          profile: profile,
          isAuthenticated: true,
          loading: false
        });
      }
    } catch (error) {
      console.error("Error syncing user with profile:", error);
      if (isMounted.current) {
        safeSetAuthState({
          user: authUser,
          profile: null,
          isAuthenticated: true,
          loading: false
        });
      }
    }
  };

  useEffect(() => { 
    // Set up the mounted ref
    isMounted.current = true;
    
    let authSubscription = null;

    const initialize = async () => {
      try {
        // Get session from Supabase auth
        const { data, error } = await supabase.auth.getUser();
        if (error) {
          console.error("Error fetching user:", error.message);
          safeSetAuthState({ user: null, profile: null, isAuthenticated: false, loading: false });
          return;
        }

        if (data.user) {
          syncUserWithProfile(data.user);
        } else {
          safeSetAuthState({ user: null, profile: null, isAuthenticated: false, loading: false });
        }
      } catch (error) {
        console.error("Error in initialize:", error);
        safeSetAuthState({ user: null, profile: null, isAuthenticated: false, loading: false });
      }
    };

    initialize();

    // Set up auth listener
    const setupAuthListener = async () => {
      const { data } = await supabase.auth.onAuthStateChange((event, session) => {
        if (isMounted.current) {
          if (session?.user) {
            syncUserWithProfile(session.user);
          } else {
            safeSetAuthState({ user: null, profile: null, isAuthenticated: false, loading: false });
          }
        }
      });
      
      authSubscription = data.subscription;
    };
    
    setupAuthListener();

    // Cleanup function
    return () => {
      isMounted.current = false;
      if (authSubscription) {
        authSubscription.unsubscribe();

      }
    };
  }, []);

  const login = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        return { success: false, message: error.message };
      }
      
      if (isMounted.current) {
        // Don't await here to avoid blocking the login response
        syncUserWithProfile(data.user);
      }
      
      return { success: true };
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, message: error.message };
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();

      if (isMounted.current) {
        safeSetAuthState({ user: null, profile: null, isAuthenticated: false, loading: false });
      }
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const updateProfile = async (updates) => {
    if (!authState.user?.id) return { success: false, message: "Not authenticated" };
    
    try {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', authState.user.id)
        .select()
        .single();
        
      if (error) {
        console.error("Error updating profile:", error);
        return { success: false, message: error.message };
      }
      
      // Update the profile in state
      if (isMounted.current) {
        safeSetAuthState(prev => ({
          ...prev,
          profile: data
        }));
      }
      
      return { success: true, data };
    } catch (error) {
      console.error("Update profile error:", error);
      return { success: false, message: error.message };
    }
  };

  const updateUserMetadata = async (metadata) => {
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: metadata
      });
      
      if (error) {
        console.error("Error updating user metadata:", error);
        return { success: false, message: error.message };
      }
      
      // Update the user in state
      if (data.user && isMounted.current) {
        safeSetAuthState(prev => ({
          ...prev,
          user: data.user
        }));
        
        // Also update profile if needed (e.g., for username)
        if (metadata.username && authState.profile) {
          await updateProfile({ username: metadata.username });
        }
      }
      
      return { success: true };
    } catch (error) {
      console.error("Update metadata error:", error);
      return { success: false, message: error.message };
    }
  };

  const refreshProfile = async () => {
    if (!authState.user?.id || !isMounted.current) return;
    
    try {
      const profile = await fetchUserProfile(authState.user.id);
      if (isMounted.current && profile) {
        safeSetAuthState(prev => ({ ...prev, profile }));
      }
    } catch (error) {
      console.error("Error refreshing profile:", error);

    }
  };

  return (
    <AuthContext.Provider value={{ 
      ...authState, 
      login, 
      logout,
      updateProfile,
      updateUserMetadata,
      refreshProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
