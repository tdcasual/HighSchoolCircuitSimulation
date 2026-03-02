# Architecture De-risk (4 Weeks) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce interaction/runtime conflict bugs by 60%+ while keeping current feature scope (mobile + classroom + embed + AI) unchanged.

**Architecture:** Introduce a single interaction-mode state source, consolidate runtime safety calls into one utility layer, then decompose high-churn monolithic modules into focused controllers. Keep behavior stable via fail-first tests and matrix-based regression.

**Tech Stack:** Vanilla JS (ESM), Vitest, Playwright E2E scripts, ESLint boundaries.

---

## Week 1 - State/Boundary Stabilization

### Task 1: Establish conflict baseline and freeze guardrails

**Files:**
- Create: `tests/interaction.modeMatrix.spec.js`
- Modify: `scripts/e2e/wire-interaction-regression.mjs`
- Modify: `scripts/e2e/responsive-touch-regression.mjs`
- Modify: `package.json`

**Step 1: Write the failing test**
```js
it('enforces exclusive interaction mode in phone/classroom/embed combinations', () => {
  // fail first: current code allows conflicting booleans in edge flow
})
```

**Step 2: Run test to verify it fails**
Run: `npm test -- tests/interaction.modeMatrix.spec.js`
Expected: FAIL with mode conflict assertion.

**Step 3: Add minimal implementation hooks (no behavior change yet)**
- Add diagnostic export points (mode snapshot) used by tests and E2E scripts.
- Extend existing E2E scripts to emit mode snapshot in result JSON.

**Step 4: Run targeted checks**
Run: `npm test -- tests/interaction.modeMatrix.spec.js`
Expected: PASS with deterministic snapshot assertions.

**Step 5: Commit**
```bash
git add tests/interaction.modeMatrix.spec.js scripts/e2e/wire-interaction-regression.mjs scripts/e2e/responsive-touch-regression.mjs package.json
git commit -m "test: add mode-matrix baseline and e2e snapshot outputs"
```

### Task 2: Introduce single interaction mode store

**Files:**
- Create: `src/app/interaction/InteractionModeStore.js`
- Modify: `src/app/interaction/InteractionOrchestrator.js`
- Test: `tests/interaction.modeStore.spec.js`

**Step 1: Write the failing test**
```js
it('keeps exactly one active mode and emits transition events', () => {
  // expected: select|wire|endpoint-edit mutually exclusive
})
```

**Step 2: Run test to verify it fails**
Run: `npm test -- tests/interaction.modeStore.spec.js`
Expected: FAIL because store does not exist.

**Step 3: Write minimal implementation**
- Implement mode store with:
  - `getState()`
  - `setMode(mode, context)`
  - `subscribe(listener)`
  - transition validation and no-op duplicate transitions.
- Integrate in orchestrator as source of truth.

**Step 4: Run targeted tests**
Run: `npm test -- tests/interaction.modeStore.spec.js tests/interaction.orchestrator.spec.js`
Expected: PASS and no orchestrator regressions.

**Step 5: Commit**
```bash
git add src/app/interaction/InteractionModeStore.js src/app/interaction/InteractionOrchestrator.js tests/interaction.modeStore.spec.js
git commit -m "feat: add single interaction mode store"
```

### Task 3: Migrate mode consumers to read from store

**Files:**
- Modify: `src/ui/interaction/WireInteractions.js`
- Modify: `src/ui/interaction/PointerSessionManager.js`
- Modify: `src/ui/interaction/UIStateController.js`
- Test: `tests/interaction.pointerSessionManager.spec.js`
- Test: `tests/interaction.uiStateController.spec.js`

**Step 1: Write the failing test**
```js
it('prevents wire+endpoint-edit dual-active state during touch drag', () => {
  // fail first with conflicting mode activation path
})
```

**Step 2: Run test to verify it fails**
Run: `npm test -- tests/interaction.pointerSessionManager.spec.js`
Expected: FAIL on dual-active assertion.

**Step 3: Minimal implementation**
- Replace direct boolean checks with mode store selectors.
- Keep legacy fields as derived/read-only mirrors for compatibility.

