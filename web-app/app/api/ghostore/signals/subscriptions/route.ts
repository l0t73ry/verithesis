import { forwardGhostore } from '@/lib/ghostore-upstream';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  return forwardGhostore('/api/verithesis/signals/subscriptions', {
    headers: auth ? { Authorization: auth } : {},
  });
}

export async function DELETE(req: Request) {
  const auth = req.headers.get('authorization');
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });
  return forwardGhostore(`/api/verithesis/signals/subscriptions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: auth ? { Authorization: auth } : {},
  });
}