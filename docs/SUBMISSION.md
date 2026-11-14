# NEAR 黑客松提交清单（VeriThesis）

## 仓库与 Demo

| 项 | 你填 |
|----|------|
| GitHub 公开仓库 | `NEXT_PUBLIC_GITHUB_URL` |
| 在线 Demo（Vercel 等） | |
| OutLayer 项目 ID | `you.near/verithesis`（示例） |
| X / 视频链接（60s） | |

## 评委 60 秒脚本（建议）

1. 改参数（token / 30d / 平滑）→ **运行分析**  
2. **查看证明** → `input_hash` / `output_hash` / `code_measurement`  
3. **下载分享卡片** → 扫码 `/?hash=` 验真  
4. 勾选 **安全飞地** → 再跑（本地 WASM 或 OutLayer mock / 真部署）→ 弹窗出现 `tdx_quote_b64`（若有）  
5. 历史运行勾选 2 条 → **快照对比** 指标表  

## 提交前自检

```bash
cd verithesis
npm ci
npm run build:wasm
npm run verify:wasm
npm run build
```

- [ ] `web-app/.env` 无真实密钥入库（仅用 `.env.example`）  
- [ ] `VERITHESIS_CODE_MEASUREMENT` 在 Vercel 设为 commit SHA  
- [ ] 证明弹窗 `provider` 与叙述一致（`local-dev` vs `outlayer-intel-tdx`）  
- [ ] [`docs/VERIFY.md`](./VERIFY.md) 中的域名已换成线上 URL  

## 叙事要点

- **透明**：公开算法 + 可复现哈希  
- **密封**：`sealed` 模式 + `VERITHESIS_SEALED_BIAS` 仅服务端  
- **飞地**：WASI 测量 +（可选）Intel TDX quote  
- **商业**：Paywall 文案接 0.1 NEAR（演示为 mock receipt）  

## 相关文档

- [VERIFY.md](./VERIFY.md) — 验真 API / CLI  
- [DEPLOY.md](./DEPLOY.md) — Vercel + OutLayer  
- [attestation-runbook.md](./attestation-runbook.md) — TEE 运维  
- [../outlayer/P2-HTTP-PORT.md](../outlayer/P2-HTTP-PORT.md) — P2 飞地 HTTP 路线图  
