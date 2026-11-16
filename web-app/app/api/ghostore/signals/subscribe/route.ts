import { forwardGhostore } from '@/lib/ghostore-upstream';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const auth = req.headers.get('authorization');
  const body = await req.text();
  return forwardGhostore('/api/verithesis/signals/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: auth } : {}),
    },
    body,
  });
}