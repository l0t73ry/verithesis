# NEAR Investment Thesis: Verifiable Fundamental Co-Movement vs. Causal Timing

**Track**: NEAR Hackathon — `02. Investment Thesis` (`thesis`) & `03. Privacy & Private AI` (`privacy`)  
**Live Dashboard**: [https://verithesis.vercel.app/](https://verithesis.vercel.app/)  
**Enclave & Verification Engine**: `@verithesis/enclave-worker` + `outlayer/verithesis-wasi` (`wasm32-wasip1`)

---

## 1. The Claim (Working Hypothesis)

> **Hypothesis**: *Long-term value accrual in NEAR (`NEAR` and ecosystem DeFi proxy `REF`) is anchored by three verifiable on-chain and developer fundamentals — L1 staking security, NEAR DeFi TVL capital formation, and `near/nearcore` protocol engineering velocity — AND a weighted composite of daily NEAR TVL + price momentum can outperform passive Buy & Hold without look-ahead bias.*

Rather than publishing static screenshots or cherry-picked backtest windows, **VeriThesis** turns this claim into an **executable, cryptographically attested model** that any judge or researcher can re-run live across `7d`, `30d`, and `90d` windows, verify via SHA-256 input/output commitments, and cross-check inside a deterministic Rust WASI module (`verithesis-wasi.wasm`) or an OutLayer TEE coordinator.

When we subjected our own hypothesis to strict causal (no-look-ahead) testing, **half of the hypothesis held up and half was falsified by the data**. We report both below.

---

## 2. Live Data Sources & Exact Queries

Every analysis run pulls live data from four public sources (no proprietary black-box CSVs):

| Layer | Source | Endpoint / Method | Role in Model |
|---|---|---|---|
| **NEAR L1 Consensus & Stake** | Official NEAR Mainnet JSON-RPC (`docs.near.org/api/rpc`) | `POST https://rpc.mainnet.fastnear.com` (fallback `https://rpc.mainnet.near.org`) — methods `block` (`{"finality":"final"}`) & `validators` (`[null]`) | Anchors finalized `block_height`, `block_hash`, `protocol_version`, `active_validators`, `total_staked_mnear`, and `staking_ratio_pct` (`total_staked / total_supply`) using 128-bit `BigInt` yoctoNEAR math (`enclave-worker/src/near-rpc.ts`). |
| **NEAR DeFi Capital** | DefiLlama Chain TVL API | `GET https://api.llama.fi/v2/historicalChainTvl/NEAR` | Daily USD DeFi TVL time series on NEAR (`enclave-worker/src/fetcher.ts`). |
| **Asset Valuation** | CoinGecko Market Chart | `GET /api/v3/coins/{near\|ref-finance}/market_chart?vs_currency=usd&days={7\|30\|90}&interval=daily` | Daily UTC-aligned `NEAR` and `REF` spot price series. |
| **Core Protocol Velocity** | GitHub REST API | `GET https://api.github.com/repos/near/nearcore/commits?per_page=100&since=<UTC-7d>` | Trailing 7-day commit count on `near/nearcore`; acts as a fundamental health filter (`github_commits_7d >= 12` required to confirm any bullish signal). |

> **Honest Disclosure on Synthetic Demo Feeds**: `funding_rate_bps` (derived from realized daily volatility) and `whale_net_flow_musd` (derived from net window TVL delta) are deterministic synthetic proxies until a paid perp/indexer connector is wired inside OutLayer Sealed Secrets. They are explicitly labeled as `synthetic demo factors` in both the UI and every JSON receipt. BigQuery (`bigquery-public-data.crypto_near_mainnet_us`) and NEAR Intents Explorer (`1Click` JWT) were evaluated but omitted from the live public web button so judges can re-run the entire pipeline with **zero cloud billing credentials**.

---

## 3. Evidence Supporting the Long-Term NEAR Fundamental Case

Live telemetry anchored by VeriThesis on **2026-11-14 UTC** (NEAR Mainnet Protocol `v88`, block `#224,490,284`):

1. **Institutional-Grade L1 Economic Security**:
   - **Active Validators**: `345` active block/chunk producers on NEAR Mainnet.
   - **Staked Supply**: `~589.1M NEAR` actively staked out of `~1,311.7M NEAR` total supply — a **`44.9%` network staking ratio**, locking nearly half of circulating supply into consensus security.
2. **Sustained Core Engineering Velocity**:
   - `near/nearcore` recorded **`47` commits in the trailing 7 days** (`~3.9x` above our minimum fundamental health threshold of `12` commits/7d), confirming active L1 shipping independent of secondary-market price drawdowns.
3. **Strong Contemporaneous Price ↔ DeFi TVL Co-Movement**:
   - Across both the golden fixture (`80.0%` directional hit rate) and live 7d/30d NEAR windows (`~83.3%` same-day directional hit rate), NEAR DeFi TVL USD and NEAR token price move in the same direction on the vast majority of trading days (partially reinforced by NEAR-denominated collateral inside DeFi protocols).

---

## 4. Evidence Cutting Against Our Hypothesis (What Falsified Short-Term TVL Timing)

A central failure mode of crypto research is **look-ahead bias**: computing day $t$'s trading position from day $t$'s own TVL and price change ($\Delta \text{TVL}_t, \Delta P_t$) and multiplying it by day $t$'s return $r_t$.

We audited and eliminated both look-ahead bias and unit-scale distortion in `enclave-worker/src/backtest.ts` and `outlayer/verithesis-wasi/src/main.rs`:

1. **The Look-Ahead Illusion vs. Causal Reality**:
   - Under a **naive same-day signal**, the 6-day reference window in `outlayer/fixtures/wasm-golden.json` produced an illusory **`Sharpe = +15.333`** because high same-day co-movement (`80%` hit rate) guaranteed profiting from contemporaneous moves.
   - Once we enforced **strict causal execution** — position on day $t$ is decided strictly from day $t-1$'s relative percentage changes $\text{sign}(w_{\text{tvl}} \cdot \Delta\%\text{TVL}_{t-1} + (1 - w_{\text{tvl}}) \cdot \Delta\%P_{t-1})$ and applied to day $t$'s return — the exact same fixture flipped to **`Sharpe = -18.854`** and **`Strategy Return = -7.5%` vs. Buy & Hold `+5.9%`**.
2. **Live 30-Day Window Confirmation (2026-11-14)**:
   - On live 30-day NEAR mainnet data (`smoothing_window = 3`, `w_tvl = 0.5`), the causal strategy returned **`-8.9%` (`Sharpe = -0.633`)** while passive Buy & Hold returned **`-37.0%`**, emitting a **`bearish`** regime signal.
   - **Takeaway**: While causal risk-off positioning reduced drawdown dramatically compared to passive spot holding (`-8.9%` vs `-37.0%`) during a market downturn, **daily DeFi TVL is predominantly contemporaneous with spot price rather than a reliable 1-day leading alpha predictor** in choppy/mean-reverting regimes.

Because `vault_eligible` requires **all three** conditions (`signal === 'bullish'`, `sharpe_ratio > 0`, and `strategy_return_pct > buy_hold_return_pct`), VeriThesis **automatically rejects (`status: "rejected"`)** TEE vault swap execution under current market conditions instead of forcing trades on weak evidence.

---

## 5. What Would Change Our Mind

Our thesis engine encodes explicit, machine-checkable criteria for upgrading or downgrading conviction:

1. **To Upgrade to Actionable Bullish (`vault_eligible = true`)**:
   - Smoothed TVL/momentum composite correlation `Pearson r > 0.25` with positive 3-day momentum (`recentMom > 0`);
   - Fundamental filters intact: `nearcore` 7d commits `>= 12`, `funding_rate_bps <= 12`, `whale_net_flow_musd >= -2`;
   - **Out-of-sample causal edge**: No-look-ahead `sharpe_ratio > 0` AND `strategy_return_pct > buy_hold_return_pct` over a `30d` or `90d` window.
2. **To Falsify the Long-Term Fundamental Case**:
   - NEAR Mainnet `staking_ratio_pct` dropping sustainably below `30%` or `active_validators` contracting sharply;
   - `near/nearcore` 7-day commit activity falling below `12` across multiple consecutive weeks;
   - Persistent divergence (`Pearson r < -0.15`) where NEAR DeFi TVL denominated in non-NEAR terms contracts even during broad L1 recoveries.

---

## 6. One-Command Reproducibility

```bash
# 1. Run all 70+ unit tests (hash determinism, causal backtest, NEAR RPC failover, archive security)
npm test

# 2. Rebuild Rust wasm32-wasip1 module & cross-verify SHA-256 output hash parity vs. TypeScript
npm run verify:wasm

# 3. Trigger a live attested run (WASI gate + live NEAR Mainnet JSON-RPC + DefiLlama + CoinGecko + GitHub)
curl -s -X POST https://verithesis.vercel.app/api/thesis/rerun \
  -H 'content-type: application/json' \
  -d '{"timeframe":"30d","target_token":"NEAR","smoothing_window":3,"tee":true}' | jq '{signal: .conclusion.signal, sharpe: .conclusion.sharpe_ratio, strat_pct: .conclusion.strategy_return_pct, bh_pct: .conclusion.buy_hold_return_pct, near_onchain, attestation: {provider: .attestation.provider, input_hash: .attestation.input_hash, output_hash: .attestation.output_hash}}'
```
