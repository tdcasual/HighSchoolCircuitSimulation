# 核心大文件拆分计划（Circuit / Component / ChartWindowController / InteractionOrchestrator）

## 背景

当前核心文件规模（ObservationPanel 已下线）：

- `src/engine/Circuit.js`: 1859 行
- `src/components/Component.js`: 1122 行
- `src/ui/charts/ChartWindowController.js`: 600 行
- `src/app/interaction/InteractionOrchestrator.js`: 189 行

这些文件继续增长会显著提高回归成本和合并冲突概率。

## 本轮止血措施

已新增 `scripts/ci/assert-core-file-size-budget.mjs` 并接入 `npm run check`，限制上限：

- `Circuit.js <= 2000`
- `Component.js <= 1500`
- `ChartWindowController.js <= 700`
- `InteractionOrchestrator.js <= 400`

目标是先阻止继续膨胀，再进行结构拆分。

## 拆分顺序与目标

1. `ChartWindowController.js`（优先）
   - 延续窗口交互、渲染、状态编辑职责拆分
   - 将窗口交互细分到 axis/source/layout 子控制器
   - 目标：降到 `< 450` 行

2. `Component.js`
   - 拆出几何与命中测试（terminal/segment/collision）
   - 拆出渲染辅助（标签、方向、高亮状态）
   - 目标：降到 `< 1200` 行

3. `Circuit.js`
   - 拆出拓扑缓存与节点重建
   - 拆出短路诊断与稳定性防护管线
   - 拆出仿真循环编排（step/tick 与 runtime guard）
   - 目标：降到 `< 1400` 行

4. `InteractionOrchestrator.js`（已完成阶段）
   - 当前已拆分至 187 行，后续以稳定为主
   - 目标：保持 `< 400` 行，不再作为首要拆分对象

## 拆分执行规则

- 每次只拆一类职责，保持行为等价。
- 每次拆分都必须配套：
  - 单元测试或回归测试补强
  - `npm run check:full` 全量通过
  - 基线结果无差异（除非变更说明明确记录）

## Phase2（Component.js warning 专项）

- 目标：清除 `check:core-size` 中 `src/components/Component.js` 95% warning，并将拆分颗粒细化到可独立执行任务。
- 计划文档：`docs/plans/2026-03-03-componentjs-core-size-phase2-implementation.md`
- 执行方式：按 Task 0~6 单任务单提交推进，优先顺序 `T1 -> T2 -> T3 -> T4 -> T5 -> T6`。

### Phase2 执行结果（2026-03-03）

1. `Component.js` 已从 1617 行降至 1122 行（`check:core-size` 从 warning 变为 ok）。
2. `ComponentCatalog` / `ComponentFactory` / `ComponentSvgPrimitives` / `ComponentWireRenderer` / `ComponentValueDisplayRenderer` 已拆出。
3. `createComponentGroup` 分派已从大 switch 收敛为 registry 映射。
4. 预算已收紧到 `Component.js <= 1500`，并通过 `check` 与 `check:e2e` 全量验证。
