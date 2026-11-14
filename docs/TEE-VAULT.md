# TEE 金库执行（占位 → OutLayer 钱包）

## 当前

- `POST /api/thesis/vault`，body `{ "result": ThesisResult }`
- `planVaultExecution()` 返回 **JSON 计划**，不广播链上交易
- `vault_eligible`：信号 `bullish` 且策略收益 > B&H 且 Sharpe > 0

## 策略护栏（写死）

- `VERITHESIS_VAULT_MAX_NEAR`（默认 `0.1`）
- 每日最多 1 笔（policy 字段）
- DEX：`ref-finance`（testnet 默认）

## 生产接线

1. OutLayer **TEE wallet under owner policy** 持有 swap 私钥  
2. Coordinator 在飞地内：分析 → 若 `strong buy` → `ref` swap ≤ cap  
3. 将 tx hash 写入 `attestation.signature_chain`  

设置 `VERITHESIS_VAULT_ENABLED=1` 仅表示允许返回 `status: planned`；仍须你接钱包 SDK。
