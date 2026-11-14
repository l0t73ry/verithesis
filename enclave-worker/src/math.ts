export function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return 0;
  const x = xs.slice(0, n);
  const y = ys.slice(0, n);
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = x[i] - mx;
    const b = y[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  if (!den) return 0;
  return num / den;
}

/** Simple directional hit rate: when TVL Δ>0 and price Δ>0 same day, count hit */
export function backtestHitRate(series: { price_usd: number; defi_tvl_usd: number }[]): number {
  let hits = 0;
  let trials = 0;
  for (let i = 1; i < series.length; i++) {
    const dp = series[i].price_usd - series[i - 1].price_usd;
    const dt = series[i].defi_tvl_usd - series[i - 1].defi_tvl_usd;
    if (dp === 0 && dt === 0) continue;
    trials++;
    if ((dp > 0 && dt > 0) || (dp < 0 && dt < 0)) hits++;
  }
  return trials ? Math.round((hits / trials) * 1000) / 10 : 0;
}

export function pctChange(series: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1];
    if (!prev) {
      out.push(0);
      continue;
    }
    out.push((series[i] - prev) / prev);
  }
  return out;
}
