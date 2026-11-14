# VeriThesis

**English** | [**简体中文**](./README.zh-CN.md)

Verifiable on-chain investment thesis platform built for the **NEAR Hackathon (Investment Thesis Track)** powered by **OutLayer TEE**. See [PROJECT_SPEC.md](./PROJECT_SPEC.md) for the full specification.

- **Live Demo**: [https://verithesis.vercel.app/](https://verithesis.vercel.app/)
- **Source Code**: [https://github.com/l0t73ry/verithesis](https://github.com/l0t73ry/verithesis)
- **Demo Video (X)**: [https://x.com/BlackburnR22177/status/2121521362321944923](https://x.com/BlackburnR22177/status/2121521362321944923)
- **Research Thesis & Falsification Report**: [THESIS.md](./THESIS.md)
- **License**: [MIT](./LICENSE)

## Overview

Crypto investment research suffers from a "trust black box": analysts can cherry-pick time windows, alter charts, or curve-fit parameters with look-ahead bias, while quantitative researchers face the dilemma that open-sourcing alpha destroys it, yet closed-source signals lack credibility.

**VeriThesis** binds every thesis execution to a deterministic cryptographic attestation (`code_measurement` + `input_hash` + `output_hash` + optional Intel TDX quote via OutLayer WASI enclave):

1. **Live NEAR L1 JSON-RPC + Multi-Factor Backtest Engine**: Queries NEAR Mainnet JSON-RPC (`block` + `validators` via FastNEAR / `rpc.mainnet.near.org` failover, anchoring finalized block height, active validator count, and 128-bit `BigInt` yoctoNEAR staking ratio) alongside live NEAR & REF market series (CoinGecko + DefiLlama NEAR TVL + GitHub `near/nearcore` commit activity), computing Pearson correlation, Sharpe ratio, max drawdown, and strictly causal (no-look-ahead) strategy vs. Buy & Hold returns. See [THESIS.md](./THESIS.md) for the full evidence & falsification analysis.
2. **Dual Strategy Modes**: Supports both **Transparent** mode and **Sealed Alpha** mode (keeping proprietary strategy weights sealed inside the enclave while still proving execution integrity).
3. **Deterministic WASI Enclave & Cross-Verification**: Ships with a Rust `wasm32-wasip1` analyzer module (`verithesis-wasi`) executed as a deterministic SHA-256 hash gate (`node:wasi` / `wasmtime`) and compatible with OutLayer coordinator quotes.
4. **Independent Verification & Share Cards**: Every run generates an immutable receipt, a `?run=<output_hash>` verification link for one-click re-run comparison, a QR-embedded PNG share card, and a **Thesis Arena** for side-by-side snapshot comparison.

## Repository Structure

| Directory | Description |
|-----------|-------------|
| `THESIS.md` | Evidence-first NEAR investment thesis, causal backtest audit, and falsification criteria |
| `enclave-worker/` | Multi-factor analysis, NEAR Mainnet JSON-RPC telemetry (`near-rpc.ts`), deterministic hashing (`stableStringify` + SHA-256), OutLayer coordinator & local WASI enclave path |
| `web-app/` | Next.js 15 Dashboard (App Router, Ant Design, Recharts, i18n: `en` / `zh` / `ja` / `ru`) |
| `outlayer/verithesis-wasi/` | Rust `wasm32-wasip1` enclave module (`npm run build:wasm`) |
| `docs/VERIFY.md` | Hash verification & independent reproduction guide |
| `docs/SUBMISSION.md` | Hackathon submission checklist |
| `docs/attestation-runbook.md` | Enclave & mock OutLayer coordinator runbook |

## Quick Start

```bash
npm install
npm run build:wasm   # Optional: rebuild WASI module (pre-built binary included; wasmtime used for verify:wasm cross-check)
npm run dev          # http://localhost:5830
```

## 3-Step Verification for Judges

1. **Run Analysis**: Open [https://verithesis.vercel.app/](https://verithesis.vercel.app/) (or `http://localhost:5830` locally) → optionally toggle **Secure enclave** → click **Run analysis**.
2. **Inspect Attestation**: Click **View attestation** to inspect `code_measurement` (e.g. `wasm:sha256:0e9a774e…`), `input_hash`, `output_hash`, and the signature chain.
3. **Independent Re-Verification**:

```bash
# 1) Query archived run by output_hash or input_hash
curl -s "https://verithesis.vercel.app/api/thesis/verify?run=<output_hash>"

# 2) Re-run and compare SHA-256 hashes
curl -s -X POST https://verithesis.vercel.app/api/thesis/verify \
  -H 'content-type: application/json' \
  -d '{"run":"<output_hash>"}'
```

Or open `https://verithesis.vercel.app/?run=<output_hash>` in your browser to load the archived run and click **Re-run & compare hashes**.

See [`docs/VERIFY.md`](./docs/VERIFY.md) for details.

## Capabilities Matrix

| Capability | Status |
|------------|--------|
| Live multi-factor analysis + Attestation modal | ✅ |
| Run archive + `?run=<output_hash>` / `?hash=<input_hash>` verification | ✅ |
| Snapshot history restoration & **Thesis Arena** comparison | ✅ |
| `tee: true` → OutLayer coordinator or WASI SHA-256 hash gate | ✅ Deterministic Node ↔ Rust WASI hash alignment (`npm run mock:outlayer` for local quote stub) |
| `GET /api/thesis/capabilities` | ✅ Enclave availability probe |
| `npm run verify:wasm` | ✅ Node ↔ WASM golden fixture cross-check |
| Pay-per-call real-time unlock (0.1 NEAR) | ✅ Demo receipt flow (on-chain wallet wiring optional) |
| Live Demo / GitHub / Video | ✅ [verithesis.vercel.app](https://verithesis.vercel.app/) · [l0t73ry/verithesis](https://github.com/l0t73ry/verithesis) · [X Video](https://x.com/BlackburnR22177/status/2121521362321944923) |

## Deployment

See [docs/DEPLOY.md](./docs/DEPLOY.md).
