# Observation Legacy Schema Prune Audit (Week9)

日期：2026-03-02
范围：`src/ui/observation/ObservationState.js` 模板归一化兼容路径
目标：完成 Batch C Slice B 的字段盘点，划分“必须保留”与“可删除”兼容分支，为 Task22 删除提供依据。

## 审计输入

- 代码路径：`src/ui/observation/ObservationState.js`
- 归一化入口：`normalizeObservationTemplate` / `normalizeObservationTemplateBindings`
- 调用方：`src/ui/ObservationPanel.js`（`normalizeTemplateCollection` / `fromJSON`）
- 现有测试：`tests/observationState.spec.js`、`tests/observationPanel.quickBind.spec.js`

## 字段盘点与分类

### 必须保留（Must Keep）

1. `templateName`
- 理由：历史模板命名键的主要别名；现有回归测试和迁移说明都覆盖该键。

2. `plotBindings`
- 理由：历史模板绑定数组的容器别名，仍作为过渡兼容入口。

3. `mode/collapsedCards/showGaugeSection`（顶层 legacy UI 字段）
- 理由：旧 observation schema 在 `ui` 对象形成前的核心 UI 偏好字段。

### 可删除（Removable）

1. `title`
2. `presetName`
3. `bindingMap`
4. `plot/plotId`
5. `target/source/quantity`

可删依据：
- 仓内调用、文档与测试未形成对这些字段的外部契约依赖；
- 这些字段主要是早期宽松兼容遗留，会扩大归一化复杂度与歧义；
- 保留 `templateName + plotBindings + 顶层 legacy UI` 已能覆盖主要历史模板迁移场景。

## Task22 删除策略

1. 在 `ObservationState` 移除可删除字段的读取分支。
2. 使用 fixture backfill 调整测试输入为“仍受支持”的 legacy 结构（保留 `templateName/plotBindings`，绑定项改为规范键）。
3. 跑回归门禁并记录结果。

## 风险与回滚

- 风险：极老模板若仅使用被移除字段，将在归一化后回落到默认值/忽略绑定项。
- 缓解：
  - 保留核心兼容入口（`templateName`、`plotBindings`、legacy UI 顶层字段）；
  - 用单独 commit 执行删除，失败可直接 `git revert`。
