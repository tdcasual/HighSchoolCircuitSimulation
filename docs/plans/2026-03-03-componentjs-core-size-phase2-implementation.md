# Component.js Core-Size Phase2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 `check:core-size` 中 `src/components/Component.js` 的 legacy warning（95%）拆解为可独立执行的任务并落地，最终把文件规模降到 warning 阈值以下并建立长期防回弹结构。

**Architecture:** 保持 v1 对外 API 不变（`createComponent` / `ComponentDefaults` / `ComponentNames` / `SVGRenderer` 等导出名不变），通过“职责外提 + façade 组装”收敛 `Component.js`。拆分目标聚焦元数据、工厂、渲染分组、导线渲染、数值显示编排五类职责，按小步 TDD + 单任务单提交推进。

**Tech Stack:** Vanilla JS (ESM), Vitest, existing CI guards (`check:core-size`, `check`, `check:e2e`), debt dashboard scripts.

---

## Task Scoring (Independent Work Cards)

评分说明：10 分制，分值越高表示该维度越强。

| Task | 目标 | 影响收益 | 风险 | 独立性 | 复杂度 | 预计净减行数 |
|---|---|---:|---:|---:|---:|---:|
| T0 | 基线与执行日志建立 | 6 | 1 | 10 | 1 | 0 |
| T1 | 元数据目录外提（defaults/names/terminal） | 8 | 2 | 9 | 3 | 160-220 |
| T2 | 组件工厂外提（含 ID 计数器） | 8 | 3 | 8 | 4 | 70-110 |
| T3 | 导线渲染与 SVG 原语外提 | 7 | 4 | 7 | 4 | 120-180 |
| T4 | 元件图形渲染分组拆分 | 10 | 6 | 6 | 7 | 350-500 |
| T5 | 数值显示编排外提 | 7 | 3 | 7 | 4 | 80-120 |
| T6 | 门禁收紧与文档收口 | 9 | 2 | 9 | 2 | 0 |

**总体优先级**：`T1 -> T2 -> T3 -> T4 -> T5 -> T6`。

---

### Task 0: Baseline + Execution Log

**Files:**
- Create: `docs/plans/2026-03-03-componentjs-core-size-phase2-execution-log.md`
- Modify: `docs/plans/2026-03-02-core-file-decomposition-plan.md`

**Step 1: 建立执行假设（文档）**
- 明确本阶段是“行为等价重构”，禁止引入功能变化。
- 明确成功标准：`Component.js` 行数降到 warning 阈值以下（<95%）。

**Step 2: 记录基线证据**
Run: `npm run check:core-size && npm test -- tests/component.touchTargets.spec.js tests/component.renderSafety.spec.js tests/valueDisplayLayout.spec.js`
Expected: PASS，且 `Component.js` 仍显示 warning。

**Step 3: Commit**
```bash
git add docs/plans/2026-03-03-componentjs-core-size-phase2-execution-log.md docs/plans/2026-03-02-core-file-decomposition-plan.md
git commit -m "docs(plan): add phase2 component core-size decomposition baseline"
```

---

### Task 1: Extract Component Catalog (Metadata)

**Files:**
- Create: `src/components/catalog/ComponentCatalog.js`
- Modify: `src/components/Component.js`
- Create: `tests/component.catalog.spec.js`

**Step 1: 写失败测试（契约先行）**
- 断言 catalog 暴露：`ComponentDefaults`、`ComponentNames`、`getComponentTerminalCount`。
- 断言关键类型条目完整（`Resistor`、`Switch`、`Rheostat`、`Relay`、`BlackBox`）。

**Step 2: Run fail-first**
Run: `npm test -- tests/component.catalog.spec.js`
Expected: FAIL（模块不存在或导出不完整）。

**Step 3: 最小实现**
- 把 `ComponentDefaults` / `ComponentNames` / terminal-count 逻辑迁移到 `ComponentCatalog.js`。
- `Component.js` 改为 re-export，保持旧 import 路径兼容：
```js
export { ComponentDefaults, ComponentNames, getComponentTerminalCount } from './catalog/ComponentCatalog.js';
```

