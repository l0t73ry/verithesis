# 运行收据（Run receipt）

每次分析会生成不可变 **receipt**（不含完整 `series`，可公开存档）：

- 服务端：`web-app/.data/receipts/<output_hash>.json`
- 完整结果：`web-app/.data/runs/<output_hash>.json`
- 索引：`web-app/.data/runs-index.json`（最多 50 条）

## HTTP

```bash
curl -s "http://localhost:5830/api/thesis/receipt?run=<output_hash>"
```

## 分享

优先使用 **output_hash**（唯一对应一次执行）：

```text
https://<host>/?run=<output_hash>
```

`?hash=<input_hash>` 仍可用，返回该配置下 **最近一次** 归档。

## 字段

见 [TEMPLATE.json](./TEMPLATE.json)；由 `buildRunReceipt()` 生成。
