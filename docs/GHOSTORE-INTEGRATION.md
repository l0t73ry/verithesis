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
| `verithesis` | `product/v1-ghostore-account`（**勿推 `main`**） |
| `ghostore` | `main` |

## Ghostore API

| 方法 | 路径 | 鉴权 |
|------|------|------|
上述上游路径由 **VeriThesis 服务端** 调用；Ghostore 侧 **无需** 为 VeriThesis 配 Web CORS。

## 数据库

```bash
cd ghostore/server && node scripts/migrate.js
```

迁移：

- `030-verithesis-runs.js` → `verithesis_runs`
- `031-verithesis-data-snapshots.js` → `verithesis_data_snapshots`（cron 灌库 raw 层）

## 市场快照（最终设计）

1. **Cron** `verithesisIngest`（每 30min）→ `npx tsx verithesis/bin/ingest-snapshot-hub.mjs` → `POST /api/verithesis/snapshots/ingest`
2. **rerun**（`VERITHESIS_SNAPSHOT_ONLY=1`）只读 `GET /api/verithesis/snapshot/latest`，**不**再打 CoinGecko/RPC
3. **`VERITHESIS_REQUIRE_AUTH=1`**：`rerun` 必须 Ghostore 登录（Bearer）
4. 环境：`VERITHESIS_REPO_PATH`、`VERITHESIS_INGEST_KEY`（ghostore 与 ingest 脚本一致）

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
3. 部署 **verithesis** 分支 `product/v1-ghostore-account`（**勿用 `main` 作产品预览**）

### Vercel 预览 / 产品环境变量

| 变量 | 值 |
|------|-----|
| `GHOSTORE_API_URL` | `https://api.ghostore.pw` |
| `VERITHESIS_REQUIRE_AUTH` | `1` |
| `VERITHESIS_SNAPSHOT_ONLY` | `1` |
| `VERITHESIS_CODE_MEASUREMENT` | 部署 commit SHA |

VPS `ACCESS_IP_WHITELIST` 需放行 Vercel 出口 IP（服务端代理打 Hub）。  
验收：未登录 rerun → 401；登录后结论区显示 **Hub 快照 #id · 时间**。

## 后续（未做）

- NEAR 链上支付校验、Webhook、B2 大对象、Admin 菜单