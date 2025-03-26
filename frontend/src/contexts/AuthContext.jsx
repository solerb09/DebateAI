import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState({ 
    user: null, 
    isAuthenticated: false,
    isLoading: true // Add loading state to track initialization
  });

  useEffect(() => { 
    const checkUser = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) {
          console.error("Error fetching user:", error.message);
          setAuthState({ 
            user: null, 
            isAuthenticated: false, 
            isLoading: false 
          });
          return;
        }
        setAuthState({ 
          user: data.user, 
          isAuthenticated: !!data.user,
          isLoading: false 
        });
      } catch (err) {
        console.error("Unexpected error checking authentication:", err);
        setAuthState({ 
          user: null, 
          isAuthenticated: false, 
          isLoading: false 
        });
      }
    };

    // Check user immediately on load
    checkUser();

    // Also listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthState({ 
        user: session?.user || null, 
        isAuthenticated: !!session?.user,
        isLoading: false 
      });
    });

    // Cleanup function
    return () => {
      if (authListener?.subscription?.unsubscribe) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  const login = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        console.error("Login failed:", error.message);
        return { success: false, message: error.message };
      }
      setAuthState({ 
        user: data.user, 
        isAuthenticated: true,
        isLoading: false
      });
      return { success: true };
    } catch (err) {
      console.error("Unexpected login error:", err);
      return { success: false, message: "An unexpected error occurred" };
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setAuthState({ 
        user: null, 
        isAuthenticated: false,
        isLoading: false
      });
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  return (
    <AuthContext.Provider value={{ authState, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
