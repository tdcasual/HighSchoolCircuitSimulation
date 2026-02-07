# Interaction Modularization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 `Interaction.js` 的指针/手势与视图变换职责拆分为独立模块，同时保持现有交互行为不变。

**Architecture:** 保留 `InteractionManager` facade，只做委托；新增 `PointerSessionManager` 与 `ViewportController` 作为可单测子模块。通过“先失败测试，再最小实现，再回归验证”的 TDD 循环逐步迁移，确保行为兼容。

**Tech Stack:** Vanilla JS (ES Modules), Vitest, SVG DOM APIs

---

### Task 1: Extract Pointer Session Manager

**Files:**
- Create: `src/ui/interaction/PointerSessionManager.js`
- Modify: `src/ui/Interaction.js`
- Test: `tests/interaction.pointerSessionManager.spec.js`

**Step 1: Write the failing test**

Add test cases for:
- `onPointerDown` forwards primary pointer to `onMouseDown`.
- second non-mouse pointer triggers pinch start path.
- `updatePinchGesture` updates `scale` and `viewOffset` from two active pointers.

**Step 2: Run tests to verify failure**

Run:
```bash
npm test -- tests/interaction.pointerSessionManager.spec.js
```
Expected: FAIL (missing module or missing behavior).

**Step 3: Implement minimal extraction**

- Move pointer-related methods from `InteractionManager` to `PointerSessionManager.js`.
- In `Interaction.js`, import pointer module and keep wrapper methods delegating with `call(this, ...)`.
- Do not change external APIs or behavior.

**Step 4: Run tests**

Run:
```bash
npm test -- tests/interaction.pointerSessionManager.spec.js tests/interaction.wireSegmentSnap.spec.js
```
Expected: PASS.

**Step 5: Commit**

```bash
git add src/ui/interaction/PointerSessionManager.js src/ui/Interaction.js tests/interaction.pointerSessionManager.spec.js
git commit -m "refactor(interaction): extract pointer session manager"
```

### Task 2: Extract Viewport Controller

**Files:**
- Create: `src/ui/interaction/ViewportController.js`
- Modify: `src/ui/Interaction.js`
- Test: `tests/interaction.viewportController.spec.js`

**Step 1: Write the failing test**

Add test cases for:
- `screenToCanvas` conversion with non-default scale/offset.
- `updateViewTransform` writes transform to layers and zoom label.
- `resetView` centers circuit bounds and resets scale.

**Step 2: Run tests to verify failure**

Run:
```bash
npm test -- tests/interaction.viewportController.spec.js
```
Expected: FAIL.

**Step 3: Implement minimal extraction**

- Move viewport methods (`screenToCanvas`, `startPanning`, `updateViewTransform`, `resetView`, `getCircuitBounds`, `onWheel`) into controller module.
- Keep `Interaction.js` wrappers delegating to controller.

**Step 4: Run tests**

Run:
```bash
npm test -- tests/interaction.viewportController.spec.js tests/canvasCoords.normalization.spec.js
```
Expected: PASS.

**Step 5: Commit**

```bash
git add src/ui/interaction/ViewportController.js src/ui/Interaction.js tests/interaction.viewportController.spec.js
git commit -m "refactor(interaction): extract viewport controller"
```

### Task 3: Integration Verification

**Files:**
- Modify: none (verification only)

**Step 1: Run full suite**

```bash
npm test
```
Expected: PASS.

**Step 2: Run baseline regressions**

```bash
npm run baseline:p0
npm run baseline:circuitjs
npm run baseline:ai
```
Expected: PASS.

**Step 3: Commit final verification marker (optional)**

```bash
git commit --allow-empty -m "chore: verify interaction modularization phase1"
```
