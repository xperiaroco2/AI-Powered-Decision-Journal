import { NextRequest } from 'next/server';
import { proxyGET } from '@/lib/api-proxy';

/**
 * Decision Detail API Route (Proxy to NestJS)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyGET(`/decisions/${id}`, request);
}

