# TEE 金库执行（占位 → OutLayer 钱包）

## 当前

- `POST /api/thesis/vault`，body `{ "output_hash": "<64 位 hex>" }`；服务端按 `output_hash` 从**服务端归档**取出运行结果再出计划（**不再信任客户端提交的 `ThesisResult`**，伪造的 bullish 结果无法拿到计划）。归档里没有该 run 时返回 404，需先重新运行分析
- `planVaultExecution()` 返回 **JSON 计划**，不广播链上交易
- **DAO 风控**（`evaluateVaultDaoRisk`）：`vault_eligible`、本 run 看多、官方信号非看空、MDD/Sharpe、当日 planned 次数（Hub `verithesis_vault_audit`）；未通过时 `reason` 形如 `dao_risk_*`
- `vault_eligible`：信号 `bullish` 且策略收益 > B&H 且 Sharpe > 0；`planVaultExecution()` 对不满足的结果返回 `rejected`（`signal_not_bullish` / `not_vault_eligible`）
- 回测已按「前一日信号、当日收益」计算（无前视），因子用相对涨跌幅，`vault_eligible` 不再被前视偏差虚高

## 策略护栏（写死）

- `VERITHESIS_VAULT_MAX_NEAR`（默认 `0.1`）
- 每日最多 1 笔（policy 字段）
- DEX：`ref-finance`（testnet 默认）
- `VERITHESIS_VAULT_NETWORK` 仅接受 `near-testnet` / `near-mainnet`，其它值回落 `near-testnet`

## 生产接线

1. OutLayer **TEE wallet under owner policy** 持有 swap 私钥  
2. Coordinator 在飞地内：分析 → 若 `strong buy` → `ref` swap ≤ cap  
3. 将 tx hash 写入 `attestation.signature_chain`  

设置 `VERITHESIS_VAULT_ENABLED=1` 仅表示允许返回 `status: planned`；仍须你接钱包 SDK。
