/**
 * Auth Client
 *
 * Client-side functions for authentication.
 * Uses Next.js API routes as a proxy to avoid CORS issues.
 */

// Use Next.js API routes (proxy layer) instead of direct NestJS API calls
const API_URL = '/api';

export interface User {
  id: string;
  email: string;
  name: string | null;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
}

export interface RegisterResponse {
  message: string;
  user: User;
}

export interface RefreshResponse {
  accessToken: string;
}

/**
 * Login user
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Important: send cookies
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Login failed');
  }

  return response.json();
}

/**
 * Register new user
 */
export async function register(
  email: string,
  password: string,
  name?: string,
): Promise<RegisterResponse> {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password, name }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Registration failed');
  }

  return response.json();
}

/**
 * Logout user
 */
export async function logout(): Promise<void> {
  const response = await fetch(`${API_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include', // Important: send cookies
  });

  if (!response.ok) {
    throw new Error('Logout failed');
  }
}

/**
 * Refresh access token using refresh token from cookie
 */
export async function refreshAccessToken(): Promise<RefreshResponse> {
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include', // Important: send cookies
  });

  if (!response.ok) {
    throw new Error('Token refresh failed');
  }

  return response.json();
}

