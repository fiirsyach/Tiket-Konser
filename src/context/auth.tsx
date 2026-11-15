import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { apiRequest, clearToken, saveToken, type User } from '@/lib/api';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (details: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }) => Promise<boolean>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
};

type AuthResponse = { success: boolean; token?: string; user: User };
type MeResponse = { success: boolean; user: User };

function assertMobileCustomer(user: User) {
  if (user.role !== 'customer') {
    throw new Error('Aplikasi mobile hanya dapat digunakan oleh akun customer. Silakan gunakan web untuk akun organizer atau super admin.');
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    apiRequest<MeResponse>('/auth/me')
      .then((response) => {
        assertMobileCustomer(response.user);
        if (mounted) setUser(response.user);
      })
      .catch(() => clearToken())
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const acceptSession = useCallback(async (response: AuthResponse) => {
    if (!response.token) throw new Error('Login berhasil tetapi token sesi tidak tersedia.');
    assertMobileCustomer(response.user);
    await saveToken(response.token);
    setUser(response.user);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      authenticated: false,
      body: { email, password },
    });
    await acceptSession(response);
  }, [acceptSession]);

  const register = useCallback(async (details: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }) => {
    const response = await apiRequest<AuthResponse>('/auth/register/customer', {
        method: 'POST',
        authenticated: false,
        body: {
          name: details.name,
          email: details.email,
          password: details.password,
          phone: details.phone,
        },
    });
    if (!response.token) return false;
    await acceptSession(response);
    return true;
  }, [acceptSession]);

  const logout = useCallback(async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } finally {
      await clearToken();
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    login,
    register,
    logout,
    updateUser: setUser,
  }), [user, loading, login, register, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
