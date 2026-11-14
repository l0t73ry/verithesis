# 证明与飞地运维

## 三种运行模式

| 模式 | `tee` 开关 | 取数 | 分析 | 证明 `provider` |
|------|------------|------|------|------------------|
| 默认 | 关 | Node | Node | `local-dev` / `simulated` |
| 本地 WASM | 开 + wasm | Node | wasmtime 模块校验哈希 | `outlayer-intel-tdx`（逻辑飞地） |
| OutLayer | 开 + env | Worker（P2 目标：飞地内 HTTP） | 远端 WASI | `outlayer-intel-tdx` + quote |

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
| WASM gate 失败 | `npm run verify:wasm`；`stableStringify` 漂移 |
| verify POST `output_match: false` | 新 K 线入库；或 `realtime_unlocked` 不一致 |
| OutLayer 无 quote | Coordinator 未返回 `attestation.tdx_quote_b64` |

## 环境变量

见 `web-app/.env.example`。`VERITHESIS_WASM_SKIP_GATE=1` 仅本地调试（跳过 wasmtime 哈希闸门，勿用于演示）。
