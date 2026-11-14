# OutLayer WASI P2（生产 P0）

本地开发默认走 Next.js `tee: false`（`provider: local-dev`）。生产需在 OutLayer 飞地内跑与 `enclave-worker` 等价的分析逻辑。

## 接线（已实现）

1. 部署 WASI P2 模块（HTTP 拉 CoinGecko + DefiLlama，输出与 `ThesisResult` 同结构的 JSON + 可选 `tdx_quote_b64`）。
2. 配置环境变量（见 `web-app/.env.example`）。
3. 前端 `NEXT_PUBLIC_OUTLAYER_ENABLED=true` 后打开 **Secure enclave**，或 API 传 `tee: true`。
4. `enclave-worker/src/outlayer-coordinator.ts` 会 `POST {OUTLAYER_API_URL}/call/{OUTLAYER_PROJECT_ID}`。

## 本地 WASM（P0 分析 + 哈希）

`verithesis-wasi` 在 stdin 接收 `{ input, series, sealed_bias? }`，在模块内执行与 `enclave-worker` 相同的分析与 `stableStringify` 哈希。

```bash
npm run build:wasm
npm run verify:wasm   # 固定 fixture 与 Node 交叉校验 output_hash
```

`tee: true` 时 `local-tee.ts` 用 node:wasi 跑模块（`provider: local-wasi`）并 **强制** `output_hash` 与 Node 一致，否则拒绝返回。

## Mock coordinator（P2 联调）

```bash
npm run build:wasm
npm run mock:outlayer
```

见 `docs/attestation-runbook.md`、`coordinator-contract.json`。

## 下一步：WASI P2 HTTP + OutLayer 部署

| 步骤 | 说明 |
|------|------|
| 飞地内 HTTPS 取数（wasip2 / wasi-http） | `enclave-worker/src/data-sources.ts` + `P2-HTTP-PORT.md` |
| `outlayer upload` / `outlayer deploy` | 发布 WASM，SHA256 作为 `code_measurement` |
| Coordinator 响应 | 返回 `output` 或 `result` + `attestation.tdx_quote_b64` |

参考：[Building OutLayer Apps](https://skills.outlayer.ai/building-outlayer-apps/)

## 与本地引擎对齐

哈希算法须与 `enclave-worker/src/hash.ts` 一致（`stableStringify` + SHA256），否则 `POST /api/thesis/verify` 复跑比对会失败。
