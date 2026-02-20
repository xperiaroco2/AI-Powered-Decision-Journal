import { NextRequest, NextResponse } from 'next/server';

/**
 * API Proxy Utility
 *
 * Forwards requests from Next.js API routes to NestJS backend.
 * Forwards the access token from the Authorization header.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Proxy a request to the NestJS API
 *
 * @param path API path (e.g., '/decisions', '/advice')
 * @param request Next.js request object
 * @param options Additional fetch options
 * @returns Response from NestJS API
 */
export async function proxyToNestAPI(
  path: string,
  request: NextRequest,
  options: RequestInit = {},
): Promise<Response> {
  try {
    // 1. Get access token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Build headers
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', authHeader); // Forward the token
    headers.set('Content-Type', 'application/json');

    // 3. Forward request to NestJS
    const url = `${API_URL}${path}`;
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Forward cookies (for refresh token)
    });

    return response;
  } catch (error) {
    console.error('[API Proxy] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to proxy request',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

/**
 * Proxy a GET request to NestJS
 */
export async function proxyGET(
  path: string,
  request: NextRequest,
): Promise<NextResponse> {
  const response = await proxyToNestAPI(path, request, {
    method: 'GET',
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

/**
 * Proxy a POST request to NestJS
 */
export async function proxyPOST(
  path: string,
  request: NextRequest,
  body?: unknown,
): Promise<NextResponse> {
  const requestBody = body || (await request.json());

  const response = await proxyToNestAPI(path, request, {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

/**
 * Proxy a multipart/form-data POST request to NestJS
 * Used for file uploads
 */
export async function proxyMultipartPOST(
  path: string,
  request: NextRequest,
): Promise<NextResponse> {
  try {
    // 1. Get access token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get form data from request
    const formData = await request.formData();

    // 3. Build headers (don't set Content-Type for multipart, let fetch handle it)
    const headers = new Headers();
    headers.set('Authorization', authHeader); // Forward the token

    // 4. Forward request to NestJS
    const url = `${API_URL}${path}`;
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include', // Forward cookies
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[API Proxy] Multipart error:', error);
    return NextResponse.json(
      {
        error: 'Failed to proxy multipart request',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
