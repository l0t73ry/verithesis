export type Timeframe = '7d' | '30d' | '90d';
export type TargetToken = 'NEAR' | 'REF';
export type StrategyMode = 'public' | 'sealed';

export interface ThesisInput {
  timeframe: Timeframe;
  target_token: TargetToken;
  smoothing_window?: number;
  /** TVL vs price momentum blend in composite signal (0.2–0.8, default 0.5). */
  tvl_weight?: number;
  strategy_mode?: StrategyMode;
  realtime_unlocked?: boolean;
  payment_receipt?: string | null;
  code_measurement?: string;
}

export interface SeriesPoint {
  date: string;
  price_usd: number;
  defi_tvl_usd: number;
}

export interface ThesisConclusion {
  signal: 'bullish' | 'bearish' | 'neutral';
  pearson_r: number;
  r_squared: number;
  backtest_hit_rate: number;
  tvl_weight: number;
  github_commits_7d: number;
  funding_rate_bps: number;
  whale_net_flow_musd: number;
  sharpe_ratio: number;
  max_drawdown_pct: number;
  strategy_return_pct: number;
  buy_hold_return_pct: number;
  headline: string;
  summary: string;
}

export interface AttestationBundle {
  provider: 'outlayer-intel-tdx' | 'local-dev';
  code_measurement: string;
  execution_timestamp: string;
  input_hash: string;
  output_hash: string;
  quote: {
    status: 'verified' | 'pending' | 'simulated';
    tdx_quote_b64?: string;
    verifier_hint: string;
  };
  signature_chain: Array<{ role: string; status: 'pass' | 'mock' | 'pending'; detail: string }>;
}

export interface SnapshotRecord {
  id: string;
  saved_at: string;
  input_hash: string;
  output_hash: string;
  signal: ThesisConclusion['signal'];
  headline: string;
  timeframe: Timeframe;
  target_token: TargetToken;
}

export interface ThesisResult {
  thesis_title: string;
  input: ThesisInput;
  conclusion: ThesisConclusion;
  series: SeriesPoint[];
  series_lagged?: boolean;
  attestation: AttestationBundle;
  data_sources: string[];
  snapshot?: SnapshotRecord;
  strategy_mode: StrategyMode;
  /** Strong bullish + env gate — UI may offer TEE vault plan */
  vault_eligible?: boolean;
}
