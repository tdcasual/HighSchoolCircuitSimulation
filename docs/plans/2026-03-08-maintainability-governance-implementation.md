# Maintainability Governance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a maintainability governance program that restores green structural health, extracts misplaced shared infrastructure, decomposes hotspot files, and locks the gains with CI-enforced contracts.

**Architecture:** Keep public behavior stable while continuing the repo’s existing facade-and-service refactor strategy. Move cross-cutting capabilities into `src/utils`, shrink large façade/controller files by extracting narrow services/controllers, and add a single `check:maintainability` contract that summarizes lint, budget, shim, and hotspot health.

**Tech Stack:** Node.js 20, ESM JavaScript, Vitest, ESLint with `eslint-plugin-boundaries`, esbuild, Playwright E2E, repo-local CI guard scripts.

---

### Task 0: Establish the maintainability contract

**Files:**
- Create: `scripts/ci/assert-maintainability-budget.mjs`
- Create: `tests/maintainabilityBudget.spec.js`
- Modify: `scripts/ci/generate-debt-dashboard.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `docs/reports/debt-dashboard-readme.md`

**Step 1: Write the failing contract test**

Create `tests/maintainabilityBudget.spec.js` with assertions that:

- `package.json` exposes `check:maintainability`
- `.github/workflows/ci.yml` runs that command in `quality`
- `scripts/ci/assert-maintainability-budget.mjs` exists

Run: `npx vitest run tests/maintainabilityBudget.spec.js -v`  
Expected: FAIL because the new command/script are not wired yet.

**Step 2: Extend the dashboard schema first**

Modify `scripts/ci/generate-debt-dashboard.mjs` so the JSON report includes at least:

- `lint.boundaryErrors`
- `lint.protectedWarnings`
- `hotspots` with file path, current lines, budget, status
- `shimInventory.count`
- `bundle.mainKiB`

Run: `npm run report:debt-dashboard`  
Expected: PASS and `docs/reports/debt-dashboard.json` contains the new fields.

**Step 3: Add a monitor-mode maintainability guard**

Implement `scripts/ci/assert-maintainability-budget.mjs` to read the dashboard JSON and fail only on obvious regressions:

- missing metrics
- missing required hotspot entries
- missing lint/bundle/shim fields

Do **not** enforce final hard thresholds in this task; keep it in monitor mode so the repo can adopt the contract before the refactors land.

Run: `node scripts/ci/assert-maintainability-budget.mjs`  
Expected: PASS with a monitor-style summary.

**Step 4: Wire the contract into scripts and CI**

Modify `package.json` and `.github/workflows/ci.yml` to add `check:maintainability` before the full `check` pipeline.

Run:

- `npx vitest run tests/maintainabilityBudget.spec.js -v`
- `npm run check:maintainability`

Expected: both PASS.

**Step 5: Document the contract**

Update `docs/reports/debt-dashboard-readme.md` to explain the new metrics and the difference between monitor mode and hard-fail mode.

Commit:

```bash
git add scripts/ci/assert-maintainability-budget.mjs tests/maintainabilityBudget.spec.js scripts/ci/generate-debt-dashboard.mjs package.json .github/workflows/ci.yml docs/reports/debt-dashboard-readme.md
git commit -m "chore(ci): add maintainability contract monitor"
```

### Task 1: Extract shared storage infrastructure to `utils`

**Files:**
- Create: `src/utils/storage/StorageRegistry.js`
- Create: `src/utils/storage/SafeStorage.js`
- Modify: `src/app/RuntimeStorageRegistry.js`
- Modify: `src/app/AppStorage.js`
- Modify: `src/ai/OpenAIClientV2.js`
- Test: `tests/app.storage.spec.js`
- Test: `tests/aiClient.storage.spec.js`
- Test: `tests/openaiClient.spec.js`

**Step 1: Write failing seam tests**

Add/extend tests to assert:

- the storage registry is importable from `src/utils/storage/StorageRegistry.js`
- `OpenAIClientV2` can load/save config without importing `src/app/*`
- `src/app/AppStorage.js` and `src/app/RuntimeStorageRegistry.js` continue to behave as compatibility entrypoints

Run:

`npx vitest run tests/app.storage.spec.js tests/aiClient.storage.spec.js tests/openaiClient.spec.js -v`

Expected: FAIL on missing utils-level storage entrypoints.

**Step 2: Create the new shared storage modules**

Move the canonical implementation into:

- `src/utils/storage/StorageRegistry.js`
- `src/utils/storage/SafeStorage.js`

Keep the API shape close to existing `RuntimeStorageEntries` and `safeGetStorageItem` helpers.

**Step 3: Convert legacy app modules into short re-exports**

Make `src/app/RuntimeStorageRegistry.js` and `src/app/AppStorage.js` thin compatibility wrappers that re-export from `src/utils/storage/*`.

**Step 4: Switch AI to the new seam**

Modify `src/ai/OpenAIClientV2.js` to import only from `src/utils/storage/*`.

Run:

- `npx vitest run tests/app.storage.spec.js tests/aiClient.storage.spec.js tests/openaiClient.spec.js -v`
- `npm run lint`

Expected: tests PASS; the `ai -> app` boundary errors are removed.

**Step 5: Commit**

```bash
git add src/utils/storage/StorageRegistry.js src/utils/storage/SafeStorage.js src/app/RuntimeStorageRegistry.js src/app/AppStorage.js src/ai/OpenAIClientV2.js tests/app.storage.spec.js tests/aiClient.storage.spec.js tests/openaiClient.spec.js
git commit -m "refactor(storage): move shared storage seam to utils"
```

### Task 2: Extract shared entity ID infrastructure to `utils`

**Files:**
- Create: `src/utils/id/EntityIdCounter.js`
- Modify: `src/components/factory/ComponentFactory.js`
- Modify: `src/components/Component.js`
- Modify: `src/app/RuntimeActionRouter.js`
- Modify: `src/ui/interaction/HistoryManager.js`
- Test: `tests/component.factory.spec.js`
- Test: `tests/runtimeActionRouter.spec.js`
- Test: `tests/interaction.historyManager.spec.js`

**Step 1: Write failing tests around the shared seam**

Add/extend tests to assert:

- the ID counter can be reset and updated from a utils-level module
- `RuntimeActionRouter` uses an injected/shared ID updater instead of importing from `components`
- `HistoryManager` restores state without reaching into `components`

Run:

`npx vitest run tests/component.factory.spec.js tests/runtimeActionRouter.spec.js tests/interaction.historyManager.spec.js -v`

Expected: FAIL on missing `src/utils/id/EntityIdCounter.js` usage.

**Step 2: Create the canonical counter module**

Implement `generateEntityId`, `resetEntityIdCounter`, and `updateEntityIdCounterFromExisting` in `src/utils/id/EntityIdCounter.js`.

**Step 3: Make components consume the shared seam**

Refactor `src/components/factory/ComponentFactory.js` to use the utils-level counter while keeping the existing exported API stable.

**Step 4: Remove cross-layer imports**

Update `src/app/RuntimeActionRouter.js` and `src/ui/interaction/HistoryManager.js` to import the counter from `src/utils/id/EntityIdCounter.js`.

Run:

- `npx vitest run tests/component.factory.spec.js tests/runtimeActionRouter.spec.js tests/interaction.historyManager.spec.js -v`
- `npm run lint`

Expected: PASS, and the `app/ui -> components` boundary violations disappear.

**Step 5: Commit**

```bash
git add src/utils/id/EntityIdCounter.js src/components/factory/ComponentFactory.js src/components/Component.js src/app/RuntimeActionRouter.js src/ui/interaction/HistoryManager.js tests/component.factory.spec.js tests/runtimeActionRouter.spec.js tests/interaction.historyManager.spec.js
git commit -m "refactor(ids): extract shared entity id counter"
```

### Task 3: Decompose `ChartWindowController`

**Files:**
- Create: `src/ui/charts/ChartWindowPointerController.js`
- Create: `src/ui/charts/ChartWindowBindingController.js`
- Create: `src/ui/charts/ChartWindowCanvasView.js`
- Modify: `src/ui/charts/ChartWindowController.js`
- Test: `tests/chartWindowController.spec.js`
- Create: `tests/chartWindowPointerController.spec.js`
- Create: `tests/chartWindowBindingController.spec.js`

**Step 1: Write failing delegation tests**

Add tests that prove:

- pointer drag/resize flows are delegated from `ChartWindowController` to a pointer controller
- source/quantity/series mutations are delegated to a binding controller
- render/resize work is delegated to a canvas view

Run:

`npx vitest run tests/chartWindowController.spec.js tests/chartWindowPointerController.spec.js tests/chartWindowBindingController.spec.js -v`

Expected: FAIL because the subcontrollers do not exist yet.

**Step 2: Extract pointer/session logic first**

Move `onHeaderPointerDown`, resize-handle start, pointer move/up, and global listener cleanup into `ChartWindowPointerController`.

**Step 3: Extract binding/state-edit logic**

Move `onAxisSourceChange`, `onAxisQuantityChange`, `refreshSourceOptions`, `rebuildSeriesControls`, and legend/binding meaning helpers into `ChartWindowBindingController`.

**Step 4: Extract view/render logic**

Move canvas resize, dirty tracking, latest text updates, and render orchestration into `ChartWindowCanvasView`.

**Step 5: Verify size and behavior**

Run:

- `npx vitest run tests/chartWindowController.spec.js tests/chartWindowPointerController.spec.js tests/chartWindowBindingController.spec.js -v`
- `npm run check:core-size`

Expected: PASS and `src/ui/charts/ChartWindowController.js` is below the tightened target (`< 450` lines).

**Step 6: Commit**

```bash
git add src/ui/charts/ChartWindowPointerController.js src/ui/charts/ChartWindowBindingController.js src/ui/charts/ChartWindowCanvasView.js src/ui/charts/ChartWindowController.js tests/chartWindowController.spec.js tests/chartWindowPointerController.spec.js tests/chartWindowBindingController.spec.js
git commit -m "refactor(charts): decompose chart window controller"
```

### Task 4: Reduce `Circuit` to a true runtime façade

**Files:**
- Create: `src/core/services/CircuitTopologyValidationService.js`
- Create: `src/core/services/CircuitFlowAnalysisService.js`
- Create: `src/core/services/CircuitObservationProbeService.js`
- Modify: `src/core/runtime/Circuit.js`
- Modify: `src/core/runtime/CircuitShortCircuitDiagnosticsService.js`
- Test: `tests/circuit.topologyService.spec.js`
- Test: `tests/circuit.observationProbes.spec.js`
- Test: `tests/wireShortCircuit.spec.js`
- Create: `tests/circuit.flowAnalysisService.spec.js`

**Step 1: Write failing service tests**

Create tests for:

- topology validation (`conflicting ideal sources`, `floating subcircuit`, `capacitor loop without resistance`)
- flow analysis (`wire current cache`, `terminal flow direction`, `node flow aggregation`)
- observation probe operations (`add/remove/remap/unique id`)

Run:

`npx vitest run tests/circuit.topologyService.spec.js tests/circuit.observationProbes.spec.js tests/wireShortCircuit.spec.js tests/circuit.flowAnalysisService.spec.js -v`

Expected: FAIL on the new service entrypoints.

**Step 2: Extract topology validation**

Move `detectConflictingIdealSources`, `detectCapacitorLoopWithoutResistance`, `detectFloatingSubcircuitWarnings`, and `validateSimulationTopology` into `CircuitTopologyValidationService`.

**Step 3: Extract flow analysis**

Move `getTerminalCurrentFlow`, per-component terminal flow helpers, wire-flow cache build/read, and node-flow helpers into `CircuitFlowAnalysisService`.

**Step 4: Extract observation probe management**

Move unique probe ID generation, probe normalization, CRUD, and wire-remap logic into `CircuitObservationProbeService`.

**Step 5: Rewire `Circuit` as composition root**

Inject/create these services in `src/core/runtime/Circuit.js` and keep the public façade API stable by delegating.

Run:

- `npx vitest run tests/circuit.topologyService.spec.js tests/circuit.observationProbes.spec.js tests/wireShortCircuit.spec.js tests/circuit.flowAnalysisService.spec.js -v`
- `npm run test:reliability`
- `npm run check:core-size`

Expected: PASS and `src/core/runtime/Circuit.js` drops below the interim target (`< 1600`), then the final target (`< 1400`) in a follow-up tightening commit.

**Step 6: Commit**

```bash
git add src/core/services/CircuitTopologyValidationService.js src/core/services/CircuitFlowAnalysisService.js src/core/services/CircuitObservationProbeService.js src/core/runtime/Circuit.js src/core/runtime/CircuitShortCircuitDiagnosticsService.js tests/circuit.topologyService.spec.js tests/circuit.observationProbes.spec.js tests/wireShortCircuit.spec.js tests/circuit.flowAnalysisService.spec.js
git commit -m "refactor(circuit): shrink runtime facade via services"
```

### Task 5: Decompose `MNASolver` into orchestration plus internals

**Files:**
- Create: `src/core/simulation/SolverMatrixAssembler.js`
- Create: `src/core/simulation/SolverConvergenceController.js`
- Modify: `src/core/simulation/MNASolver.js`
- Test: `tests/solver.commonCases.spec.js`
- Test: `tests/solver.dynamicIntegration.spec.js`
- Test: `tests/solver.parity.spec.js`
- Test: `tests/simulation.stampDispatcher.spec.js`
- Test: `tests/simulation.resultPostprocessor.spec.js`

**Step 1: Write failing solver-slice tests**

Add/extend tests to verify:

- matrix assembly can be exercised independently from `MNASolver`
- convergence metadata and invalid-result shaping are produced through a controller seam
- existing parity/common-case/dynamic suites still pass with the new structure

Run:

`npx vitest run tests/solver.commonCases.spec.js tests/solver.dynamicIntegration.spec.js tests/solver.parity.spec.js tests/simulation.stampDispatcher.spec.js tests/simulation.resultPostprocessor.spec.js -v`

Expected: FAIL on missing assembler/controller seams.

**Step 2: Extract matrix assembly**

Move matrix/vector creation, component stamping orchestration, and voltage-source indexing into `SolverMatrixAssembler.js`.

**Step 3: Extract convergence/error shaping**

Move iteration bookkeeping, convergence metadata, singular/invalid solve shaping, and diagnostics-related result normalization into `SolverConvergenceController.js`.

**Step 4: Reduce `MNASolver` to orchestration**

Keep `MNASolver` responsible for public API, solve sequencing, state ownership, and collaboration between assembler / dispatcher / integrator / postprocessor.

Run:

- `npx vitest run tests/solver.commonCases.spec.js tests/solver.dynamicIntegration.spec.js tests/solver.parity.spec.js tests/simulation.stampDispatcher.spec.js tests/simulation.resultPostprocessor.spec.js -v`
- `npm run baseline:p0`
- `npm run baseline:circuitjs`

Expected: PASS with no numerical drift.

**Step 5: Commit**

```bash
git add src/core/simulation/SolverMatrixAssembler.js src/core/simulation/SolverConvergenceController.js src/core/simulation/MNASolver.js tests/solver.commonCases.spec.js tests/solver.dynamicIntegration.spec.js tests/solver.parity.spec.js tests/simulation.stampDispatcher.spec.js tests/simulation.resultPostprocessor.spec.js
git commit -m "refactor(simulation): decompose mna solver internals"
```

### Task 6: Tighten budgets and make maintainability a hard gate

**Files:**
- Modify: `scripts/ci/assert-core-file-size-budget.mjs`
- Modify: `scripts/ci/assert-bundle-size-budget.mjs`
- Modify: `scripts/ci/assert-maintainability-budget.mjs`
- Modify: `scripts/ci/generate-debt-dashboard.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `tests/bundleSizeBudget.spec.js`
- Modify: `tests/ci.v2CoreSizeBudget.spec.js`
- Modify: `tests/debtDashboard.spec.js`
- Modify: `tests/maintainabilityBudget.spec.js`

**Step 1: Write the failing threshold tests**

Extend tests to assert:

- `MNASolver.js` and `AppRuntimeV2.js` appear in hotspot budgets
- `check:maintainability` is part of `check`
- the maintainability guard now fails on hard violations, not only missing metrics

Run:

`npx vitest run tests/bundleSizeBudget.spec.js tests/ci.v2CoreSizeBudget.spec.js tests/debtDashboard.spec.js tests/maintainabilityBudget.spec.js -v`

Expected: FAIL until thresholds and wiring are updated.

**Step 2: Tighten file budgets**

Update `scripts/ci/assert-core-file-size-budget.mjs` so the hot files use explicit post-refactor targets:

- `src/ui/charts/ChartWindowController.js < 450`
- `src/core/runtime/Circuit.js < 1400`
- `src/core/simulation/MNASolver.js < 650`
- `src/app/AppRuntimeV2.js < 500`

**Step 3: Tighten bundle policy in two levels**

Update `scripts/ci/assert-bundle-size-budget.mjs` and dashboard reporting so:

- hard budget = `<= 400 KiB`
- target budget = `<= 360 KiB`

The hard budget fails CI; the target budget shows warning until a later optimization pass closes it.

**Step 4: Switch maintainability guard to hard-fail mode**

Update `scripts/ci/assert-maintainability-budget.mjs` to fail on:

- any lint errors
- any protected warning count > 0
- any hotspot hard-fail status
- any bundle hard-fail status
- shim inventory growth

Run:

- `npm run check:maintainability`
- `npm run check`

Expected: PASS.

**Step 5: Commit**

```bash
git add scripts/ci/assert-core-file-size-budget.mjs scripts/ci/assert-bundle-size-budget.mjs scripts/ci/assert-maintainability-budget.mjs scripts/ci/generate-debt-dashboard.mjs package.json .github/workflows/ci.yml tests/bundleSizeBudget.spec.js tests/ci.v2CoreSizeBudget.spec.js tests/debtDashboard.spec.js tests/maintainabilityBudget.spec.js
git commit -m "chore(ci): enforce hard maintainability budgets"
```

### Task 7: Remove transitional shims and publish the working agreement

**Files:**
- Modify: `src/app/AppStorage.js`
- Modify: `src/app/RuntimeStorageRegistry.js`
- Modify: `src/components/Component.js`
- Create: `docs/process/maintainability-governance.md`
- Modify: `README.md`
- Modify: `docs/README.md`

**Step 1: Write the failing doc and shim tests**

Add/extend tests that assert:

- the governance doc is linked from `README.md` or `docs/README.md`
- deprecated re-export layers are either removed or explicitly marked `@deprecated`

Run:

`npx vitest run tests/release.docsIntegrity.spec.js tests/agents.doc.spec.js tests/maintainabilityBudget.spec.js -v`

Expected: FAIL until docs and shim policy are updated.

**Step 2: Publish the working agreement**

Create `docs/process/maintainability-governance.md` documenting:

- shared seam placement rules
- hotspot budgets
- shim introduction/removal policy
- required verification commands per refactor slice

**Step 3: Remove or explicitly deprecate compatibility wrappers**

For any remaining wrappers in `src/app/AppStorage.js`, `src/app/RuntimeStorageRegistry.js`, or `src/components/Component.js`, either:

- delete the wrapper and update callers, or
- mark it `@deprecated` with a linked removal issue/phase comment

**Step 4: Update documentation entrypoints**

Link the governance doc from `README.md` and `docs/README.md`.

Run:

- `npm test`
- `npm run check`
- `npm run check:e2e`
- `npm run baseline:p0`
- `npm run baseline:circuitjs`
- `npm run baseline:ai`

Expected: all PASS.

**Step 5: Commit**

```bash
git add src/app/AppStorage.js src/app/RuntimeStorageRegistry.js src/components/Component.js docs/process/maintainability-governance.md README.md docs/README.md
git commit -m "docs(process): publish maintainability working agreement"
```

---

Plan complete and saved to `docs/plans/2026-03-08-maintainability-governance-implementation.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