**Step 4: 验证**
Run: `npm test -- tests/component.catalog.spec.js tests/simulation.componentRegistry.spec.js tests/interaction.componentActions.spec.js`
Expected: PASS。

**Step 5: Commit**
```bash
git add src/components/catalog/ComponentCatalog.js src/components/Component.js tests/component.catalog.spec.js
git commit -m "refactor(component): extract component catalog metadata"
```

---

### Task 2: Extract Component Factory + ID Counter

**Files:**
- Create: `src/components/factory/ComponentFactory.js`
- Modify: `src/components/Component.js`
- Create: `tests/component.factory.spec.js`

**Step 1: 写失败测试**
- 断言 `createComponent` 默认显示策略不变（Voltmeter/Switch/BlackBox 特例）。
- 断言 `generateId/resetIdCounter/updateIdCounterFromExisting` 语义不变。

**Step 2: Run fail-first**
Run: `npm test -- tests/component.factory.spec.js`
Expected: FAIL。

**Step 3: 最小实现**
- 将工厂与 ID 计数器迁移到 `ComponentFactory.js`。
- `Component.js` 保留旧导出名并转发。

**Step 4: 验证**
Run: `npm test -- tests/component.factory.spec.js tests/circuit.io.spec.js tests/simulation.dynamicIntegrator.spec.js`
Expected: PASS。

**Step 5: Commit**
```bash
git add src/components/factory/ComponentFactory.js src/components/Component.js tests/component.factory.spec.js
git commit -m "refactor(component): extract component factory and id counter"
```

---

### Task 3: Extract SVG Primitives + Wire Renderer

**Files:**
- Create: `src/components/render/ComponentSvgPrimitives.js`
- Create: `src/components/render/ComponentWireRenderer.js`
- Modify: `src/components/Component.js`
- Create: `tests/component.wireRenderer.spec.js`

**Step 1: 写失败测试**
- 断言 wire path 更新、endpoint hit/hint 逻辑、`safeHasClass` 异常容错与当前行为一致。

**Step 2: Run fail-first**
Run: `npm test -- tests/component.wireRenderer.spec.js`
Expected: FAIL。

**Step 3: 最小实现**
- 提取 `addLine/addTerminal/addText` 到 primitives。
- 提取 `createWire/updateWirePath/updateWirePathWithGroup` 到 wire renderer。
- `SVGRenderer` 保持同名方法，对外行为不变。

**Step 4: 验证**
Run: `npm test -- tests/component.wireRenderer.spec.js tests/component.touchTargets.spec.js tests/renderer.valueSnapshot.spec.js`
Expected: PASS。

**Step 5: Commit**
```bash
git add src/components/render/ComponentSvgPrimitives.js src/components/render/ComponentWireRenderer.js src/components/Component.js tests/component.wireRenderer.spec.js
git commit -m "refactor(component): extract svg primitives and wire renderer"
```

---

### Task 4: Split Symbol Renderers by Type Group

**Files:**
- Create: `src/components/render/legacy/SourceRenderers.js`
- Create: `src/components/render/legacy/PassiveRenderers.js`
- Create: `src/components/render/legacy/ControlRenderers.js`
- Create: `src/components/render/legacy/InstrumentRenderers.js`
- Create: `src/components/render/legacy/RendererRegistryLegacy.js`
- Modify: `src/components/Component.js`
- Create: `tests/component.rendererDispatch.spec.js`

**Step 1: 写失败测试**
- 断言 `createComponentGroup` 通过 registry 路由到正确 render 方法。
- 断言未知类型不会抛出非预期错误（保持当前行为）。

**Step 2: Run fail-first**
Run: `npm test -- tests/component.rendererDispatch.spec.js`
Expected: FAIL。

**Step 3: 最小实现**
- 把 `render*` 方法按类型分组迁移至 4 个模块。
- 引入 legacy renderer registry：
```js
export const LEGACY_RENDERERS = {
  PowerSource: renderPowerSource,
  Resistor: renderResistor,
  // ...
};
```
- `Component.js` 的 `createComponentGroup` 改为 registry dispatch。

