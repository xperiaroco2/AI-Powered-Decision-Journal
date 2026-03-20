/**
 * Token Refresh API Route (Proxy to NestJS)
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

    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers,
    });

    const data = await response.json();

    const responseHeaders = new Headers({ 'Content-Type': 'application/json' });

    // Forward refresh_token cookie from NestJS
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      responseHeaders.append('Set-Cookie', setCookieHeader);
    }

    // Refresh access_token httpOnly cookie
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

