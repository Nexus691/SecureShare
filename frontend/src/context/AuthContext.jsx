import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { registerSocketUser } from '../socket';

const AuthContext = createContext(null);
const demoAccountsEnabled = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_ACCOUNTS === 'true';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api.me()
      .then((data) => {
        if (mounted) {
          setUser(data.user);
          registerSocketUser(data.user?.id);
        }
      })
      .catch(() => {
        if (mounted) setUser(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    demoAccountsEnabled,
    signIn: async (email, password) => {
      const data = await api.login(email, password);
      setUser(data.user);
      registerSocketUser(data.user?.id);
      return { error: null };
    },
    signUp: async (email, password, displayName) => {
      const data = await api.register(email, password, displayName);
      setUser(data.user);
      registerSocketUser(data.user?.id);
      return { error: null };
    },
    signOut: async () => {
      await api.logout();
      setUser(null);
    },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
