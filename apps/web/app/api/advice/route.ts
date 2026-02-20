import { NextRequest } from 'next/server';
import { proxyGET, proxyPOST } from '@/lib/api-proxy';

/**
 * Advice API Routes (Proxy to NestJS)
 */

export async function POST(request: NextRequest) {
  return proxyPOST('/advice', request);
}

export async function GET(request: NextRequest) {
  return proxyGET('/advice', request);
}