**Step 4: 验证**
Run: `npm test -- tests/component.rendererDispatch.spec.js tests/component.touchTargets.spec.js tests/interaction.measurementReadoutController.spec.js`
Expected: PASS。

**Step 5: Commit**
```bash
git add src/components/render/legacy src/components/Component.js tests/component.rendererDispatch.spec.js
git commit -m "refactor(component): split legacy symbol renderers by type group"
```

---

### Task 5: Extract Value Display Orchestration

**Files:**
- Create: `src/components/render/ComponentValueDisplayRenderer.js`
- Modify: `src/components/Component.js`
- Modify: `tests/valueDisplayLayout.spec.js` (必要时)
- Modify: `tests/component.renderSafety.spec.js` (必要时)

**Step 1: 写失败测试**
- 断言 row layout、format、`updateValueDisplay` 安全封装行为保持一致。

**Step 2: Run fail-first**
Run: `npm test -- tests/valueDisplayLayout.spec.js tests/component.renderSafety.spec.js`
Expected: 至少一项 FAIL（接口尚未迁移）。

**Step 3: 最小实现**
- 将 `addValueDisplay/getValueDisplayElements/layoutValueDisplay/updateValueDisplay/formatValue` 提取到独立模块。
- `SVGRenderer` 仅转发调用，保留旧方法签名。

**Step 4: 验证**
Run: `npm test -- tests/valueDisplayLayout.spec.js tests/component.renderSafety.spec.js tests/renderer.valueSnapshot.spec.js`
Expected: PASS。

**Step 5: Commit**
```bash
git add src/components/render/ComponentValueDisplayRenderer.js src/components/Component.js tests/valueDisplayLayout.spec.js tests/component.renderSafety.spec.js
git commit -m "refactor(component): extract value display orchestration module"
```

---

### Task 6: Tighten Budget + Closeout

**Files:**
- Modify: `scripts/ci/assert-core-file-size-budget.mjs`
- Modify: `docs/plans/2026-03-02-core-file-decomposition-plan.md`
- Modify: `docs/plans/2026-03-03-componentjs-core-size-phase2-execution-log.md`

**Step 1: 调整预算阈值**
- 根据实际拆分结果下调 `Component.js` 预算（建议 `<= 1500`，若拆分更充分可 `<= 1400`）。

**Step 2: 全量验证**
Run:
- `npm run check:core-size`
- `npm run check`
- `npm run check:e2e`
Expected: 全 PASS，且 `Component.js` 无 warning。

**Step 3: 文档收口**
- 更新分解计划与执行日志中的结果、风险和后续项。

**Step 4: Commit**
```bash
git add scripts/ci/assert-core-file-size-budget.mjs docs/plans/2026-03-02-core-file-decomposition-plan.md docs/plans/2026-03-03-componentjs-core-size-phase2-execution-log.md
git commit -m "build(ci): tighten component core-size budget after decomposition"
```

---

## Definition of Done (Phase2)

1. `src/components/Component.js` 行数低于 warning 线并显著回落（目标 `< 1500`）。
2. `check:core-size` 不再提示 `Component.js` warning。
3. 外部调用路径保持兼容（导出名与调用方式不变）。
4. 相关回归测试稳定通过（touch target、value display、wire update、renderer refresh）。
5. `check` + `check:e2e` 全绿。

## Global Verification Commands

```bash
npm run check:core-size
npm test -- tests/component.catalog.spec.js tests/component.factory.spec.js tests/component.wireRenderer.spec.js tests/component.rendererDispatch.spec.js tests/valueDisplayLayout.spec.js tests/component.renderSafety.spec.js tests/component.touchTargets.spec.js
npm run check
npm run check:e2e
```

## Rollback Checklist

1. 每个 Task 单独提交，失败可直接 `git revert <commit>`。
2. 如 touch target 回归，优先回退最近涉及 `ComponentSvgPrimitives` / `ComponentWireRenderer` 的提交。
3. 如数值显示错位，优先回退 `ComponentValueDisplayRenderer` 迁移提交。
4. 如类型渲染异常，优先回退 `RendererRegistryLegacy` 迁移提交。