**Step 4: Run tests**
Run: `npm test -- tests/interaction.pointerSessionManager.spec.js tests/interaction.uiStateController.spec.js tests/interaction.wireSegmentSnap.spec.js`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/ui/interaction/WireInteractions.js src/ui/interaction/PointerSessionManager.js src/ui/interaction/UIStateController.js tests/interaction.pointerSessionManager.spec.js tests/interaction.uiStateController.spec.js
git commit -m "refactor: consume interaction mode store in touch/wire flows"
```

---

## Week 2 - Runtime Safety Consolidation

### Task 4: Create shared RuntimeSafety utility

**Files:**
- Create: `src/utils/RuntimeSafety.js`
- Test: `tests/runtimeSafety.spec.js`

**Step 1: Write the failing test**
```js
it('safeInvoke returns fallback when target method throws', () => {})
it('safeClassListToggle never throws and returns boolean', () => {})
it('safeEventBind skips invalid targets gracefully', () => {})
```

**Step 2: Run failing tests**
Run: `npm test -- tests/runtimeSafety.spec.js`
Expected: FAIL (module missing).

**Step 3: Minimal implementation**
- Provide primitives:
  - `safeInvoke`
  - `safeSetAttribute`
  - `safeClassListAdd/Remove/Toggle`
  - `safeAddEventListener/safeRemoveEventListener`
  - `safeFocus`

**Step 4: Verify**
Run: `npm test -- tests/runtimeSafety.spec.js`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/utils/RuntimeSafety.js tests/runtimeSafety.spec.js
git commit -m "feat: add shared runtime safety utility"
```

### Task 5: Migrate duplicated local safe helpers to shared module

**Files:**
- Modify: `src/ui/AIPanel.js`
- Modify: `src/ui/ai/ChatController.js`
- Modify: `src/ui/ExerciseBoard.js`
- Modify: `src/embed/EmbedClient.js`
- Modify: `src/embed/EmbedRuntimeBridge.js`
- Test: `tests/aiPanel.chat.spec.js`
- Test: `tests/aiPanel.chatController.spec.js`
- Test: `tests/exerciseBoard.spec.js`
- Test: `tests/embedClient.spec.js`
- Test: `tests/embedRuntimeBridge.spec.js`

**Step 1: Write failing tests for one migrated case**
- Add one new failure case in each module-specific test where local helper removal would crash.

**Step 2: Run tests (fail first)**
Run: `npm test -- tests/aiPanel.chat.spec.js tests/aiPanel.chatController.spec.js tests/exerciseBoard.spec.js tests/embedClient.spec.js tests/embedRuntimeBridge.spec.js`
Expected: FAIL in newly added cases.

**Step 3: Minimal migration**
- Replace local wrappers with imports from `RuntimeSafety`.
- Keep function names consistent at call sites for low-risk diff.

**Step 4: Verify targeted suite**
Run same command as Step 2.
Expected: PASS.

**Step 5: Commit**
```bash
git add src/ui/AIPanel.js src/ui/ai/ChatController.js src/ui/ExerciseBoard.js src/embed/EmbedClient.js src/embed/EmbedRuntimeBridge.js tests/aiPanel.chat.spec.js tests/aiPanel.chatController.spec.js tests/exerciseBoard.spec.js tests/embedClient.spec.js tests/embedRuntimeBridge.spec.js
git commit -m "refactor: centralize runtime safety helpers"
```

### Task 6: Add lint guard for unsafe direct DOM calls in UI layer

**Files:**
- Modify: `.eslintrc.js`
- Create: `tests/lint.runtimeSafetyGuard.spec.js`

**Step 1: Write failing guard test**
```js
it('fails when ui files call addEventListener directly without RuntimeSafety', () => {})
```

**Step 2: Run test to fail**
Run: `npm test -- tests/lint.runtimeSafetyGuard.spec.js`
Expected: FAIL until lint rule configured.

**Step 3: Minimal implementation**
- Add restricted syntax/import rule targeting UI folders.
- Allow explicit exemptions (`main.js`, known safe wrapped modules).

**Step 4: Verify**
Run: `npm test -- tests/lint.runtimeSafetyGuard.spec.js && npm run lint`
Expected: PASS.

**Step 5: Commit**
```bash
git add .eslintrc.js tests/lint.runtimeSafetyGuard.spec.js
git commit -m "chore: enforce runtime safety lint guard in ui layer"
```

---

## Week 3 - Monolith Decomposition (High-churn Modules)

### Task 7: Split ObservationPanel into controllers

