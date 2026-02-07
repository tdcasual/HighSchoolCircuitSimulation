# Interaction Phase2 Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 完成 Interaction 第二阶段分层收口：拆分菜单/探针重逻辑、迁移 orchestrator 到 app 层、收敛动作层副作用与错误模型。  
**Architecture:** 保持 `Interaction` 作为 facade/composition root，新增 `ContextMenuController` 与 `ProbeActions`，并将编排入口迁移至 `src/app/interaction`。整个过程坚持 TDD：先写失败测试，再最小实现，再全量回归。  
**Tech Stack:** Vanilla JS (ES Modules), Vitest, DOM APIs, Node.js scripts

---

### Task 1: Create ContextMenuController Skeleton + hideContextMenu Delegation

**Files:**
- Create: `src/ui/interaction/ContextMenuController.js`
- Modify: `src/ui/Interaction.js`
- Create: `tests/interaction.contextMenuController.spec.js`

**Step 1: Write the failing test**

```js
import { describe, expect, it, vi } from 'vitest';
import * as ContextMenuController from '../src/ui/interaction/ContextMenuController.js';

describe('ContextMenuController.hideContextMenu', () => {
  it('removes menu element and detaches click listener', () => {
    const remove = vi.fn();
    const menu = { remove };
    vi.stubGlobal('document', {
      getElementById: vi.fn(() => menu),
      removeEventListener: vi.fn()
    });
    const ctx = { hideContextMenuHandler: vi.fn() };
    ContextMenuController.hideContextMenu.call(ctx);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(document.removeEventListener).toHaveBeenCalledWith('click', ctx.hideContextMenuHandler);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/interaction.contextMenuController.spec.js`  
Expected: FAIL (`module/function missing`).

**Step 3: Write minimal implementation**

```js
export function hideContextMenu() {
  const menu = document.getElementById('context-menu');
  if (!menu) return;
  menu.remove();
  document.removeEventListener('click', this.hideContextMenuHandler);
}
```

**Step 4: Delegate from Interaction facade**

```js
hideContextMenu() {
  return ContextMenuController.hideContextMenu.call(this);
}
```

**Step 5: Run tests and commit**

Run: `npm test -- tests/interaction.contextMenuController.spec.js tests/interaction.orchestrator.spec.js`  
Expected: PASS.

```bash
git add src/ui/interaction/ContextMenuController.js src/ui/Interaction.js tests/interaction.contextMenuController.spec.js
git commit -m "refactor(interaction): extract context menu controller skeleton"
```

### Task 2: Move showContextMenu and showWireContextMenu into ContextMenuController

**Files:**
- Modify: `src/ui/interaction/ContextMenuController.js`
- Modify: `src/ui/Interaction.js`
- Modify: `tests/interaction.contextMenuController.spec.js`

**Step 1: Write failing tests for component/wire menus**

```js
it('showContextMenu renders menu items for selected component', () => { /* assert menu item text */ });
it('showWireContextMenu renders straighten + delete actions', () => { /* assert menu item text */ });
```

**Step 2: Verify failure**

Run: `npm test -- tests/interaction.contextMenuController.spec.js`  
Expected: FAIL (`functions not exported / assertions fail`).

**Step 3: Move code with minimum behavior change**

- 复制 `showContextMenu` 与 `showWireContextMenu` 逻辑到 `ContextMenuController.js`。
- `Interaction.js` 改为委托：

```js
showContextMenu(e, componentId) {
  return ContextMenuController.showContextMenu.call(this, e, componentId);
}
showWireContextMenu(e, wireId) {
  return ContextMenuController.showWireContextMenu.call(this, e, wireId);
}
```

**Step 4: Run focused tests**

