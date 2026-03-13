'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as authClient from './auth-client';

interface User {
  id: string;
  email: string;
  name: string | null;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Refresh access token
   */
  const refreshToken = useCallback(async () => {
    try {
      const response = await authClient.refreshAccessToken();
      setAccessToken(response.accessToken);
      
      // Decode token to get user info (simple JWT decode)
      const payload = JSON.parse(atob(response.accessToken.split('.')[1]));
      setUser({
        id: payload.id,
        email: payload.email,
        name: payload.name,
      });
      
      return true;
    } catch (_error) {
      setAccessToken(null);
      setUser(null);
      return false;
    }
  }, []);

  /**
   * Login
   */
  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await authClient.login(email, password);
      setAccessToken(response.accessToken);
      setUser(response.user);
    } catch (error) {
      throw error;
    }
  }, []);

  /**
   * Logout
   */
  const logout = useCallback(async () => {
    try {
      await authClient.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  /**
   * Register
   */
  const register = useCallback(async (email: string, password: string, name?: string) => {
    try {
      await authClient.register(email, password, name);
      // Auto-login after registration
      await login(email, password);
    } catch (error) {
      throw error;
    }
  }, [login]);

  /**
   * Initialize auth state on mount
   */
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      await refreshToken();
      setIsLoading(false);
    };

    initAuth();
  }, [refreshToken]);

  /**
   * Set up token refresh interval (refresh every 14 minutes, token expires in 15)
   */
  useEffect(() => {
    if (!accessToken) return;

    const interval = setInterval(() => {
      refreshToken();
    }, 14 * 60 * 1000); // 14 minutes

    return () => clearInterval(interval);
  }, [accessToken, refreshToken]);

  const value = {
    user,
    accessToken,
    isLoading,
    login,
    logout,
    register,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

