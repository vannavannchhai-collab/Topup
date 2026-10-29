import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, tokenStore } from './api';
import type { User } from './types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (payload: { name: string; email: string; password: string; locale: 'km' | 'en' }) => Promise<User>;
  signOut: () => void;
  refresh: () => Promise<void>;
  updateWallet: (wallet: { balanceCents: number; points: number }) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { user: me } = await api.get<{ user: User }>('/auth/me');
      setUser(me);
    } catch {
      tokenStore.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await api.post<{ token: string; user: User }>('/auth/login', { email, password });
    tokenStore.set(result.token);
    setUser(result.user);
    return result.user;
  }, []);

  const signUp = useCallback(
    async (payload: { name: string; email: string; password: string; locale: 'km' | 'en' }) => {
      const result = await api.post<{ token: string; user: User }>('/auth/register', {
        ...payload,
        demoFunds: true,
      });
      tokenStore.set(result.token);
      setUser(result.user);
      return result.user;
    },
    [],
  );

  const signOut = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  const updateWallet = useCallback((wallet: { balanceCents: number; points: number }) => {
    setUser((current) =>
      current ? { ...current, wallet: { ...current.wallet, ...wallet } } : current,
    );
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, signUp, signOut, refresh, updateWallet }),
    [user, loading, signIn, signUp, signOut, refresh, updateWallet],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
