import { NextRequest } from 'next/server';
import { proxyPOST } from '@/lib/api-proxy';

/**
 * Decision Rerun API Route (Proxy to NestJS)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyPOST(`/decisions/${id}/rerun`, request);
}

