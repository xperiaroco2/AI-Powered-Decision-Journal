import {
  apiRequest,
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  apiPostMultipart,
} from '../api-client';

// Mock global fetch
global.fetch = jest.fn();

const API_URL = 'http://localhost:4000';

describe('api-client', () => {
  const mockAccessToken = 'test_access_token';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('apiRequest', () => {
    it('should make request with auth token', async () => {
      const mockResponse = { ok: true, json: async () => ({ data: 'test' }) };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await apiRequest('/test', {}, mockAccessToken);

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_URL}/test`,
        expect.objectContaining({
          credentials: 'include',
        }),
      );

      const callArgs = (global.fetch as jest.Mock).mock.calls[0][1];
      const headers = callArgs.headers;
      expect(headers.get('Authorization')).toBe(`Bearer ${mockAccessToken}`);
      expect(result).toBe(mockResponse);
    });

    it('should make request without auth token if not provided', async () => {
      const mockResponse = { ok: true, json: async () => ({ data: 'test' }) };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await apiRequest('/test', {}, null);

      const callArgs = (global.fetch as jest.Mock).mock.calls[0][1];
      const headers = callArgs.headers;
      expect(headers.get('Authorization')).toBeNull();
    });

    it('should add Content-Type for JSON body', async () => {
      const mockResponse = { ok: true };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await apiRequest(
        '/test',
        { body: JSON.stringify({ test: 'data' }) },
        mockAccessToken,
      );

      const callArgs = (global.fetch as jest.Mock).mock.calls[0][1];
      const headers = callArgs.headers;
      expect(headers.get('Content-Type')).toBe('application/json');
    });

    it('should handle absolute URLs', async () => {
      const mockResponse = { ok: true };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await apiRequest('https://example.com/api/test', {}, mockAccessToken);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/api/test',
        expect.any(Object),
      );
    });
  });

  describe('apiGet', () => {
    it('should make GET request', async () => {
      const mockResponse = { ok: true };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await apiGet('/test', mockAccessToken);

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_URL}/test`,
        expect.objectContaining({
          method: 'GET',
        }),
      );
    });
  });

  describe('apiPost', () => {
    it('should make POST request with JSON body', async () => {
      const mockResponse = { ok: true };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const body = { test: 'data' };
      await apiPost('/test', body, mockAccessToken);

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_URL}/test`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(body),
        }),
      );
    });
  });

  describe('apiPut', () => {
    it('should make PUT request with JSON body', async () => {
      const mockResponse = { ok: true };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const body = { test: 'data' };
      await apiPut('/test', body, mockAccessToken);

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_URL}/test`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(body),
        }),
      );
    });
  });

  describe('apiDelete', () => {
    it('should make DELETE request', async () => {
      const mockResponse = { ok: true };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await apiDelete('/test', mockAccessToken);

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_URL}/test`,
        expect.objectContaining({
          method: 'DELETE',
        }),
      );
    });
  });

  describe('apiPostMultipart', () => {
    it('should make POST request with FormData', async () => {
      const mockResponse = { ok: true };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const formData = new FormData();
      formData.append('file', new Blob(['test']), 'test.txt');

      await apiPostMultipart('/upload', formData, mockAccessToken);

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_URL}/upload`,
        expect.objectContaining({
          method: 'POST',
          body: formData,
          credentials: 'include',
        }),
      );

      const callArgs = (global.fetch as jest.Mock).mock.calls[0][1];
      const headers = callArgs.headers;
      expect(headers.get('Authorization')).toBe(`Bearer ${mockAccessToken}`);
      // Content-Type should NOT be set for multipart
      expect(headers.get('Content-Type')).toBeNull();
    });
  });
});

