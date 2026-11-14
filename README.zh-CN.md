# VeriThesis

[**English**](./README.md) | **简体中文**

可验证链上投资论点平台（NEAR Hackathon · Investment Thesis）。**以 [PROJECT_SPEC.md](./PROJECT_SPEC.md) 为准。**

- **在线 Demo**：[https://verithesis.vercel.app/](https://verithesis.vercel.app/)
- **源代码**：[https://github.com/l0t73ry/verithesis](https://github.com/l0t73ry/verithesis)
- **演示视频（X）**：[https://x.com/BlackburnR22177/status/2121521362321944923](https://x.com/BlackburnR22177/status/2121521362321944923)
- **投资论点与实证证伪报告**：[THESIS.md](./THESIS.md)
- **开源协议**：[MIT](./LICENSE)

## 结构

| 目录 | 说明 |
|------|------|
| `THESIS.md` | NEAR 投资论点报告（链上基本面证据 + 无前视回测证伪分析） |
| `enclave-worker/` | 分析、NEAR 主网 JSON-RPC 质押/验证者指标（`near-rpc.ts`）、哈希、OutLayer / 本地 WASI 飞地路径 |
| `web-app/` | Next.js Dashboard |
| `outlayer/verithesis-wasi/` | WASI 模块（`npm run build:wasm`） |
| `docs/VERIFY.md` | 哈希验真与复现 |
| `docs/SUBMISSION.md` | 黑客松提交清单 |
| `docs/attestation-runbook.md` | 飞地 / mock OutLayer |

## 运行

```bash
npm install
npm run build:wasm   # 可选：本地「安全飞地」（node:wasi 执行；wasmtime 仅用于 verify:wasm 交叉校验，可选）
npm run dev          # http://localhost:5830
```

## 评委三步复现（本地）

1. **运行分析**：`npm run dev` → 打开页面 → **运行分析**（可选打开 **安全飞地**，需已 `build:wasm`）。
2. **查看证明**：点击 **查看证明**，记录 `input_hash` / `output_hash` / `code_measurement`。
3. **独立复核**：

```bash
# 查询归档
curl -s "http://localhost:5830/api/thesis/verify?hash=<input_hash>"

# 复跑比对
curl -s -X POST http://localhost:5830/api/thesis/verify \
  -H 'content-type: application/json' \
  -d '{"hash":"<input_hash>"}'
```

或打开 `http://localhost:5830/?hash=<input_hash>`（载入归档 + 可 **重新运行并比对哈希**）。

详见 [`docs/VERIFY.md`](./docs/VERIFY.md)。

## 能力摘要

| 能力 | 状态 |
|------|------|
| 运行分析 + 证明弹窗 | ✅ |
| 归档 + `?hash=` 验真 | ✅ |
| 历史运行点击还原图表 | ✅ |
| `tee: true` → OutLayer 或本地 WASM | ✅ WASM 内分析与哈希对齐；`npm run mock:outlayer` 可模拟 quote |
| `GET /api/thesis/capabilities` | ✅ 飞地开关可用性 |
| `npm run verify:wasm` | ✅ Node ↔ WASM 交叉校验 |
| Paywall 真 0.1 NEAR | ⏸ 需你接钱包 |
| Vercel / GitHub / 视频 | ✅ [verithesis.vercel.app](https://verithesis.vercel.app/) · [l0t73ry/verithesis](https://github.com/l0t73ry/verithesis) · [X Video](https://x.com/BlackburnR22177/status/2121521362321944923) |

## Deploy

[docs/DEPLOY.md](./docs/DEPLOY.md)
