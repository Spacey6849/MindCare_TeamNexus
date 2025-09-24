
import { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

// This is a simplified representation. In a real app, user would have more properties.
interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'student' | 'counselor' | 'admin';
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Initialize from localStorage to persist across reloads
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const v = localStorage.getItem('auth:isAuthenticated');
    return v === 'true';
  });
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem('auth:user');
    try { return raw ? (JSON.parse(raw) as User) : null; } catch { return null; }
  });

  // Keep Supabase session in sync -> set AuthContext
  useEffect(() => {
    const syncFromSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const sUser = session?.user;
      if (sUser) {
        // Merge minimal info; app-specific profile would enrich later
        const u: User = {
          id: sUser.id,
          email: sUser.email || '',
          fullName: sUser.user_metadata?.full_name || sUser.user_metadata?.name || sUser.email || 'Student',
          role: 'student',
        };
        setIsAuthenticated(true);
        setUser(u);
      }
    };
    syncFromSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const sUser = session?.user;
      if (sUser) {
        const u: User = {
          id: sUser.id,
          email: sUser.email || '',
          fullName: sUser.user_metadata?.full_name || sUser.user_metadata?.name || sUser.email || 'Student',
          role: 'student',
        };
        setIsAuthenticated(true);
        setUser(u);
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const login = (user: User) => {
    setIsAuthenticated(true);
    setUser(user);
    try {
      localStorage.setItem('auth:isAuthenticated', 'true');
      localStorage.setItem('auth:user', JSON.stringify(user));
    } catch (e) {
      // non-fatal: storage may be unavailable
      console.warn('AuthContext: failed saving auth to localStorage', e);
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
    try {
      localStorage.removeItem('auth:isAuthenticated');
      localStorage.removeItem('auth:user');
    } catch (e) {
      console.warn('AuthContext: failed clearing localStorage', e);
    }
    // Also sign out of Supabase so session tokens are cleared
    supabase.auth.signOut().catch(() => {});
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
