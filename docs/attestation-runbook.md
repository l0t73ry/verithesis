# 证明与飞地运维

## 三种运行模式

| 模式 | `tee` 开关 | 取数 | 分析 | 证明 `provider` |
|------|------------|------|------|------------------|
| 默认 | 关 | Node | Node | `local-dev` / `simulated` |
| 本地 WASM | 开 + wasm | Node | node:wasi 模块校验哈希 | `local-wasi`（逻辑飞地，**无硬件证明**） |
| OutLayer | 开 + env | Worker（P2 目标：飞地内 HTTP） | 远端 WASI | `outlayer-intel-tdx` + quote（`quote.status` 仍为 `pending`，服务端**未做 DCAP 验签**） |

OutLayer 返回结果会在本地重算 `input_hash` / `output_hash` 并与自己提交的输入比对，不一致或哈希不是 64 位 hex 一律拒绝。接入 DCAP / `report_data == output_hash` 绑定校验之前，**不会**把 quote 标成 `verified`。

`GET /api/thesis/capabilities` 返回 `tee.available`（WASM 文件存在或 OutLayer env 已配）。

## 本地 Mock OutLayer（无真 TEE）

终端 A：

```bash
npm run build:wasm
npm run mock:outlayer
# → http://127.0.0.1:8791/call/demo.near/verithesis
```

`web-app/.env.local`：

```env
OUTLAYER_API_URL=http://127.0.0.1:8791
OUTLAYER_PROJECT_ID=demo.near/verithesis
NEXT_PUBLIC_OUTLAYER_ENABLED=true
```

终端 B：`npm run dev` → 打开 **安全飞地** → **运行分析** → 证明里应有 mock `tdx_quote_b64`。

> Mock 协调器**不会**再调远程 OutLayer，避免自调用；有 WASM 时走 `runThesisInLocalTee`，否则回退 Node 分析并挂上 mock quote。

## 真 OutLayer 部署（你操作）

1. 按 [outlayer/P2-HTTP-PORT.md](../outlayer/P2-HTTP-PORT.md) 完成 P2 HTTP 或先用当前「全量 `ThesisResult` worker」  
2. `outlayer upload` / deploy → 记下 WASM SHA256 → `VERITHESIS_CODE_MEASUREMENT=wasm:sha256:…`  
3. 配置 `OUTLAYER_API_URL`、`OUTLAYER_PROJECT_ID`、可选 `OUTLAYER_PAYMENT_KEY`  
4. Coordinator 响应格式见 [outlayer/coordinator-contract.json](../outlayer/coordinator-contract.json)  

## 哈希不一致排障

| 现象 | 可能原因 |
|------|----------|
| WASM gate 失败 | `npm run verify:wasm`（无 wasmtime 时自动改用 node:wasi）；`stableStringify` 漂移；改过 `main.rs` 后必须重新 `npm run build:wasm` 并提交两份 `.wasm` |
| verify POST `output_match: false` | 新 K 线入库；或 `realtime_unlocked` 不一致 |
| OutLayer 无 quote | Coordinator 未返回 `attestation.tdx_quote_b64` |

## 环境变量

见 `web-app/.env.example`。`VERITHESIS_WASM_SKIP_GATE=1` 仅本地调试（跳过 WASM 哈希闸门，勿用于演示；此时结果按 `local-dev` 标注，不再冒充飞地）。

- `VERITHESIS_EXPECTED_WASM_SHA256`：钉住允许使用的 WASM（hex，不带前缀），不一致直接拒绝运行。
- `GITHUB_TOKEN`：可选，提高 GitHub API 限额；GitHub 因子拉取失败且无缓存时请求会报错，而不是静默当作 0 次提交。
- `VERITHESIS_RATE_LIMIT_RERUN_PER_MIN`（默认 20）/ `VERITHESIS_RATE_LIMIT_TEE_PER_MIN`（默认 6）/ `VERITHESIS_RATE_LIMIT_VERIFY_PER_MIN`（默认 10）：按 IP 的进程内限流，`0` 关闭。
- `VERITHESIS_DISABLE_DEMO_PAYMENT=1`：关闭演示付费解锁（`demo-near-*` 收据）。服务端不再接受客户端自带的 `realtime_unlocked`，真实付费需自行接入 NEAR 交易校验。
- `OUTLAYER_TIMEOUT_MS`：OutLayer 调用超时（默认 60000）。
