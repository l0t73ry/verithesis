import { listSnapshots } from '@/lib/snapshots';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ snapshots: listSnapshots() });
}
