# Debt Dashboard Generator

该文档说明如何生成并阅读技术债看板。

## Command

```bash
npm run report:debt-dashboard
```

## Output Files

- `docs/reports/debt-dashboard.json`：结构化机器可读指标（生成产物）
- `docs/reports/debt-dashboard.md`：便于评审的文本摘要（生成产物，默认不入库）

## Current Metrics Included

- `safeInvokeMethod` 本地重复定义数量（`src/`）
- 核心热点文件体积预算占用（与 `check:core-size` 对齐）
- 前端 bundle 预算状态（读取 `dist/bundle-size-report.json`）
- `observationPanel` 旧运行时引用残留计数（`src/` + `scripts/e2e/`）

## Notes

- 若尚未执行 `npm run build:frontend`，bundle 指标会标记为 `warn` 并提示缺少报告。
- 看板是快照，不替代 `check:full`；用于趋势观察与清债排程。
