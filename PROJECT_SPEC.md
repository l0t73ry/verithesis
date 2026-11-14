# 项目企划书：VeriThesis —— 基于 OutLayer TEE 的可验证链上投资论点平台

## 1. 项目背景与黑客松目标

- **参赛赛事**：NEAR Hackathon（总奖金 $250K，13 个赛道）
- **目标赛道**：Investment Thesis（投资论点赛道）
- **截止时间**：2026 年 11 月 14 日 23:59 UTC
- **核心痛点**：传统的加密货币投资分析存在严重的「信任黑盒」（可能挑选有利数据、篡改图表、事后修改模型参数拟合历史），且量化研究员面临「开源策略会失效、闭源策略无人信」的两难。
- **解决方案**：构建一个「可随时重跑、防事后诸葛亮、支持商业变现且密码学可验证」的投资分析 Web 应用。借助 OutLayer 的 Intel TDX 可信执行环境（TEE），每次数据分析都在隔离飞地内实时拉取数据并运算，输出图表数据的同时生成绑定「代码哈希 + 输入数据 + 输出结果」的硬件级加密证明（Attestation）。

## 2. 系统架构与全链路数据流

```text
[用户 / 黑客松评委 / 外部 AI Agent]
       │  1. 自然语言问询 / 选择参数 / 支付解锁最新信号
       ▼
[前端 Web 应用 (Next.js)]
       │  2. 发起 HTTPS 请求 (携带参数 & Pay-per-call 支付凭证)
       ▼
[OutLayer TEE 飞地 (Intel TDX Enclave)]
       ├──> 3. 读取 Sealed Secrets (受保护的 API Keys 与私密策略权重)
       ├──> 4. 通过飞地内 HTTPS 请求实时拉取 NEAR 链上数据 / 行情 API
       ├──> 5. 运行分析算法 (支持「公开透明模式」与「黑盒私密策略模式」)
       ├──> 6. 写入 Private Storage (自动归档带时间戳的历史预测快照)
       └──> 7. 输出 JSON 数据 + Intel TDX Attestation Quote
       ▼
[前端 Web 应用 (Next.js)]
       ├──> 8. 渲染主图表、历史预测对比时间轴、一键验真弹窗
       └──> 9. 一键生成带二维码与签名摘要的「可验证研究卡片」分享至 X
```

## 3. 核心与增强功能拆解（按开发优先级排序）

### 【P0】核心 MVP —— 必须优先跑通

| # | 模块 | 要点 |
|---|------|------|
| P0-1 | **OutLayer 飞地分析引擎** (`enclave-worker/`) | NEAR DeFi TVL 与价格动量领先/滞后相关性；飞地内 HTTPS 拉 DefiLlama / CoinGecko；标准化输出 + TDX 字段 |
| P0-2 | **实时重跑与验真台** (`web-app/`) | 7d/30d/90d + 平滑窗口；Re-run in TEE；Attestation 弹窗（Code / Timestamp / Signature chain） |

### 【P1.5】量化硬核（截止前交付）

| # | 模块 | 要点 |
|---|------|------|
| P1.5-1 | **多因子 + 回测** | TVL/动量权重 Fork；GitHub 7d（真实）+ funding/巨鲸（demo）；Sharpe / MDD / 策略 vs B&H 写入 `output_hash` |
| P1.5-2 | **Thesis Arena** | 快照对比表 PK；同 input 隐藏叠图 |
| P1.5-3 | **TEE Vault 占位** | `POST /api/thesis/vault` 返回 OutLayer 钱包执行计划（0.1 NEAR cap） |

### 【P3】赛后 / 真 TEE（愿景）

| # | 模块 | 要点 |
|---|------|------|
| P3-1 | WASI P2 飞地内 HTTP 全量取数 | `P2-HTTP-PORT.md` |
| P3-2 | OutLayer TEE 钱包 Ref swap | `docs/TEE-VAULT.md` |
| P3-3 | VRF 蒙特卡洛抗过拟合印章 | 100 次随机窗口 stress test |
| P3-4 | 链上质押预测池 | 24h 结算 |

### 【P1】高光增强 —— 提升评审与商业闭环

| # | 模块 | 要点 |
|---|------|------|
| P1-1 | **历史回测快照时间轴** | Private Storage 归档；前端 Historical Snapshots |
| P1-2 | **双模式** | Public vs Sealed Alpha（权重在 Sealed Secrets） |
| P1-3 | **Pay-per-call** | 默认 24h 滞后；0.1 NEAR / Payment Key 解锁实时 |
| P1-4 | **AI 自然语言调参** | NL → JSON 参数 → 触发重跑 |
| P1-5 | **可验证研究卡片** | Share Verified Card + 二维码 + 摘要 |

## 4. 推荐技术栈与目录结构

- **前端**：Next.js (App Router) + TypeScript + Tailwind + Recharts
- **国际化**：`web-app/lib/i18n/messages/` — **en / zh / ja / ru**，右上角语言切换，偏好写入 `localStorage`
- **TEE**：`enclave-worker/`（生产部署至 OutLayer WASI P2）

```text
verithesis/
├── PROJECT_SPEC.md
├── enclave-worker/
│   ├── src/
│   │   ├── index.ts
│   │   ├── fetcher.ts
│   │   └── analyzer.ts
│   └── package.json
└── web-app/
    ├── app/
    ├── components/
    └── package.json
```

## 5. 给 Cursor 的分步执行指令

1. 阅读 `@PROJECT_SPEC.md` + OutLayer 文档（app.outlayer.ai/docs、skills.outlayer.ai）
2. **P0**：`enclave-worker` 取数 + 相关性 + attestation 结构
3. **P0+P1**：`web-app` Dashboard、验真弹窗、快照轴、模式切换、Paywall、AI 助手、分享卡片

## 6. 黑客松最终交付清单

- Vercel 可访问 Demo（按钮可交互）
- 开源 GitHub + README 代码哈希比对说明
- X 60s 视频：调参重跑 → TDX 验真 → 验真卡片（@NEARProtocol @out_layer）
