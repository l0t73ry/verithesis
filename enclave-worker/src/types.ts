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
  /** Hub `verithesis_data_snapshots.id` — bound into input_hash when set. */
  data_snapshot_id?: number;
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
  /**
   * - `outlayer-intel-tdx`: executed by an OutLayer coordinator (hardware quote may still be unverified).
   * - `local-wasi`: WASI module gate on this host — logical enclave only, no hardware attestation.
   * - `local-dev`: plain Node run.
   */
  provider: 'outlayer-intel-tdx' | 'local-wasi' | 'local-dev';
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

export interface NearOnchainTelemetry {
  /** JSON-RPC endpoint that served the snapshot (`docs.near.org/api/rpc/providers`). */
  rpc_endpoint: string;
  chain_id: 'mainnet';
  block_height: number;
  block_hash: string;
  protocol_version: number;
  epoch_height?: number;
  active_validators: number;
  /** Total NEAR staked across current active validators (millions of NEAR, 1 decimal). */
  total_staked_mnear: number;
  /** Total NEAR L1 circulating/minted supply from finalized block header (millions of NEAR, 1 decimal). */
  total_supply_mnear: number;
  /** `total_staked / total_supply * 100` (1 decimal). */
  staking_ratio_pct: number;
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
  /** Live NEAR Mainnet consensus & staking fundamentals anchored via JSON-RPC at run time. */
  near_onchain?: NearOnchainTelemetry;
  /** Strong bullish + env gate — UI may offer TEE vault plan */
  vault_eligible?: boolean;
}
