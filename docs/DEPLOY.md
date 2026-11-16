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
4. **`GITHUB_TOKEN`**（强烈建议）：只读公开仓库即可，不需要任何 scope。Vercel 出口 IP 共享，匿名 GitHub API 很容易被限流；GitHub 开发活跃度因子拉取失败且无缓存时，请求会明确报错（不再静默当作 0）。
5. **安全飞地（`tee: true`）在 Vercel 上的运行条件**：
   - 仓库已内置 `enclave-worker/wasm/verithesis-wasi.wasm` 与 `web-app/public/verithesis-wasi.wasm`，`next.config.ts` 的 `outputFileTracingIncludes` 会把它们打进 `rerun` / `verify` / `capabilities` 函数；
   - 用 Node 内置 `node:wasi` 执行，无需 wasmtime；结果 `provider` 为 `local-wasi`（逻辑飞地，无硬件证明）；
   - 数据目录在 Vercel 上自动落到 `/tmp`，各实例互不共享（金库接口需要先在同一实例上运行分析）；
   - 改过 `outlayer/verithesis-wasi/src/main.rs` 必须 `npm run build:wasm` 并同时提交两份 `.wasm`；可设 `VERITHESIS_EXPECTED_WASM_SHA256` 钉住版本；
   - 部署后访问 `/api/thesis/capabilities`，`tee.wasm` 应为 `true`。

## OutLayer TEE (production)

1. P2 HTTP 路线图：`outlayer/P2-HTTP-PORT.md`；Coordinator JSON：`outlayer/coordinator-contract.json`
2. `tee: true` 时 `runThesisAnalysis` → `callOutLayerThesis`（env 见 `web-app/.env.example`）
3. 本地无真飞地：`npm run mock:outlayer` + `.env.local`（见 `docs/attestation-runbook.md`）
4. 真部署后 coordinator 返回 `attestation.tdx_quote_b64`

## Verify hashes locally

After a run, copy `input_hash` and `output_hash` from the attestation drawer; re-POST the same `{ timeframe, target_token }` — hashes must match for identical data window (live APIs may drift slightly if new daily candle).

## Ghostore（产品分支）

Vercel **仅需服务端** `GHOSTORE_API_URL=https://api.ghostore.pw`（不要 `NEXT_PUBLIC_GHOSTORE_API`）。

| 变量 | 说明 |
|------|------|
| `VERITHESIS_REQUIRE_AUTH=1` | `rerun` 必须登录 |
| `VERITHESIS_SNAPSHOT_ONLY=1` | `rerun` 只读 Hub 市场快照，不打上游 API |
| `VERITHESIS_DISABLE_HUB_ARCHIVE=1` | 可选：不归档 runs |

市场数据由 Ghostore cron `ingest:snapshot` 写入；详见 `docs/GHOSTORE-INTEGRATION.md`。

### 预览部署（产品分支）

1. Vercel → Project → Git → Production Branch 保持 `main`（黑客松）；另开 **Preview** 跟踪 `product/v1-ghostore-account`。
2. 对该分支配置上述 `GHOSTORE_*` / `VERITHESIS_*` 环境变量（仅 Preview 作用域亦可）。
3. 推送分支后打开 Preview URL：登录 Ghostore → 运行分析 → 核对快照 id 与 `api.ghostore.pw/.../snapshot/latest` 一致。
