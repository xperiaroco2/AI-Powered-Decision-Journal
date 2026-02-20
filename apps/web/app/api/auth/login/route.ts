/**
 * User Login API Route (Proxy to NestJS)
 *
 * Note: This is a public endpoint (no authentication required)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Forward to NestJS API (no auth required for login)
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Forward cookies
      body: JSON.stringify(body),
    });

    const data = await response.json();

    // Forward the Set-Cookie header from NestJS to the client
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
    console.error('[Login Proxy] Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to login',
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

