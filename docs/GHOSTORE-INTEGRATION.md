# Ghostore Hub 集成（G0 + G1）

VeriThesis 账号、运行归档与配额由 **Ghostore** 提供；**浏览器只请求本站**，由 **Next 服务端代理** 转发到 Hub（**不做浏览器跨域**）。

## 浏览器 → VeriThesis → Ghostore

| 浏览器 | VeriThesis 路由 | 上游 |
|--------|-----------------|------|
| `POST /api/ghostore/login` | `app/api/ghostore/login` | `POST /api/client-apps/login` |
| `POST /api/ghostore/refresh` | `app/api/ghostore/refresh` | `POST /api/client-apps/refresh` |
| `GET /api/ghostore/quota` | `app/api/ghostore/quota` | `GET /api/verithesis/quota` |
| `POST /api/thesis/rerun`（带 Bearer） | 服务端 `archiveRunToHub` | `POST /api/verithesis/runs` |
| `GET /api/thesis/verify` | `fetchPublicRunFromHub` | `GET /api/verithesis/public/runs/:ref` |

## 分支

| 仓库 | 分支 |
|------|------|
| `verithesis` | `product/v1-ghostore-account` |
| `ghostore` | `feature/verithesis-hub-api` |

## Ghostore API

| 方法 | 路径 | 鉴权 |
|------|------|------|
上述上游路径由 **VeriThesis 服务端** 调用；Ghostore 侧 **无需** 为 VeriThesis 配 Web CORS。

## 数据库

```bash
cd ghostore/server && node scripts/migrate.js
```

迁移：`030-verithesis-runs.js` → 表 `verithesis_runs`。

## 环境变量

**Ghostore**（`.env`）：

- `VERITHESIS_QUOTA_RUNS_PER_DAY` — 默认 `100`

**VeriThesis**（`web-app/.env`，**勿**向浏览器暴露 Hub URL）：

- `GHOSTORE_API_URL=https://api.ghostore.pw` — 仅服务端
- `VERITHESIS_DISABLE_HUB_ARCHIVE=1` — 关闭 Hub（仅本地 `/tmp` 归档）

## 用户流程

1. 页头 **Ghostore 登录** → 同源 `/api/ghostore/login` → Hub `client-apps/login`（`appId=verithesis`）
2. **运行分析** → 本地归档 + 若带 `Authorization` 则 `POST /api/verithesis/runs`
3. `?run=` / verify → 先查 Hub `public/runs`，再回退本地 `run-archive`

## 部署顺序

1. 合并并部署 **ghostore**（迁移 + 重启 API）
2. 配置 **Vercel** 环境变量
3. 部署 **verithesis**

## 后续（未做）

- NEAR 链上支付校验、Webhook、B2 大对象、Admin 菜单