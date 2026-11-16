import { forwardGhostore } from '@/lib/ghostore-upstream';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return forwardGhostore('/api/verithesis/snapshot/latest');
}