Run: `npm test -- tests/interaction.contextMenuController.spec.js tests/interaction.componentActions.spec.js`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/ui/interaction/ContextMenuController.js src/ui/Interaction.js tests/interaction.contextMenuController.spec.js
git commit -m "refactor(interaction): extract component and wire context menus"
```

### Task 3: Move showProbeContextMenu and hideContextMenuHandler into ContextMenuController

**Files:**
- Modify: `src/ui/interaction/ContextMenuController.js`
- Modify: `src/ui/Interaction.js`
- Modify: `tests/interaction.contextMenuController.spec.js`

**Step 1: Add failing tests**

```js
it('showProbeContextMenu includes rename/add-plot/delete items', () => { /* assert menu entries */ });
it('hideContextMenuHandler triggers hideContextMenu', () => { /* assert callback behavior */ });
```

**Step 2: Verify RED**

Run: `npm test -- tests/interaction.contextMenuController.spec.js`  
Expected: FAIL.

**Step 3: Minimal implementation**

- 抽取 `showProbeContextMenu` 到 controller。
- 将 `hideContextMenuHandler` 从类属性变为构造器绑定：

```js
this.hideContextMenuHandler = () => this.hideContextMenu();
```

**Step 4: Verify GREEN**

Run: `npm test -- tests/interaction.contextMenuController.spec.js tests/interaction.orchestrator.spec.js`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/ui/interaction/ContextMenuController.js src/ui/Interaction.js tests/interaction.contextMenuController.spec.js
git commit -m "refactor(interaction): extract probe context menu behavior"
```

### Task 4: Create ProbeActions Module (rename/delete/addPlot/addObservationProbe)

**Files:**
- Create: `src/ui/interaction/ProbeActions.js`
- Modify: `src/ui/Interaction.js`
- Create: `tests/interaction.probeActions.spec.js`

**Step 1: Write failing tests**

```js
it('renameObservationProbe updates probe label and refreshes wire rendering', () => { /* assert runWithHistory and renderer.renderWires */ });
it('deleteObservationProbe removes probe and updates status', () => { /* assert removeObservationProbe */ });
it('addProbePlot activates observation tab and adds plot', () => { /* assert addPlotForSource */ });
it('addObservationProbeForWire creates probe and refreshes panel', () => { /* assert addObservationProbe */ });
```

**Step 2: Verify RED**

Run: `npm test -- tests/interaction.probeActions.spec.js`  
Expected: FAIL (`module missing`).

**Step 3: Implement minimal extraction**

- 从 `Interaction.js` 迁移四个探针动作。
- `Interaction.js` 委托调用：

```js
renameObservationProbe(id, nextLabel = null) { return ProbeActions.renameObservationProbe.call(this, id, nextLabel); }
```

**Step 4: Verify GREEN**

Run: `npm test -- tests/interaction.probeActions.spec.js tests/interaction.contextMenuController.spec.js`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/ui/interaction/ProbeActions.js src/ui/Interaction.js tests/interaction.probeActions.spec.js
git commit -m "refactor(interaction): extract probe actions"
```

### Task 5: Move InteractionOrchestrator from ui layer to app layer

**Files:**
- Create: `src/app/interaction/InteractionOrchestrator.js`
- Modify: `src/ui/Interaction.js`
- Modify: `tests/interaction.orchestrator.spec.js`
- Delete: `src/ui/interaction/InteractionOrchestrator.js` (after migration)

**Step 1: Write failing import migration test**

```js
import * as InteractionOrchestrator from '../src/app/interaction/InteractionOrchestrator.js';
```

**Step 2: Verify RED**

Run: `npm test -- tests/interaction.orchestrator.spec.js`  
Expected: FAIL (`module not found`).

**Step 3: Minimal migration**

- 复制现有 orchestrator 到 `src/app/interaction`。
- 更新 `Interaction.js` import 路径。
- 测试路径同步更新。

**Step 4: Verify GREEN**

Run: `npm test -- tests/interaction.orchestrator.spec.js tests/interaction.componentActions.spec.js`  
Expected: PASS.

**Step 5: Remove old file and commit**

```bash
git add src/app/interaction/InteractionOrchestrator.js src/ui/Interaction.js tests/interaction.orchestrator.spec.js
git rm src/ui/interaction/InteractionOrchestrator.js
git commit -m "refactor(architecture): move interaction orchestrator to app layer"
```

### Task 6: Introduce Action Result DTO for ComponentActions

**Files:**
- Modify: `src/ui/interaction/ComponentActions.js`
- Modify: `src/app/interaction/InteractionOrchestrator.js`
- Modify: `src/ui/Interaction.js`
- Modify: `tests/interaction.componentActions.spec.js`

**Step 1: Add failing test for DTO contract**

```js
it('addComponent returns action result DTO', () => {
  const result = ComponentActions.addComponent.call(ctx, 'Resistor', 10, 20);
  expect(result).toEqual(expect.objectContaining({ ok: true, type: 'component.added' }));
});
```

**Step 2: Verify RED**

Run: `npm test -- tests/interaction.componentActions.spec.js`  
Expected: FAIL.

**Step 3: Implement minimal DTO**

- 动作函数返回 `{ ok, type, payload, message }`。
- 将 UI 提示与面板刷新逐步上移到 orchestrator/facade 消费 DTO。

**Step 4: Verify GREEN**

Run: `npm test -- tests/interaction.componentActions.spec.js tests/interaction.orchestrator.spec.js`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/ui/interaction/ComponentActions.js src/app/interaction/InteractionOrchestrator.js src/ui/Interaction.js tests/interaction.componentActions.spec.js
git commit -m "refactor(interaction): return component action result DTOs"
```

