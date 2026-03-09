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

- `lint`：当前 ESLint 快照，包含 `errorCount`、`boundaryErrors`、`protectedWarnings`
- `runtimeSafety`：`safeInvokeMethod` 本地重复定义数量（`src/`）
- `v2RuntimeSafety`：`src/v2/` 内局部 `safeInvokeMethod` 重复定义数量
- `coreFiles` / `hotspots`：核心热点文件体积预算占用（与 `check:core-size` 对齐）
- `bundle`：前端 bundle 预算状态（读取 `dist/bundle-size-report.json`）
- `shimInventory`：`src/` 下过渡 shim / 兼容层标记快照（当前基线为 `0`）
- `legacyObservation`：`observationPanel` 旧运行时引用残留计数（`src/` + `scripts/e2e/`）

## Maintainability Contract

`npm run check:maintainability` 现在处于 **hard mode**：

1. 先生成最新 debt dashboard
2. 再校验维护性契约需要的关键字段与热点清单
3. 对 hard 级别违规执行失败判定

当前 hard gate 会在以下场景失败：

- 存在 lint error 或 protected warning
- 热点文件超过 hard budget
- bundle 超过 hard budget
- shim inventory 相比 baseline 增长

同时保留 target 级别告警：

- hotspot 超过 target 但未超过 hard → `warn`
- bundle 超过 target 但未超过 hard → `warn`
- shim inventory 为 `0` → `ok`

治理协议见：[`docs/process/maintainability-governance.md`](../process/maintainability-governance.md)

## Notes

- 若尚未执行 `npm run build:frontend`，bundle 指标会标记为 `warn` 并提示缺少报告。
- 看板是快照，不替代 `check:full`；用于趋势观察与清债排程。
- 调整 budget 时，必须同步更新脚本、dashboard、测试与治理文档。
- 对 code-splitting 场景，优先关注 `main bundle`；`total js output` 作为延迟块总体包络指标。
