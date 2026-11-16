import { GHOSTORE_APP_ID } from '@/lib/ghostore-auth';
import { forwardGhostore } from '@/lib/ghostore-upstream';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  if (!username || !password) {
    return Response.json({ success: false, error: { message: '用户名和密码必填' } }, { status: 400 });
  }
  return forwardGhostore('/api/client-apps/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appId: GHOSTORE_APP_ID,
      username,
      password,
      platform: 'web',
      clientVersion: '0.2.0',
    }),
  });
}