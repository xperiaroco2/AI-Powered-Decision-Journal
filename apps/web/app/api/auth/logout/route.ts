/**
 * User Logout API Route (Proxy to NestJS)
 *
 * Note: This is a public endpoint (no authentication required)
 */
export async function POST(request: Request) {
  try {
    // Forward to NestJS API
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const response = await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Forward cookies
    });

    // Forward the Set-Cookie header from NestJS to the client (to clear the cookie)
    const setCookieHeader = response.headers.get('set-cookie');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (setCookieHeader) {
      headers['Set-Cookie'] = setCookieHeader;
    }

    return new Response(null, {
      status: response.status,
      headers,
    });
  } catch (error) {
    console.error('[Logout Proxy] Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to logout',
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

