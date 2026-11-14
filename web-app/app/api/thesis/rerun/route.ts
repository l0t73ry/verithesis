import { runThesisAnalysis } from '@verithesis/enclave-worker';
import type { StrategyMode, TargetToken, ThesisInput, Timeframe } from '@verithesis/enclave-worker';
import { archiveRun } from '@/lib/run-archive';
import { appendSnapshot } from '@/lib/snapshots';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function parseBody(body: unknown): ThesisInput & { tee: boolean } {
  const o = body as Record<string, unknown>;
  const timeframe = (o.timeframe ?? '30d') as Timeframe;
  const target_token = (o.target_token ?? 'NEAR') as TargetToken;
  const smoothing_window = o.smoothing_window != null ? Number(o.smoothing_window) : 1;
  const tvl_weight = o.tvl_weight != null ? Number(o.tvl_weight) : 0.5;
  const strategy_mode = (o.strategy_mode ?? 'public') as StrategyMode;
  const payment_receipt = (o.payment_receipt as string) ?? null;
  const realtime_unlocked =
    Boolean(o.realtime_unlocked) ||
    (typeof payment_receipt === 'string' && payment_receipt.length > 0);
  const tee = Boolean(o.tee);
  if (!['7d', '30d', '90d'].includes(timeframe)) throw new Error('Invalid timeframe');
  if (!['NEAR', 'REF'].includes(target_token)) throw new Error('Invalid target_token');
  return {
    timeframe,
    target_token,
    smoothing_window,
    tvl_weight: Math.max(0.2, Math.min(0.8, tvl_weight)),
    strategy_mode,
    realtime_unlocked,
    payment_receipt,
    tee,
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = parseBody(body);
    const { tee, ...input } = parsed;
    const code_measurement =
      process.env.VERITHESIS_CODE_MEASUREMENT ?? process.env.VERCEL_GIT_COMMIT_SHA ?? undefined;
    const result = await runThesisAnalysis({ ...input, code_measurement }, { tee });
    archiveRun(result);
    if (result.snapshot) appendSnapshot(result.snapshot);
    return Response.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return Response.json({ error: message }, { status: 400 });
  }
}
