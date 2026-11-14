# WASI P2：飞地内 HTTP 取数（路线图）

当前 **wasm32-wasip1** 模块只负责「分析 + 哈希」；行情由宿主（Node）拉取后通过 stdin 传入。生产 **OutLayer P2** 应在飞地内完成取数 + 分析。

## 须与 Node 对齐的文件

| 逻辑 | Node | Rust |
|------|------|------|
| URL | `enclave-worker/src/data-sources.ts` | 复制到 `fetch` 模块（P2） |
| 解析 / merge | `fetcher.ts` | `normalize_day_key` + merge（待实现） |
| 分析 / 哈希 | `analyzer.ts`, `hash.ts` | `main.rs`（已实现 0.3.0） |

## 目标 stdin（P2 worker）

OutLayer 发布后直接接收 **仅 input**，不再传 `series`：

```json
{
  "input": {
    "timeframe": "30d",
    "target_token": "NEAR",
    "smoothing_window": 1,
    "strategy_mode": "public",
    "realtime_unlocked": false
  }
}
```

stdout 为完整 `ThesisResult` 或当前 `WasmOutput` 超集（含 `series`）。

## HTTPS 端点（与 Node 一致）

- `GET coingeckoMarketChartUrlByDays(token, days)` — 见 `data-sources.ts`
- `GET defiLlamaNearTvlUrl()` — NEAR chain TVL 序列

## 本地联调（无真 TEE）

```bash
npm run build:wasm
npm run mock:outlayer
# web-app/.env.local:
# OUTLAYER_API_URL=http://127.0.0.1:8791
# OUTLAYER_PROJECT_ID=demo.near/verithesis
# NEXT_PUBLIC_OUTLAYER_ENABLED=true
```

然后 Dashboard 打开 **安全飞地** 再 **运行分析**；证明弹窗应出现 `tdx_quote_b64`（mock）+ `provider: outlayer-intel-tdx`。

参考：[Building OutLayer Apps](https://skills.outlayer.ai/building-outlayer-apps/)
