# Deploy

## Local

```bash
cd verithesis
npm install
npm run dev
# http://localhost:5830
```

## Vercel

1. Import repo root `verithesis` (framework: Next.js, **Root Directory**: `web-app`).
2. Set `VERITHESIS_CODE_MEASUREMENT` = Git commit SHA on deploy.
3. `NEXT_PUBLIC_GITHUB_URL` = public repo.

## OutLayer TEE (production)

1. P2 HTTP 路线图：`outlayer/P2-HTTP-PORT.md`；Coordinator JSON：`outlayer/coordinator-contract.json`
2. `tee: true` 时 `runThesisAnalysis` → `callOutLayerThesis`（env 见 `web-app/.env.example`）
3. 本地无真飞地：`npm run mock:outlayer` + `.env.local`（见 `docs/attestation-runbook.md`）
4. 真部署后 coordinator 返回 `attestation.tdx_quote_b64`

## Verify hashes locally

After a run, copy `input_hash` and `output_hash` from the attestation drawer; re-POST the same `{ timeframe, target_token }` — hashes must match for identical data window (live APIs may drift slightly if new daily candle).
