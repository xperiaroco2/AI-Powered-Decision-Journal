/**
 * API Client
 *
 * Wrapper around fetch that automatically adds the access token
 * from the auth context to all requests.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Make an authenticated API request
 */
export async function apiRequest(
  path: string,
  options: RequestInit = {},
  accessToken: string | null,
): Promise<Response> {
  const headers = new Headers(options.headers || {});
  
  // Add access token if available
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  // Add Content-Type if not already set and body is present
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const url = path.startsWith('http') ? path : `${API_URL}${path}`;

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Include cookies for refresh token
  });
}

/**
 * Make an authenticated GET request
 */
export async function apiGet(path: string, accessToken: string | null): Promise<Response> {
  return apiRequest(path, { method: 'GET' }, accessToken);
}

/**
 * Make an authenticated POST request
 */
export async function apiPost(
  path: string,
  body: unknown,
  accessToken: string | null,
): Promise<Response> {
  return apiRequest(
    path,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    accessToken,
  );
}

/**
 * Make an authenticated PUT request
 */
export async function apiPut(
  path: string,
  body: unknown,
  accessToken: string | null,
): Promise<Response> {
  return apiRequest(
    path,
    {
      method: 'PUT',
      body: JSON.stringify(body),
    },
    accessToken,
  );
}

/**
 * Make an authenticated DELETE request
 */
export async function apiDelete(path: string, accessToken: string | null): Promise<Response> {
  return apiRequest(path, { method: 'DELETE' }, accessToken);
}

/**
 * Make an authenticated multipart/form-data POST request
 */
export async function apiPostMultipart(
  path: string,
  formData: FormData,
  accessToken: string | null,
): Promise<Response> {
  const headers = new Headers();
  
  // Add access token if available
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  // Don't set Content-Type for multipart, let fetch handle it

  const url = path.startsWith('http') ? path : `${API_URL}${path}`;

  return fetch(url, {
    method: 'POST',
    headers,
    body: formData,
    credentials: 'include',
  });
}

