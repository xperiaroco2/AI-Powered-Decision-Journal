/**
 * User Login API Route (Proxy to NestJS)
 *
 * Note: This is a public endpoint (no authentication required)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Forward to NestJS API (no auth required for login)
    const API_URL = process.env.API_URL || 'http://localhost:4000';
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Forward cookies
      body: JSON.stringify(body),
    });

    const data = await response.json();

    const responseHeaders = new Headers({ 'Content-Type': 'application/json' });

    // Forward refresh_token cookie from NestJS
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      responseHeaders.append('Set-Cookie', setCookieHeader);
    }

    // Set access_token as httpOnly cookie so the proxy can read it server-side
    if (data.accessToken) {
      const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
      responseHeaders.append(
        'Set-Cookie',
        `access_token=${data.accessToken}; HttpOnly; Path=/; SameSite=Strict; Max-Age=900${secure}`,
      );
    }

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: responseHeaders,
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

