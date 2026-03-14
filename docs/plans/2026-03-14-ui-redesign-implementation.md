# UI Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不改变现有核心工作流的前提下，分阶段实现“课堂实验台 / 仪器面板”UI 改版，统一主工作台、观察图表、AI 助手、习题板和移动端抽屉的视觉与信息架构。

**Architecture:** 保持现有 `index.html` + `css/style.css` + 原生 JS 控制器架构，不引入新框架。实现上先建立语义化视觉 token 和工作台骨架，再逐步改造顶部操作区、元件托盘、中央空态、右侧实验面板、图表窗口、AI 助手和移动端抽屉；每一批都用 Vitest 合同测试和已有 E2E 回归守住行为稳定性。

**Tech Stack:** HTML, CSS, Vanilla JS controllers, Vitest, existing Node-based E2E scripts

---

## Preflight

### Task 0: Create isolated workspace

**Files:**
- Reference: `docs/plans/2026-03-14-ui-redesign-design.md`
- Reference: `index.html`
- Reference: `css/style.css`

**Step 1: Create a dedicated worktree**

Run:

```bash
git worktree add ../HighSchoolCircuitSimulation-ui-redesign -b codex/ui-redesign
```

Expected: new worktree created on branch `codex/ui-redesign`

**Step 2: Open the worktree and verify baseline**

Run:

```bash
cd ../HighSchoolCircuitSimulation-ui-redesign
npm test -- --runInBand
```

Expected: current baseline passes before UI work starts

**Step 3: Commit nothing yet**

Do not start implementation until the following tasks are copied into the worktree and executed slice-by-slice.

---

### Task 1: Introduce lab-bench design tokens

**Files:**
- Modify: `css/style.css:11-40`
- Modify: `css/style.css:88-120`
- Modify: `css/style.css:1006-1125`
- Test: `tests/ui.designTokens.spec.js`

**Step 1: Write the failing test**

Create `tests/ui.designTokens.spec.js` to assert that the stylesheet exposes the new semantic tokens and removes direct dependence on old visual primitives for new workbench surfaces.

```js
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('UI design tokens', () => {
    it('defines lab-bench semantic color tokens', () => {
        const css = readFileSync('css/style.css', 'utf8');
        expect(css).toContain('--surface-base');
        expect(css).toContain('--surface-elevated');
        expect(css).toContain('--accent-instrument');
        expect(css).toContain('--accent-observe');
        expect(css).toContain('--accent-run');
    });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run tests/ui.designTokens.spec.js
```

Expected: FAIL because the new tokens do not exist yet

**Step 3: Write minimal implementation**

Refactor the `:root` block in `css/style.css` to add a semantic token layer. Keep old tokens temporarily for backward compatibility, but make new workbench-facing surfaces consume new tokens first.

```css
:root {
    --surface-base: oklch(0.985 0.008 250);
    --surface-elevated: oklch(0.998 0.004 250);
    --surface-inset: oklch(0.955 0.010 250);
    --stroke-soft: oklch(0.86 0.012 250);
    --stroke-strong: oklch(0.72 0.018 250);
    --text-strong: oklch(0.28 0.020 255);
    --text-muted: oklch(0.50 0.016 255);
    --accent-instrument: oklch(0.63 0.16 250);
    --accent-observe: oklch(0.69 0.14 40);
    --accent-run: oklch(0.70 0.16 145);
    --accent-danger: oklch(0.64 0.19 25);
}
```

Then update `body`, `#top-action-bar`, `#toolbox`, `#side-panel`, `#status-bar` and shared button surfaces to consume those tokens.

**Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run tests/ui.designTokens.spec.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add css/style.css tests/ui.designTokens.spec.js
git commit -m "feat: add lab bench design tokens"
```

---

### Task 2: Recompose the top action bar and status ribbon

**Files:**
- Modify: `index.html:21-40`
- Modify: `index.html:310-316`
- Modify: `css/style.css:88-214`
- Modify: `css/style.css:912-1005`
- Modify: `src/ui/TopActionMenuController.js`
- Modify: `src/app/RuntimeUiBridge.js`
- Test: `tests/topActionMenuController.spec.js`
- Test: `tests/runtimeUiBridge.spec.js`
- Create: `tests/workbench.topBarContract.spec.js`

**Step 1: Write the failing test**

Create a DOM contract test for the reorganized top bar and status ribbon.

```js
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('workbench top bar contract', () => {
    it('contains left, center, and right workbench zones', () => {
        const html = readFileSync('index.html', 'utf8');
        expect(html).toContain('id="top-action-primary"');
        expect(html).toContain('id="top-action-session"');
        expect(html).toContain('id="top-action-secondary"');
        expect(html).toContain('id="status-ribbon"');
    });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run tests/workbench.topBarContract.spec.js tests/topActionMenuController.spec.js tests/runtimeUiBridge.spec.js
```

Expected: FAIL because the new DOM zones and status ribbon do not exist yet

**Step 3: Write minimal implementation**

Split the top action bar into three semantic regions and add a compact status ribbon:

```html
<div id="top-action-bar" role="toolbar" aria-label="实验操作">
  <div id="top-action-primary"></div>
  <div id="top-action-session">
    <div id="experiment-title">当前实验</div>
    <div id="experiment-session-hint">从元件托盘拖入器材开始</div>
  </div>
  <div id="top-action-secondary"></div>
</div>
<div id="status-ribbon" aria-live="polite"></div>
```

Update `TopActionMenuController` so mobile “更多” still controls the same actions after the HTML regrouping. Update `RuntimeUiBridge` so status copy can render into the new session hint / ribbon without breaking the legacy `status-text` fallback.

**Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run tests/workbench.topBarContract.spec.js tests/topActionMenuController.spec.js tests/runtimeUiBridge.spec.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add index.html css/style.css src/ui/TopActionMenuController.js src/app/RuntimeUiBridge.js tests/workbench.topBarContract.spec.js tests/topActionMenuController.spec.js tests/runtimeUiBridge.spec.js
git commit -m "feat: redesign top workbench bar and status ribbon"
```

---

### Task 3: Add guided empty state to the experiment canvas

**Files:**
- Modify: `index.html:277-309`
- Modify: `css/style.css:377-520`
- Modify: `src/app/AppRuntimeV2.js`
- Modify: `src/app/RuntimeUiBridge.js`
- Modify: `src/ui/interaction/PanelBindingsController.js`
- Test: `tests/runtimeUiBridge.spec.js`
- Create: `tests/workbench.emptyState.spec.js`

**Step 1: Write the failing test**

Create `tests/workbench.emptyState.spec.js` to assert the empty-state shell exists and is hidden once components are present.

```js
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('workbench empty state', () => {
    it('defines a guided canvas empty state', () => {
        const html = readFileSync('index.html', 'utf8');
        expect(html).toContain('id="workbench-empty-state"');
        expect(html).toContain('data-empty-action="series-circuit"');
        expect(html).toContain('data-empty-action="parallel-circuit"');
    });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run tests/workbench.emptyState.spec.js tests/runtimeUiBridge.spec.js
```

Expected: FAIL because the empty-state DOM and toggle logic do not exist yet

**Step 3: Write minimal implementation**

Add a lightweight HTML empty-state overlay inside `#canvas-container`:

```html
<section id="workbench-empty-state" aria-label="实验开始引导">
  <p class="workbench-kicker">课堂实验台</p>
  <h1>从左侧拖入元件，开始搭建你的第一个电路</h1>
  <div class="workbench-empty-actions">
    <button data-empty-action="series-circuit">串联示例</button>
    <button data-empty-action="parallel-circuit">并联示例</button>
    <button data-empty-action="meter-demo">电表示例</button>
  </div>
</section>
```

Use `AppRuntimeV2` / `RuntimeUiBridge` to toggle this overlay based on whether the circuit is empty. Wire CTA clicks in `PanelBindingsController` to either import example circuits or call existing example-loading helpers if present.

**Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run tests/workbench.emptyState.spec.js tests/runtimeUiBridge.spec.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add index.html css/style.css src/app/AppRuntimeV2.js src/app/RuntimeUiBridge.js src/ui/interaction/PanelBindingsController.js tests/workbench.emptyState.spec.js tests/runtimeUiBridge.spec.js
git commit -m "feat: add guided workbench empty state"
```

---

### Task 4: Rebuild the left tray and restore the right-side panel IA

**Files:**
- Modify: `index.html:43-275`
- Modify: `index.html:319-343`
- Modify: `css/style.css:215-376`
- Modify: `css/style.css:1006-1635`
- Modify: `src/ui/ToolboxCategoryController.js`
- Modify: `src/ui/interaction/PanelBindingsController.js`
- Modify: `src/ui/interaction/UIStateController.js`
- Modify: `src/ui/observation/ObservationInteractionController.js`
- Test: `tests/toolboxCategoryController.spec.js`
- Test: `tests/interaction.panelBindingsController.spec.js`
- Test: `tests/observation.runtimeContractGuard.spec.js`
- Create: `tests/sidePanel.tabsContract.spec.js`

**Step 1: Write the failing test**

Create `tests/sidePanel.tabsContract.spec.js` to assert the right panel exposes the intended tab structure.

```js
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('side panel tab contract', () => {
    it('restores properties, observation, and guide tabs', () => {
        const html = readFileSync('index.html', 'utf8');
        expect(html).toContain('data-panel="properties"');
        expect(html).toContain('data-panel="observation"');
        expect(html).toContain('data-panel="guide"');
        expect(html).toContain('id="panel-observation"');
    });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run tests/sidePanel.tabsContract.spec.js tests/toolboxCategoryController.spec.js tests/interaction.panelBindingsController.spec.js tests/observation.runtimeContractGuard.spec.js
```

Expected: FAIL because observation / guide tabs are not currently present in `index.html`

**Step 3: Write minimal implementation**

1. Rename the toolbox surface to a tray-like structure by adding a tray header, a “课堂常用” region, and stronger category headers.
2. Restore `side-panel-tabs` and add these pages:

```html
<div class="side-panel-tabs" role="tablist" aria-label="实验面板">
  <button class="panel-tab-btn active" data-panel="properties">属性</button>
  <button class="panel-tab-btn" data-panel="observation">观察</button>
  <button class="panel-tab-btn" data-panel="guide">说明</button>
</div>
<section id="panel-observation" class="panel-page" data-panel="observation"></section>
<section id="panel-guide" class="panel-page" data-panel="guide"></section>
```

3. Update `PanelBindingsController`, `UIStateController`, and `ObservationInteractionController` to treat the observation tab as a first-class panel again rather than a partially removed legacy path.

**Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run tests/sidePanel.tabsContract.spec.js tests/toolboxCategoryController.spec.js tests/interaction.panelBindingsController.spec.js tests/observation.runtimeContractGuard.spec.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add index.html css/style.css src/ui/ToolboxCategoryController.js src/ui/interaction/PanelBindingsController.js src/ui/interaction/UIStateController.js src/ui/observation/ObservationInteractionController.js tests/sidePanel.tabsContract.spec.js tests/toolboxCategoryController.spec.js tests/interaction.panelBindingsController.spec.js tests/observation.runtimeContractGuard.spec.js
git commit -m "feat: restore experiment panel tabs and component tray"
```

---

### Task 5: Upgrade chart windows into experiment record surfaces

**Files:**
- Modify: `css/style.css:590-910`
- Modify: `src/ui/charts/ChartWindowController.js`
- Modify: `src/ui/charts/ChartWindowCanvasView.js`
- Modify: `src/ui/charts/ChartWindowBindingController.js`
- Test: `tests/chartWindowController.spec.js`
- Create: `tests/chartWindow.designContract.spec.js`

**Step 1: Write the failing test**

Create `tests/chartWindow.designContract.spec.js` to assert chart windows expose the new sections and terminology.

```js
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('chart window design contract', () => {
    it('defines experiment record header and channel section styles', () => {
        const css = readFileSync('css/style.css', 'utf8');
        expect(css).toContain('.chart-window-record-header');
        expect(css).toContain('.chart-window-readout');
        expect(css).toContain('.chart-window-channel-list');
    });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run tests/chartWindow.designContract.spec.js tests/chartWindowController.spec.js
```

Expected: FAIL because the new class names and structure do not exist

**Step 3: Write minimal implementation**

Refactor chart window DOM generation so the window reads like a recordable experiment card:

```js
header.className = 'chart-window-header chart-window-record-header';
readout.className = 'chart-window-readout';
legend.className = 'chart-window-legend chart-window-channel-list';
```

Update CSS so active charts feel like the active measurement surface, with clearer hierarchy between title, current readout, controls, and channel list.

**Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run tests/chartWindow.designContract.spec.js tests/chartWindowController.spec.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add css/style.css src/ui/charts/ChartWindowController.js src/ui/charts/ChartWindowCanvasView.js src/ui/charts/ChartWindowBindingController.js tests/chartWindow.designContract.spec.js tests/chartWindowController.spec.js
git commit -m "feat: redesign chart windows as experiment record surfaces"
```

---

### Task 6: Unify AI assistant and exercise board under the same surface language

**Files:**
- Modify: `index.html:360-470`
- Modify: `css/style.css:3193-3475`
- Modify: `css/style.css:3575-4424`
- Modify: `src/ui/AIPanel.js`
- Modify: `src/ui/ai/PanelLayoutController.js`
- Modify: `src/ui/ExerciseBoard.js`
- Test: `tests/aiPanel.initializeUI.spec.js`
- Test: `tests/aiPanel.layout.spec.js`
- Test: `tests/mobileRestoreAiFlow.spec.js`
- Create: `tests/assistantSurface.contract.spec.js`

**Step 1: Write the failing test**

Create `tests/assistantSurface.contract.spec.js`:

```js
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('assistant surface contract', () => {
    it('uses experiment assistant naming and guide surface hooks', () => {
        const html = readFileSync('index.html', 'utf8');
        expect(html).toContain('实验助手');
        expect(html).toContain('id="panel-guide"');
        expect(html).toContain('id="exercise-board-panel"');
    });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run tests/assistantSurface.contract.spec.js tests/aiPanel.initializeUI.spec.js tests/aiPanel.layout.spec.js tests/mobileRestoreAiFlow.spec.js
```

Expected: FAIL because naming and surface integration are not yet aligned

**Step 3: Write minimal implementation**

1. Recast `AI 助手` as `实验助手` in UI copy.
2. Update AI panel chrome so its header, buttons, and body use the same semantic surface tokens as the chart and side panel.
3. Update `ExerciseBoard` header and settings strip to feel like a classroom note surface, not a detached editor utility.
4. Keep behavior stable; this slice is primarily visual and structural.

Representative HTML copy change:

```html
<h3>实验助手</h3>
```

Representative CSS direction:

```css
#ai-assistant-panel,
#exercise-board-panel {
    background: var(--surface-elevated);
    border: 1px solid var(--stroke-soft);
}
```

**Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run tests/assistantSurface.contract.spec.js tests/aiPanel.initializeUI.spec.js tests/aiPanel.layout.spec.js tests/mobileRestoreAiFlow.spec.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add index.html css/style.css src/ui/AIPanel.js src/ui/ai/PanelLayoutController.js src/ui/ExerciseBoard.js tests/assistantSurface.contract.spec.js tests/aiPanel.initializeUI.spec.js tests/aiPanel.layout.spec.js tests/mobileRestoreAiFlow.spec.js
git commit -m "feat: unify assistant and exercise surfaces"
```

---

### Task 7: Polish mobile workbench compression and finish with full verification

**Files:**
- Modify: `css/style.css:2454-2779`
- Modify: `src/ui/ResponsiveLayoutController.js`
- Modify: `src/ui/TopActionMenuController.js`
- Test: `tests/responsiveLayoutController.spec.js`
- Test: `tests/mobileCss.touchTargets.spec.js`
- Test: `tests/topActionMenuController.spec.js`
- Test: `tests/quickActionBarController.spec.js`
- Test: `tests/e2e.responsiveTouchHitBudgetContract.spec.js`

**Step 1: Write the failing test**

Extend or add assertions in `tests/mobileCss.touchTargets.spec.js` so phone-mode controls remain 44px+ after the visual refresh and drawer composition changes.

```js
expect(css).toMatch(/body\\.layout-mode-phone .*min-height:\\s*44px/);
```

**Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run tests/responsiveLayoutController.spec.js tests/mobileCss.touchTargets.spec.js tests/topActionMenuController.spec.js tests/quickActionBarController.spec.js tests/e2e.responsiveTouchHitBudgetContract.spec.js
```

Expected: FAIL if mobile hit targets or drawer-state assumptions are broken by the redesign work

**Step 3: Write minimal implementation**

Polish phone mode only after desktop surfaces are stable:

- tighten the top bar grouping
- simplify drawer header density
- ensure AI-open and keyboard-open states still suppress conflicting bottom controls
- preserve the current swipe / close behavior in `ResponsiveLayoutController`

Do not redesign mobile interaction model in this task; only compress, align, and restyle it.

**Step 4: Run targeted tests**

Run:

```bash
npx vitest run tests/responsiveLayoutController.spec.js tests/mobileCss.touchTargets.spec.js tests/topActionMenuController.spec.js tests/quickActionBarController.spec.js tests/e2e.responsiveTouchHitBudgetContract.spec.js
```

Expected: PASS

**Step 5: Run full verification**

Run:

```bash
npm run check:full
```

Expected: PASS, including Vitest, responsive E2E, observation E2E, AI mobile E2E, and baseline checks

**Step 6: Commit**

```bash
git add css/style.css src/ui/ResponsiveLayoutController.js src/ui/TopActionMenuController.js tests/responsiveLayoutController.spec.js tests/mobileCss.touchTargets.spec.js tests/topActionMenuController.spec.js tests/quickActionBarController.spec.js tests/e2e.responsiveTouchHitBudgetContract.spec.js
git commit -m "feat: polish mobile workbench redesign"
```

---

## Final verification checklist

Before marking the redesign complete, verify all of the following in the redesign worktree:

```bash
npx vitest run tests/ui.designTokens.spec.js
npx vitest run tests/workbench.topBarContract.spec.js
npx vitest run tests/workbench.emptyState.spec.js
npx vitest run tests/sidePanel.tabsContract.spec.js
npx vitest run tests/chartWindow.designContract.spec.js
npx vitest run tests/assistantSurface.contract.spec.js
npm run check:full
```

Expected:

- all new UI contract tests pass
- all existing related controller tests pass
- responsive/mobile/e2e regressions stay green
- no legacy panel drift remains in `index.html`

---

## Commit order

1. `feat: add lab bench design tokens`
2. `feat: redesign top workbench bar and status ribbon`
3. `feat: add guided workbench empty state`
4. `feat: restore experiment panel tabs and component tray`
5. `feat: redesign chart windows as experiment record surfaces`
6. `feat: unify assistant and exercise surfaces`
7. `feat: polish mobile workbench redesign`

---

## Notes for execution

- Keep the redesign additive and reversible until Task 4 lands; that is the point where the new IA becomes coherent.
- Do not try to redesign every surface at once. The order above is intentional: system → shell → empty state → IA → charts → assistant surfaces → mobile polish.
- If any existing test reveals hidden coupling between old panel structure and new tabs, fix the structure drift first and delay purely visual refinements.
