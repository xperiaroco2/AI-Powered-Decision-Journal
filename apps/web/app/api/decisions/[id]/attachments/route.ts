import { NextRequest } from 'next/server';
import { proxyGET, proxyMultipartPOST } from '@/lib/api-proxy';

/**
 * Decision Attachments API Routes (Proxy to NestJS)
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyMultipartPOST(`/decisions/${id}/attachments`, request);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyGET(`/decisions/${id}/attachments`, request);
}