**Files:**
- Create: `src/ui/observation/ObservationLayoutController.js`
- Create: `src/ui/observation/ObservationInteractionController.js`
- Create: `src/ui/observation/ObservationRenderController.js`
- Modify: `src/ui/ObservationPanel.js`
- Test: `tests/observationPanel.layoutSafety.spec.js`
- Test: `tests/observationPanel.renderLifecycle.spec.js`
- Test: `tests/observationPanel.activity.spec.js`

**Step 1: Write failing integration contract tests**
- Ensure panel API remains unchanged (`initializeUI`, `refresh`, `dispose` behavior).

**Step 2: Run tests to fail**
Run: `npm test -- tests/observationPanel.layoutSafety.spec.js tests/observationPanel.renderLifecycle.spec.js`
Expected: FAIL after temporary extraction stubs.

**Step 3: Minimal extraction**
- Move pure layout/gesture/render branches into dedicated controllers.
- Keep old public method signatures in `ObservationPanel` facade.

**Step 4: Verify**
Run: `npm test -- tests/observationPanel.layoutSafety.spec.js tests/observationPanel.renderLifecycle.spec.js tests/observationPanel.activity.spec.js`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/ui/ObservationPanel.js src/ui/observation/ObservationLayoutController.js src/ui/observation/ObservationInteractionController.js src/ui/observation/ObservationRenderController.js tests/observationPanel.layoutSafety.spec.js tests/observationPanel.renderLifecycle.spec.js tests/observationPanel.activity.spec.js
git commit -m "refactor: split ObservationPanel into focused controllers"
```

### Task 8: Split Component runtime-update path from shape creation path

**Files:**
- Create: `src/components/render/ComponentShapeFactory.js`
- Create: `src/components/render/ComponentVisualUpdater.js`
- Modify: `src/components/Component.js`
- Test: `tests/component.touchTargets.spec.js`
- Test: `tests/component.renderSafety.spec.js`
- Test: `tests/renderer.valueSnapshot.spec.js`

**Step 1: Write failing tests for update-only import path**
- Assert updater can run without constructing full shape set.

**Step 2: Run failing tests**
Run: `npm test -- tests/component.renderSafety.spec.js`
Expected: FAIL until extraction.

**Step 3: Minimal extraction**
- Move runtime update methods (value display, visual state sync) to updater module.
- Keep exported API shape backward compatible.

**Step 4: Verify targeted tests**
Run: `npm test -- tests/component.touchTargets.spec.js tests/component.renderSafety.spec.js tests/renderer.valueSnapshot.spec.js`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/components/Component.js src/components/render/ComponentShapeFactory.js src/components/render/ComponentVisualUpdater.js tests/component.touchTargets.spec.js tests/component.renderSafety.spec.js tests/renderer.valueSnapshot.spec.js
git commit -m "refactor: separate component shape creation from runtime updates"
```

### Task 9: De-risk Circuit side-effect zones

**Files:**
- Modify: `src/engine/Circuit.js`
- Create: `src/engine/runtime/CircuitPersistenceAdapter.js`
- Create: `src/engine/runtime/CircuitDiagnosticsAdapter.js`
- Test: `tests/circuit.runtimeDiagnostics.spec.js`
- Test: `tests/app.storage.spec.js`

**Step 1: Write failing tests around adapters**
- Assert side-effect methods are delegated via adapters.

**Step 2: Run failing tests**
Run: `npm test -- tests/circuit.runtimeDiagnostics.spec.js tests/app.storage.spec.js`
Expected: FAIL before delegation.

**Step 3: Minimal implementation**
- Isolate storage/diagnostics side effects from solver iteration path.
- Ensure solver step remains pure from UI/storage concerns.

