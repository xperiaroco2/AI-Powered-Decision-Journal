import { NextRequest } from 'next/server';
import { proxyGET } from '@/lib/api-proxy';

/**
 * Dashboard API Route (Proxy to NestJS)
 *
 * Returns aggregated statistics for the current user's decisions:
 * - Category frequency (count per category)
 * - Bias frequency (count per bias name)
 *
 * Only includes latest COMPLETED analysis run per decision.
 */

export async function GET(request: NextRequest) {
  return proxyGET('/dashboard', request);
}

