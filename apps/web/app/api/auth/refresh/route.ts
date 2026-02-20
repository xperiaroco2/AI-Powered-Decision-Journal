/**
 * Token Refresh API Route (Proxy to NestJS)
 *
 * Note: This is a public endpoint (no authentication required)
 */
export async function POST(request: Request) {
  try {
    // Forward to NestJS API
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Forward cookies (refresh token)
    });

    const data = await response.json();

    // Forward the Set-Cookie header from NestJS to the client (new refresh token)
    const setCookieHeader = response.headers.get('set-cookie');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (setCookieHeader) {
      headers['Set-Cookie'] = setCookieHeader;
    }

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers,
    });
  } catch (error) {
    console.error('[Refresh Proxy] Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to refresh token',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }
}

