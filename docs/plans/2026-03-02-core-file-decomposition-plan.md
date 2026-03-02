# 核心大文件拆分计划（Circuit / Component / ObservationPanel）

## 背景

当前核心文件规模：

- `src/engine/Circuit.js`: 1961 行
- `src/components/Component.js`: 1649 行
- `src/ui/ObservationPanel.js`: 1587 行

这些文件继续增长会显著提高回归成本和合并冲突概率。

## 本轮止血措施

已新增 `scripts/ci/assert-core-file-size-budget.mjs` 并接入 `npm run check`，限制上限：

- `Circuit.js <= 2000`
- `Component.js <= 1700`
- `ObservationPanel.js <= 1650`

目标是先阻止继续膨胀，再进行结构拆分。

## 拆分顺序与目标

1. `ObservationPanel.js`（低风险先行）
   - 拆出图卡控制器（增删图、轴配置、缩放范围）
   - 拆出交互覆盖层（十字准星、冻结读数）
   - 目标：降到 `< 1100` 行

2. `Component.js`
   - 拆出几何与命中测试（terminal/segment/collision）
   - 拆出渲染辅助（标签、方向、高亮状态）
   - 目标：降到 `< 1200` 行

3. `Circuit.js`
   - 拆出拓扑缓存与节点重建
   - 拆出短路诊断与稳定性防护管线
   - 拆出仿真循环编排（step/tick 与 runtime guard）
   - 目标：降到 `< 1400` 行

## 拆分执行规则

- 每次只拆一类职责，保持行为等价。
- 每次拆分都必须配套：
  - 单元测试或回归测试补强
  - `npm run check:full` 全量通过
  - 基线结果无差异（除非变更说明明确记录）

