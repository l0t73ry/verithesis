import type { SeriesPoint } from './types';

export type ThesisFactors = {
  github_commits_7d: number;
  /** Demo synthetic — label in data_sources until paid perp feed in TEE */
  funding_rate_bps: number;
  /** Demo synthetic — derived from TVL momentum */
  whale_net_flow_musd: number;
};

const GITHUB_NEARCORE =
  'https://api.github.com/repos/near/nearcore/commits?per_page=100&since=';

export async function fetchGithubCommits7d(): Promise<number> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 7);
  const url = `${GITHUB_NEARCORE}${since.toISOString()}`;
  try {
    const res = await fetch(url, {
      headers: {
        accept: 'application/vnd.github+json',
        'user-agent': 'verithesis-hackathon',
      },
    });
    if (!res.ok) return 0;
    const rows = (await res.json()) as unknown[];
    return Array.isArray(rows) ? rows.length : 0;
  } catch {
    return 0;
  }
}

/** Deterministic demo factors (hashed with output; replace with oracle feeds in production TEE). */
export function deriveSyntheticFactors(series: SeriesPoint[]): Pick<ThesisFactors, 'funding_rate_bps' | 'whale_net_flow_musd'> {
  if (series.length < 2) {
    return { funding_rate_bps: 0, whale_net_flow_musd: 0 };
  }
  const prices = series.map((s) => s.price_usd);
  const vol =
    prices.slice(1).reduce((a, p, i) => a + Math.abs((p - prices[i]!) / prices[i]!), 0) /
    (prices.length - 1);
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
