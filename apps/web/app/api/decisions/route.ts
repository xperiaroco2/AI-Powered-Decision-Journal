import { NextRequest } from 'next/server';
import { proxyGET, proxyPOST } from '@/lib/api-proxy';

/**
 * Decisions API Routes (Proxy to NestJS)
 */

export async function POST(request: NextRequest) {
  return proxyPOST('/decisions', request);
}

export async function GET(request: NextRequest) {
  return proxyGET('/decisions', request);
}