**Step 4: Verify**
Run: same tests + `npm test -- tests/solver.commonCases.spec.js`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/engine/Circuit.js src/engine/runtime/CircuitPersistenceAdapter.js src/engine/runtime/CircuitDiagnosticsAdapter.js tests/circuit.runtimeDiagnostics.spec.js tests/app.storage.spec.js
git commit -m "refactor: isolate circuit side effects via runtime adapters"
```

---

## Week 4 - Matrix Regression + Release Gate

### Task 10: Build cross-mode regression matrix test runner

**Files:**
- Create: `scripts/e2e/mode-conflict-matrix.mjs`
- Create: `tests/e2e.modeConflictMatrix.spec.js`
- Modify: `package.json`

**Step 1: Write failing harness expectation test**
```js
it('mode-conflict-matrix script exits non-zero on any conflict', async () => {})
```

**Step 2: Run failing test**
Run: `npm test -- tests/e2e.modeConflictMatrix.spec.js`
Expected: FAIL until script exists.

**Step 3: Minimal implementation**
- Add matrix over dimensions: `pointerType x layoutMode x classroomLevel x embedReadonly`.
- Emit JSON artifact in `output/e2e/mode-conflict`.

**Step 4: Verify**
Run: `npm test -- tests/e2e.modeConflictMatrix.spec.js && node scripts/e2e/mode-conflict-matrix.mjs`
Expected: PASS.

**Step 5: Commit**
```bash
git add scripts/e2e/mode-conflict-matrix.mjs tests/e2e.modeConflictMatrix.spec.js package.json
git commit -m "test: add cross-mode conflict e2e matrix"
```

### Task 11: Add CI hard gate and release checklist

**Files:**
- Modify: `.github/workflows/ci.yml`
- Create: `docs/release/v0.10-stability-checklist.md`
- Test: `tests/ci.workflow.spec.js`

**Step 1: Write failing CI coverage test**
- Extend workflow test to require `test:e2e:wire`, `test:e2e:responsive`, `mode-conflict-matrix`.

**Step 2: Run failing test**
Run: `npm test -- tests/ci.workflow.spec.js`
Expected: FAIL before workflow update.

**Step 3: Minimal implementation**
- Add required CI jobs and artifact upload.
- Add explicit release checklist doc.

**Step 4: Verify**
Run: `npm test -- tests/ci.workflow.spec.js`
Expected: PASS.

**Step 5: Commit**
```bash
git add .github/workflows/ci.yml docs/release/v0.10-stability-checklist.md tests/ci.workflow.spec.js
git commit -m "ci: gate release with mode matrix and e2e checks"
```

### Task 12: Final stabilization sweep and metrics report

**Files:**
- Create: `docs/reports/2026-03-xx-architecture-derisk-report.md`
- Modify: `README.md`

**Step 1: Write failing verification checklist (manual + scripted)**
- Define measurable criteria:
  - 0 known mode conflicts in matrix
  - no direct unsafe DOM calls in guarded folders
  - all baseline tests passing

**Step 2: Run full verification to collect baseline**
Run:
```bash
npm run lint
npm test
npm run test:e2e:wire
npm run test:e2e:responsive
node scripts/e2e/mode-conflict-matrix.mjs
```
Expected: all PASS.

**Step 3: Minimal documentation update**
- Publish before/after metrics and unresolved risks.

**Step 4: Re-run verification**
Run same command bundle.
Expected: all PASS with reproducible output paths.

**Step 5: Commit**
```bash
git add docs/reports/2026-03-xx-architecture-derisk-report.md README.md
git commit -m "docs: publish architecture de-risk outcomes and verification"
```

---

## Weekly Acceptance Criteria

### Week 1 Done When
- Interaction mode is single-source in orchestrator path.
- Added mode-matrix baseline tests with deterministic outputs.

### Week 2 Done When
- Shared `RuntimeSafety` exists and replaces local duplicates in priority modules.
- Lint guard prevents unsafe direct DOM calls in UI layer.

### Week 3 Done When
- `ObservationPanel` and `Component` runtime update responsibilities are split.
- Circuit runtime side effects separated from solver path.

### Week 4 Done When
- CI enforces matrix + existing E2E checks.
- Stability report documents measurable improvement and remaining known risks.

---

## Risks and Backout Strategy

1. **Risk:** Behavior drift while splitting monolith files.
- **Backout:** Keep facade methods and use adapter delegation first; avoid API breaks.

2. **Risk:** Over-refactor slows delivery.
- **Backout:** hard stop after each weekly milestone; do not start next week if acceptance not met.

3. **Risk:** Test runtime cost increases.
- **Backout:** keep matrix test in dedicated CI lane with artifact-only deep diagnostics.

4. **Risk:** Hidden coupling in legacy fields.
- **Backout:** maintain temporary compatibility mirrors with deprecation comments; remove only after 2 green cycles.

---

## Verification Commands (Global)

```bash
npm run lint
npm test
npm run test:e2e:wire
npm run test:e2e:responsive
node scripts/e2e/mode-conflict-matrix.mjs
```

