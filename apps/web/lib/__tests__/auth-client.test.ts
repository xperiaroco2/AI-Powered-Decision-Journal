import { login, register, logout, refreshAccessToken } from '../auth-client';

// Mock global fetch
global.fetch = jest.fn();

const API_URL = 'http://localhost:4000';

describe('auth-client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const mockResponse = {
        accessToken: 'access_token_123',
        user: {
          id: 'user-id-123',
          email: 'test@example.com',
          name: 'Test User',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await login('test@example.com', 'password123');

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(`/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123',
        }),
      });
    });

    it('should throw error on failed login', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Invalid credentials' }),
      });

      await expect(login('test@example.com', 'wrong')).rejects.toThrow(
        'Invalid credentials',
      );
    });
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      const mockResponse = {
        message: 'User created successfully',
        user: {
          id: 'user-id-123',
          email: 'test@example.com',
          name: 'Test User',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await register('test@example.com', 'password123', 'Test User');

      expect(global.fetch).toHaveBeenCalledWith(`/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        }),
      });
      expect(result).toEqual(mockResponse);
    });

    it('should throw error on failed registration', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Email already exists' }),
      });

      await expect(
        register('test@example.com', 'password123'),
      ).rejects.toThrow('Email already exists');
    });
  });

  describe('logout', () => {
    it('should successfully logout', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
      });

      await logout();

      expect(global.fetch).toHaveBeenCalledWith(`/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    });

    it('should throw error on failed logout', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
      });

      await expect(logout()).rejects.toThrow('Logout failed');
    });
  });

  describe('refreshAccessToken', () => {
    it('should successfully refresh access token', async () => {
      const mockResponse = {
        accessToken: 'new_access_token_123',
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await refreshAccessToken();

      expect(global.fetch).toHaveBeenCalledWith(`/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      expect(result).toEqual(mockResponse);
    });

    it('should throw error on failed refresh', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
      });

      await expect(refreshAccessToken()).rejects.toThrow(
        'Token refresh failed',
      );
    });
  });
});

