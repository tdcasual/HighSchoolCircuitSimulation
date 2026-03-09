# Maintainability Governance

本文档定义当前分支的可维护性治理约束：共享 seam 放置规则、热点预算、兼容层策略与每个重构切片的验证要求。

## 1. Shared Seam Rules

- 跨层共享基础设施必须放在 `src/utils/` 或明确的 `src/core/services/`。
- `src/app/`、`src/ui/`、`src/ai/` 不得互相通过兼容层反向依赖底层实现细节。
- 新增“共享能力”时，优先提供 canonical 实现，再决定是否保留短期 compatibility re-export。

## 2. Hotspot Budgets

以下预算分为两层：

- **hard**：当前 CI 硬门槛，超过即失败。
- **target**：下一阶段治理目标，超过会告警但不会阻塞当前 CI。

| File | Hard | Target |
|---|---:|---:|
| `src/core/runtime/Circuit.js` | 1400 | 1300 |
| `src/components/Component.js` | 1200 | 1100 |
| `src/ui/charts/ChartWindowController.js` | 450 | 360 |
| `src/app/interaction/InteractionOrchestrator.js` | 300 | 240 |
| `src/core/simulation/MNASolver.js` | 650 | 550 |
| `src/app/AppRuntimeV2.js` | 575 | 500 |

## 3. Bundle Budgets

- Main bundle hard budget: `400 KiB`
- Main bundle target budget: `360 KiB`
- Total JS hard budget: `620 KiB`
- Total JS target budget: `580 KiB`

说明：`main` 预算衡量首屏关键路径；`total` 预算衡量所有延迟块的总体资产包络。代码分块后，优先收紧 `main`，同时给 `total` 留出延迟加载开销余量。

## 4. Shim Policy

- 当前 shim inventory baseline 为 `0`。
- 任何新增 shim（即 `@deprecated` 标记总数增长）都会触发 `check:maintainability` 失败。
- 若必须引入短期兼容层，需先在计划中声明删除时点，并在同一轮或下一轮将 baseline 收回 `0`。

## 5. Verification Contract

每次可维护性切片至少执行：

```bash
npm run lint
npm run check:core-size
npm run check:maintainability
npm run report:debt-dashboard
```

涉及求解器、运行时或数值路径时，还应追加：

```bash
npm run baseline:p0
npm run baseline:circuitjs
```

## 6. Working Agreement

- 先补 seam/委托测试，再拆分实现。
- 兼容层只允许作为短期过渡，且必须显式标记。
- debt dashboard 是事实快照；预算脚本是 CI 判定来源。
- 对 hard budget 的修改必须同时更新：脚本、dashboard、测试、本文档。
