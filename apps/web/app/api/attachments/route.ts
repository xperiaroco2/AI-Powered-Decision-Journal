import { NextRequest } from 'next/server';
import { proxyGET } from '@/lib/api-proxy';

/**
 * GET /api/attachments (Proxy to NestJS)
 *
 * Fetch all attachments for the authenticated user.
 * Used by the advice page to populate the attachment dropdown.
 */
export async function GET(request: NextRequest) {
  return proxyGET('/attachments', request);
}

