import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState({ user: null, isAuthenticated: false });

  useEffect(() => { 
    const checkUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error("Error fetching user:", error.message);
        return;
      }
      setAuthState({ user: data.user, isAuthenticated: !!data.user });
    };

    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthState({ user: session?.user || null, isAuthenticated: !!session?.user });
    });

    // Cleanup function
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error("Login failed:", error.message);
      return { success: false, message: error.message };
    }
    setAuthState({ user: data.user, isAuthenticated: true });
    return { success: true };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setAuthState({ user: null, isAuthenticated: false });
  };

  return (
    <AuthContext.Provider value={{ authState, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
