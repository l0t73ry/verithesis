# 验真与哈希复现（P0）

每次 **运行分析** 后：

- 完整 `ThesisResult` → `web-app/.data/runs/<output_hash>.json`
- 公开收据 → `web-app/.data/receipts/<output_hash>.json`
- 索引 → `web-app/.data/runs-index.json`（最多 50 条）

浏览器端同时写入 **IndexedDB**（`verithesis-runs`），服务端不可用时仍可载入本机历史。

## 1. 分享链接

分享卡片二维码指向：

```text
https://verithesis.vercel.app/?run=<output_hash>
```

兼容旧链接 `?hash=<input_hash>`（返回该配置下最近一次归档）。

打开后会：

1. 从归档载入该次运行的图表与结论  
2. 自动打开证明弹窗（若找到）  
3. 可点击 **重新运行并比对哈希** 做独立复核  

## 2. HTTP API

**查询归档**

```bash
curl -s "http://localhost:5830/api/thesis/verify?hash=<input_hash>"
```

**复跑比对**

```bash
curl -s -X POST http://localhost:5830/api/thesis/verify \
  -H 'content-type: application/json' \
  -d '{"hash":"<input_hash>"}'
```

返回 `output_match: true` 表示输出哈希与归档一致。行情 API 刚出新 K 线时可能短暂不一致。

## 3. CLI

```bash
cd verithesis
node bin/verify-run.mjs <input_hash> [--recheck]
```

## 4. 代码度量

部署时设置 `VERITHESIS_CODE_MEASUREMENT`（建议 Git commit SHA 或 OutLayer WASM SHA256）。证明弹窗中的 **Code measurement** 应与公开发布的版本一致。

## 5. 飞地能力探测

```bash
curl -s http://localhost:5830/api/thesis/capabilities
```

返回 `tee.wasm` / `tee.outlayer` / `tee.available`。

## 6. OutLayer TEE

配置下列变量后，请求体 `tee: true` 会通过 OutLayer coordinator 调用已发布的 WASI 模块（见 [outlayer/README.md](../outlayer/README.md)）：

- `OUTLAYER_API_URL`
- `OUTLAYER_PROJECT_ID`（如 `you.near/verithesis`）
- `OUTLAYER_PAYMENT_KEY`（可选）
- `NEXT_PUBLIC_OUTLAYER_ENABLED=true`（前端显示飞地开关）

未配置时默认 **本地可信路径**（`provider: local-dev`，`quote.status: simulated`），仍具备 input/output 哈希绑定，适合开发与演示。

本地 Mock coordinator：`npm run mock:outlayer`，详见 [attestation-runbook.md](./attestation-runbook.md)。

提交前清单：[SUBMISSION.md](./SUBMISSION.md)。
