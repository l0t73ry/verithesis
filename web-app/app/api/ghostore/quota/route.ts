import { forwardGhostore } from '@/lib/ghostore-upstream';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (!auth) {
    return Response.json({ success: false, error: { message: '未登录' } }, { status: 401 });
  }
  return forwardGhostore('/api/verithesis/quota', {
    method: 'GET',
    headers: { Authorization: auth },
  });
}