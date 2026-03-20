/**
 * User Logout API Route (Proxy to NestJS)
 *
 * Note: This is a public endpoint (no authentication required)
 */
export async function POST(request: Request) {
  try {
    // Get cookies from the incoming request
    const cookieHeader = request.headers.get('cookie');

    // Forward to NestJS API
    const API_URL = process.env.API_URL || 'http://localhost:4000';
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Forward cookies to NestJS API
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    const response = await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers,
    });

    const responseHeaders = new Headers({ 'Content-Type': 'application/json' });

    // Forward refresh_token clearance from NestJS
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      responseHeaders.append('Set-Cookie', setCookieHeader);
    }

    // Clear the access_token httpOnly cookie
    responseHeaders.append(
      'Set-Cookie',
      'access_token=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0',
    );

    return new Response(null, {
      status: response.status,
      headers: responseHeaders,
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