### Task 7: Add Layered Error Codes + Centralized Logger

**Files:**
- Create: `src/core/errors/ErrorCodes.js`
- Create: `src/core/errors/AppError.js`
- Create: `src/utils/Logger.js`
- Modify: `src/app/interaction/InteractionOrchestrator.js`
- Modify: `src/ui/interaction/ComponentActions.js`
- Modify: `tests/interaction.orchestrator.spec.js`

**Step 1: Write failing tests**

```js
it('maps interaction failure to APP_ERR_* code', () => { /* assert error.code */ });
it('logger attaches traceId for action failures', () => { /* assert structured payload */ });
```

**Step 2: Verify RED**

Run: `npm test -- tests/interaction.orchestrator.spec.js`  
Expected: FAIL.

**Step 3: Minimal implementation**

- 定义错误码常量：`UI_ERR_*`, `APP_ERR_*`, `TOPO_ERR_*`, `SIM_ERR_*`, `IO_ERR_*`。
- 对 orchestrator 关键异常路径包装为 `AppError`。

**Step 4: Verify GREEN**

Run: `npm test -- tests/interaction.orchestrator.spec.js tests/solver.commonCases.spec.js`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/core/errors/ErrorCodes.js src/core/errors/AppError.js src/utils/Logger.js src/app/interaction/InteractionOrchestrator.js src/ui/interaction/ComponentActions.js tests/interaction.orchestrator.spec.js
git commit -m "refactor(errors): add layered error codes and logger integration"
```

### Task 8: Full Regression + Docs Update

**Files:**
- Modify: `README.md`
- Modify: `docs/plans/2026-02-07-interaction-modularization-design.md`
- Modify: `docs/plans/2026-02-07-interaction-architecture-evaluation-design.md`

**Step 1: Run full regression**

Run:

```bash
npm test
npm run baseline:p0
npm run baseline:circuitjs
npm run baseline:ai
```

Expected: All PASS.

**Step 2: Update docs**

- 更新实际分层路径（包含 `src/app/interaction`）。
- 记录 DTO 与错误码规范。

**Step 3: Final commit**

```bash
git add README.md docs/plans/2026-02-07-interaction-modularization-design.md docs/plans/2026-02-07-interaction-architecture-evaluation-design.md
git commit -m "docs: update interaction architecture after phase2 refactor"
```

## Quality Gates (Must Pass Per Task)

- `npm test -- <touched tests>` 通过。
- 本任务相关 baseline（如触及求解/导线行为）通过。
- 每个任务单独 commit，避免混合改动。

## End State Checklist

- `src/ui/Interaction.js` 行数降至 `<= 1500`。  
- 新增拆分测试 `>= 20`。  
- `InteractionOrchestrator` 位于 `src/app/interaction`。  
- 动作层具备 DTO 输出与分层错误码。  
- 全量测试与三套 baseline 持续绿色。
