import type { SeriesPoint } from './types';
import { pctChange } from './math';
import { fetchWithTimeout } from './http';

export type ThesisFactors = {
  github_commits_7d: number;
  /** Demo synthetic — label in data_sources until paid perp feed in TEE */
  funding_rate_bps: number;
  /** Demo synthetic — derived from TVL momentum */
  whale_net_flow_musd: number;
};

const GITHUB_NEARCORE =
  'https://api.github.com/repos/near/nearcore/commits?per_page=100&since=';

/** Anonymous GitHub API allows 60 req/h; cache so a burst of runs does not exhaust it. */
const GITHUB_CACHE_TTL_MS = 10 * 60 * 1000;
let githubCache: { value: number; at: number } | null = null;

export function resetGithubCacheForTests() {
  githubCache = null;
}

/**
 * Commits to near/nearcore in the last 7 days.
 * Throws when GitHub is unreachable/limited and no cached value exists — a silent `0` would
 * downgrade bullish signals to neutral and be baked into `output_hash` as if it were real data.
 * Set `GITHUB_TOKEN` to raise the rate limit.
 */
export async function fetchGithubCommits7d(): Promise<number> {
  const now = Date.now();
  if (githubCache && now - githubCache.at < GITHUB_CACHE_TTL_MS) return githubCache.value;

  const since = new Date(now);
  since.setUTCDate(since.getUTCDate() - 7);
  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'user-agent': 'verithesis-hackathon',
  };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  try {
    const res = await fetchWithTimeout(`${GITHUB_NEARCORE}${since.toISOString()}`, { headers });
    if (!res.ok) throw new Error(`GitHub request failed (${res.status})`);
    const rows = (await res.json()) as unknown;
    if (!Array.isArray(rows)) throw new Error('GitHub response is not an array');
    githubCache = { value: rows.length, at: now };
    return rows.length;
  } catch (e) {
    if (githubCache) return githubCache.value; // stale beats wrong
    const reason = e instanceof Error ? e.message : String(e);
    throw new Error(`GitHub commit factor unavailable: ${reason}`);
  }
}

/** Deterministic demo factors (hashed with output; replace with oracle feeds in production TEE). */
export function deriveSyntheticFactors(series: SeriesPoint[]): Pick<ThesisFactors, 'funding_rate_bps' | 'whale_net_flow_musd'> {
  if (series.length < 2) {
    return { funding_rate_bps: 0, whale_net_flow_musd: 0 };
  }
  // pctChange guards zero prices, so this never produces Infinity/NaN.
  const changes = pctChange(series.map((s) => s.price_usd));
  const vol = changes.reduce((a, c) => a + Math.abs(c), 0) / changes.length;
  const funding_rate_bps = Math.round(vol * 10000 * 10) / 10;
  const tvlDelta = series[series.length - 1]!.defi_tvl_usd - series[0]!.defi_tvl_usd;
  const whale_net_flow_musd = Math.round((tvlDelta / 1e6) * 0.15 * 10) / 10;
  return { funding_rate_bps, whale_net_flow_musd };
}

export async function loadThesisFactors(series: SeriesPoint[]): Promise<ThesisFactors> {
  const [github_commits_7d, synth] = await Promise.all([
    fetchGithubCommits7d(),
    Promise.resolve(deriveSyntheticFactors(series)),
  ]);
  return { github_commits_7d, ...synth };
}
