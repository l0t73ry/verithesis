import { forwardGhostore } from '@/lib/ghostore-upstream';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const refreshToken = String(body.refreshToken || body.refresh_token || '').trim();
  if (!refreshToken) {
    return Response.json({ success: false, error: { message: '缺少 refreshToken' } }, { status: 400 });
  }
  return forwardGhostore('/api/client-apps/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
}