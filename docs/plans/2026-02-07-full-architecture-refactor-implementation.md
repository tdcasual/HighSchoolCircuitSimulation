# Full Architecture Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor UI, topology, simulation, and IO layers into isolated modules without changing user-visible behavior.

**Architecture:** Keep current facades (`AIPanel`, `Circuit`, `MNASolver`) stable while extracting logic into focused modules. Move one responsibility at a time behind adapter methods, and keep the full test suite green at each task boundary. Enforce TDD and small commits to prevent behavior drift.

**Tech Stack:** Vanilla JS (ES modules), HTML/CSS, Vitest, Node.js 18+, localStorage/sessionStorage

---

## Execution Rules

- Required process skills: `@test-driven-development` `@verification-before-completion` `@systematic-debugging`
- Work in a dedicated worktree before implementation.
- No feature work during this plan.
- Every task must end with a commit.

## Worktree Setup (before Task 1)

### Task 0: Create Freeze Worktree

**Files:**
- Modify: none
- Test: none

**Step 1: Create worktree**

Run:
```bash
git fetch origin
git worktree add ../HighSchoolCircuitSimulation-refactor -b codex/full-architecture-refactor origin/main
```
Expected: new worktree directory is created.

**Step 2: Enter worktree**

Run:
```bash
cd ../HighSchoolCircuitSimulation-refactor
git status -sb
```
Expected: clean working tree on `codex/full-architecture-refactor`.

**Step 3: Baseline verification**

Run:
```bash
npm test
```
Expected: full suite passes.

**Step 4: Commit baseline marker**

```bash
git commit --allow-empty -m "chore: start full architecture refactor freeze"
```

---

### Task 1: Scaffold AI Controller Modules (No Behavior Change)

**Files:**
- Create: `src/ui/ai/ChatController.js`
- Create: `src/ui/ai/SettingsController.js`
- Create: `src/ui/ai/PanelLayoutController.js`
- Modify: `src/ui/AIPanel.js`
- Test: `tests/aiPanel.chatController.spec.js`
- Test: `tests/aiPanel.settingsController.spec.js`
- Test: `tests/aiPanel.layoutController.spec.js`

**Step 1: Write failing controller-construction tests**

```js
import { describe, it, expect } from 'vitest';
import { ChatController } from '../src/ui/ai/ChatController.js';

describe('ChatController', () => {
  it('stores dependency bag', () => {
    const deps = { panel: {}, app: {}, circuit: {} };
    const controller = new ChatController(deps);
    expect(controller.deps).toBe(deps);
  });
});
```

**Step 2: Run tests to verify failure**

Run:
```bash
npm test -- tests/aiPanel.chatController.spec.js tests/aiPanel.settingsController.spec.js tests/aiPanel.layoutController.spec.js
```
Expected: FAIL (module/class missing).

**Step 3: Add minimal controller classes**

```js
export class ChatController {
  constructor(deps = {}) {
    this.deps = deps;
  }
}
```

**Step 4: Wire controller construction in `AIPanel`**

```js
import { ChatController } from './ai/ChatController.js';
import { SettingsController } from './ai/SettingsController.js';
import { PanelLayoutController } from './ai/PanelLayoutController.js';
```
and instantiate in constructor.

**Step 5: Re-run tests**

Run:
```bash
npm test -- tests/aiPanel.chatController.spec.js tests/aiPanel.settingsController.spec.js tests/aiPanel.layoutController.spec.js tests/aiPanel.chat.spec.js tests/aiPanel.layout.spec.js
```
Expected: PASS.

**Step 6: Commit**

```bash
git add src/ui/ai/ChatController.js src/ui/ai/SettingsController.js src/ui/ai/PanelLayoutController.js src/ui/AIPanel.js tests/aiPanel.chatController.spec.js tests/aiPanel.settingsController.spec.js tests/aiPanel.layoutController.spec.js
git commit -m "refactor(ui): scaffold AI panel controllers"
```

---

### Task 2: Extract Chat Logic From `AIPanel`

**Files:**
- Modify: `src/ui/ai/ChatController.js`
- Modify: `src/ui/AIPanel.js`
- Test: `tests/aiPanel.chat.spec.js`
- Test: `tests/aiPanel.chatController.spec.js`

**Step 1: Add failing delegation test**

```js
it('delegates askQuestion to ChatController', async () => {
  const panel = { chatController: { askQuestion: vi.fn().mockResolvedValue(undefined) } };
  await AIPanel.prototype.askQuestion.call(panel, 'q1');
  expect(panel.chatController.askQuestion).toHaveBeenCalledWith('q1');
});
```

**Step 2: Run target tests to see failure**

Run:
```bash
npm test -- tests/aiPanel.chat.spec.js tests/aiPanel.chatController.spec.js
```
Expected: FAIL on delegation assertion.

**Step 3: Move minimal chat methods into `ChatController`**

Move and bind:
- `initializeChat`
- `askQuestion`
- `triggerFollowup`
- message history helpers

Keep signatures unchanged.

**Step 4: Keep `AIPanel` facade methods forwarding calls**

```js
askQuestion(question) {
  return this.chatController.askQuestion(question);
}
```

**Step 5: Run tests**

Run:
```bash
npm test -- tests/aiPanel.chat.spec.js tests/circuitAIAgent.spec.js
```
Expected: PASS.

**Step 6: Commit**

```bash
git add src/ui/ai/ChatController.js src/ui/AIPanel.js tests/aiPanel.chat.spec.js tests/aiPanel.chatController.spec.js
git commit -m "refactor(ui): extract AI chat behavior into ChatController"
```

---

### Task 3: Extract Settings Logic From `AIPanel`

**Files:**
- Modify: `src/ui/ai/SettingsController.js`
- Modify: `src/ui/AIPanel.js`
- Test: `tests/aiPanel.knowledgeVersion.spec.js`
- Test: `tests/aiPanel.modelList.spec.js`
- Test: `tests/aiPanel.settingsController.spec.js`

**Step 1: Add failing settings delegation tests**

```js
it('delegates saveSettings to SettingsController', () => {
  const panel = { settingsController: { saveSettings: vi.fn() } };
  AIPanel.prototype.saveSettings.call(panel);
  expect(panel.settingsController.saveSettings).toHaveBeenCalledTimes(1);
});
```

**Step 2: Run tests to verify failure**

Run:
```bash
npm test -- tests/aiPanel.knowledgeVersion.spec.js tests/aiPanel.modelList.spec.js tests/aiPanel.settingsController.spec.js
```
Expected: FAIL.

**Step 3: Move settings-related methods**

Move into `SettingsController`:
- `initializeSettingsDialog`
- `openSettings`
- `saveSettings`
- `loadSettings`
- `refreshKnowledgeProvider`
- model list helpers

**Step 4: Add facade forwarding in `AIPanel`**

Keep old public method names; forward to controller.

**Step 5: Run tests**

Run:
```bash
npm test -- tests/aiPanel.knowledgeVersion.spec.js tests/aiPanel.modelList.spec.js tests/openaiClient.spec.js
```
Expected: PASS.

**Step 6: Commit**

```bash
git add src/ui/ai/SettingsController.js src/ui/AIPanel.js tests/aiPanel.knowledgeVersion.spec.js tests/aiPanel.modelList.spec.js tests/aiPanel.settingsController.spec.js
git commit -m "refactor(ui): extract AI settings behavior into SettingsController"
```

---

### Task 4: Extract Panel Layout Logic From `AIPanel`

**Files:**
- Modify: `src/ui/ai/PanelLayoutController.js`
- Modify: `src/ui/AIPanel.js`
- Test: `tests/aiPanel.layout.spec.js`
- Test: `tests/aiPanel.layoutController.spec.js`

**Step 1: Add failing layout delegation tests**

```js
it('delegates setPanelCollapsed to PanelLayoutController', () => {
  const panel = { layoutController: { setPanelCollapsed: vi.fn() } };
  AIPanel.prototype.setPanelCollapsed.call(panel, true);
  expect(panel.layoutController.setPanelCollapsed).toHaveBeenCalledWith(true, undefined);
});
```

**Step 2: Run tests to verify failure**

Run:
```bash
npm test -- tests/aiPanel.layout.spec.js tests/aiPanel.layoutController.spec.js
```
Expected: FAIL.

**Step 3: Move layout/drag/resize/idle methods**

Move all panel geometry and pointer handling logic from `AIPanel` to `PanelLayoutController`.

**Step 4: Keep facade wrappers**

`AIPanel` wrappers call `this.layoutController.<method>()`.

**Step 5: Run tests**

Run:
```bash
npm test -- tests/aiPanel.layout.spec.js tests/aiPanel.chat.spec.js
```
Expected: PASS.

**Step 6: Commit**

```bash
git add src/ui/ai/PanelLayoutController.js src/ui/AIPanel.js tests/aiPanel.layout.spec.js tests/aiPanel.layoutController.spec.js
git commit -m "refactor(ui): extract panel layout behavior into PanelLayoutController"
```

---

### Task 5: Extract Node Rebuild Engine

**Files:**
- Create: `src/core/topology/NodeBuilder.js`
- Modify: `src/engine/Circuit.js`
- Test: `tests/topology.nodeBuilder.spec.js`
- Test: `tests/circuit.topologyBatch.spec.js`

**Step 1: Write failing NodeBuilder behavior test**

```js
it('maps connected terminals to same node index', () => {
  const builder = new NodeBuilder();
  const result = builder.build({ components, wires });
  expect(result.componentNodes.get('R1')[0]).toBe(result.componentNodes.get('E1')[1]);
});
```

**Step 2: Run test to verify failure**

Run:
```bash
npm test -- tests/topology.nodeBuilder.spec.js
```
Expected: FAIL.

**Step 3: Implement minimal `NodeBuilder.build()` using moved code**

Move union-find and node assignment logic from `Circuit.rebuildNodes` with no algorithm changes.

**Step 4: Delegate from `Circuit.rebuildNodes()`**

`Circuit` calls `this.nodeBuilder.build(...)` and applies output.

**Step 5: Run tests**

Run:
```bash
npm test -- tests/topology.nodeBuilder.spec.js tests/circuit.topologyBatch.spec.js tests/endpointResolution.spec.js
```
Expected: PASS.

**Step 6: Commit**

```bash
git add src/core/topology/NodeBuilder.js src/engine/Circuit.js tests/topology.nodeBuilder.spec.js tests/circuit.topologyBatch.spec.js
git commit -m "refactor(topology): extract node rebuild logic into NodeBuilder"
```

---

### Task 6: Extract Wire Compaction Service

**Files:**
- Create: `src/core/topology/WireCompactor.js`
- Modify: `src/engine/Circuit.js`
- Test: `tests/topology.wireCompactor.spec.js`
- Test: `tests/circuit.wireCompaction.spec.js`

**Step 1: Write failing wire compaction parity test**

```js
it('merges collinear opposite wire segments', () => {
  const compactor = new WireCompactor();
  const result = compactor.compact({ components, wires });
  expect(result.changed).toBe(true);
  expect(result.removedIds.length).toBe(1);
});
```

**Step 2: Run test to verify failure**

Run:
```bash
npm test -- tests/topology.wireCompactor.spec.js
```
Expected: FAIL.

**Step 3: Move `compactWires` internals into `WireCompactor.compact()`**

Keep return shape unchanged.

**Step 4: Delegate from `Circuit.compactWires()`**

Keep old method signature and output contract.

**Step 5: Run tests**

Run:
```bash
npm test -- tests/topology.wireCompactor.spec.js tests/circuit.wireCompaction.spec.js tests/wireConnection.validation.spec.js
```
Expected: PASS.

**Step 6: Commit**

```bash
git add src/core/topology/WireCompactor.js src/engine/Circuit.js tests/topology.wireCompactor.spec.js tests/circuit.wireCompaction.spec.js
git commit -m "refactor(topology): extract wire compaction service"
```

---

### Task 7: Extract Connectivity Cache Service

**Files:**
- Create: `src/core/topology/ConnectivityCache.js`
- Modify: `src/engine/Circuit.js`
- Test: `tests/topology.connectivityCache.spec.js`
- Test: `tests/circuit.connectivityCache.spec.js`

**Step 1: Write failing cache behavior test**

```js
it('marks component connected when terminal degree > 0', () => {
  const cache = new ConnectivityCache();
  const state = cache.compute({ components, terminalConnectionMap });
  expect(state.isConnected('R1')).toBe(true);
});
```

**Step 2: Run tests to verify failure**

Run:
```bash
npm test -- tests/topology.connectivityCache.spec.js
```
Expected: FAIL.

**Step 3: Move connectivity-state methods from `Circuit`**

Move:
- `computeComponentConnectedState`
- `refreshComponentConnectivityCache`
- `isComponentConnected`

**Step 4: Delegate from `Circuit`**

Maintain existing `Circuit.isComponentConnected(componentId)` API.

**Step 5: Run tests**

Run:
```bash
npm test -- tests/topology.connectivityCache.spec.js tests/circuit.connectivityCache.spec.js
```
Expected: PASS.

**Step 6: Commit**

```bash
git add src/core/topology/ConnectivityCache.js src/engine/Circuit.js tests/topology.connectivityCache.spec.js tests/circuit.connectivityCache.spec.js
git commit -m "refactor(topology): extract connectivity cache service"
```

---

### Task 8: Extract Stamp Dispatcher From Solver

**Files:**
- Create: `src/core/simulation/StampDispatcher.js`
- Modify: `src/engine/Solver.js`
- Test: `tests/simulation.stampDispatcher.spec.js`
- Test: `tests/solver.newComponents.spec.js`

**Step 1: Write failing dispatcher test**

```js
it('routes resistor to stampResistor handler', () => {
  const dispatcher = new StampDispatcher({ stampResistor: vi.fn() });
  dispatcher.stamp(componentResistor, A, z, 10);
  expect(dispatcher.handlers.stampResistor).toHaveBeenCalled();
});
```

**Step 2: Run test to verify failure**

Run:
```bash
npm test -- tests/simulation.stampDispatcher.spec.js
```
Expected: FAIL.

**Step 3: Implement minimal dispatcher and integrate**

Move branching from `stampComponent` into dispatcher map.

**Step 4: Delegate from `Solver.stampComponent()`**

`stampComponent` becomes adapter call to dispatcher.

**Step 5: Run tests**

Run:
```bash
npm test -- tests/simulation.stampDispatcher.spec.js tests/solver.newComponents.spec.js tests/solver.commonCases.spec.js
```
Expected: PASS.

**Step 6: Commit**

```bash
git add src/core/simulation/StampDispatcher.js src/engine/Solver.js tests/simulation.stampDispatcher.spec.js tests/solver.newComponents.spec.js
git commit -m "refactor(simulation): extract stamp dispatcher from solver"
```

---

### Task 9: Extract Dynamic Integrator

**Files:**
- Create: `src/core/simulation/DynamicIntegrator.js`
- Modify: `src/engine/Solver.js`
- Test: `tests/simulation.dynamicIntegrator.spec.js`
- Test: `tests/solver.dynamicIntegration.spec.js`

**Step 1: Write failing dynamic integration test**

```js
it('updates capacitor state using selected integration method', () => {
  const integrator = new DynamicIntegrator();
  integrator.update([capacitor], voltages, currents, dt, simTime);
  expect(capacitor.voltage).not.toBe(undefined);
});
```

**Step 2: Run test to verify failure**

Run:
```bash
npm test -- tests/simulation.dynamicIntegrator.spec.js
```
Expected: FAIL.

**Step 3: Move `updateDynamicComponents` and method resolution**

Keep exact numeric behavior.

**Step 4: Delegate in Solver**

`Solver.updateDynamicComponents` forwards to integrator.

**Step 5: Run tests**

Run:
```bash
npm test -- tests/simulation.dynamicIntegrator.spec.js tests/solver.dynamicIntegration.spec.js tests/circuit.acSubstep.spec.js
```
Expected: PASS.

**Step 6: Commit**

```bash
git add src/core/simulation/DynamicIntegrator.js src/engine/Solver.js tests/simulation.dynamicIntegrator.spec.js tests/solver.dynamicIntegration.spec.js
git commit -m "refactor(simulation): extract dynamic integrator"
```

---

### Task 10: Extract Solver Result Postprocessor

**Files:**
- Create: `src/core/simulation/ResultPostprocessor.js`
- Modify: `src/engine/Solver.js`
- Test: `tests/simulation.resultPostprocessor.spec.js`
- Test: `tests/currentDirection.parallel.spec.js`
- Test: `tests/currentDirection.series.spec.js`

**Step 1: Write failing postprocessing test**

```js
it('computes branch currents after solve output', () => {
  const post = new ResultPostprocessor();
  const out = post.apply({ components, voltages, x, nodeCount });
  expect(out.currents).toBeDefined();
});
```

**Step 2: Run test to verify failure**

Run:
```bash
npm test -- tests/simulation.resultPostprocessor.spec.js
```
Expected: FAIL.

**Step 3: Move current derivation logic**

Move from `calculateCurrent` and related paths into postprocessor.

**Step 4: Delegate in `solve()` pipeline**

Call postprocessor after matrix solve.

**Step 5: Run tests**

Run:
```bash
npm test -- tests/simulation.resultPostprocessor.spec.js tests/currentDirection.parallel.spec.js tests/currentDirection.series.spec.js
```
Expected: PASS.

**Step 6: Commit**

```bash
git add src/core/simulation/ResultPostprocessor.js src/engine/Solver.js tests/simulation.resultPostprocessor.spec.js tests/currentDirection.parallel.spec.js tests/currentDirection.series.spec.js
git commit -m "refactor(simulation): extract solver result postprocessor"
```

---

### Task 11: Consolidate IO Layer

**Files:**
- Create: `src/core/io/CircuitSerializer.js`
- Create: `src/core/io/CircuitDeserializer.js`
- Create: `src/core/io/CircuitSchemaGateway.js`
- Modify: `src/engine/Circuit.js`
- Modify: `src/utils/circuitSchema.js`
- Test: `tests/circuit.io.spec.js`
- Test: `tests/circuitSchema.spec.js`
- Test: `tests/circuit.legacyWireMigration.spec.js`

**Step 1: Write failing IO gateway test**

```js
it('serializes and deserializes circuit with stable schema', () => {
  const json = CircuitSerializer.serialize(circuit);
  expect(() => CircuitSchemaGateway.validate(json)).not.toThrow();
  const loaded = CircuitDeserializer.deserialize(json);
  expect(loaded.components.length).toBeGreaterThan(0);
});
```

**Step 2: Run tests to verify failure**

Run:
```bash
npm test -- tests/circuit.io.spec.js
```
Expected: FAIL.

**Step 3: Implement minimal serializer/deserializer wrappers**

Move `toJSON/fromJSON` payload shaping logic behind IO modules.

**Step 4: Integrate Circuit and schema validator**

`Circuit` delegates serialization; `circuitSchema` delegates validation gateway.

**Step 5: Run tests**

Run:
```bash
npm test -- tests/circuit.io.spec.js tests/circuitSchema.spec.js tests/circuit.legacyWireMigration.spec.js
```
Expected: PASS.

**Step 6: Commit**

```bash
git add src/core/io/CircuitSerializer.js src/core/io/CircuitDeserializer.js src/core/io/CircuitSchemaGateway.js src/engine/Circuit.js src/utils/circuitSchema.js tests/circuit.io.spec.js tests/circuitSchema.spec.js tests/circuit.legacyWireMigration.spec.js
git commit -m "refactor(io): consolidate circuit serialization and schema gateway"
```

---

### Task 12: Final Cleanup And Freeze Exit

**Files:**
- Modify: `README.md`
- Modify: `docs/plans/2026-02-07-full-architecture-refactor-design.md`
- Modify: any touched refactor modules for import cleanup
- Test: full suite

**Step 1: Add architecture update notes**

Document new module structure and migration boundaries.

**Step 2: Run full verification**

Run:
```bash
npm test
```
Expected: PASS (no failing tests).

**Step 3: Run focused regression scripts**

Run:
```bash
npm run baseline:p0
npm run baseline:circuitjs
npm run baseline:ai
```
Expected: no new regressions beyond accepted baseline drift.

**Step 4: Prepare freeze summary**

Create a short changelog section:
- modules extracted
- API compatibility notes
- known deferred cleanup

**Step 5: Commit**

```bash
git add README.md docs/plans/2026-02-07-full-architecture-refactor-design.md src tests
git commit -m "chore: complete full architecture refactor freeze"
```

---

## Final Verification Checklist

- `npm test` passes.
- All new controller/topology/simulation/io tests pass.
- No direct behavior regressions in UI panel, circuit solve loop, or JSON load/save.
- All commits are small and phase-scoped.

## Expected Deliverables

- New modules under:
  - `src/ui/ai`
  - `src/core/topology`
  - `src/core/simulation`
  - `src/core/io`
- Legacy facades retained:
  - `src/ui/AIPanel.js`
  - `src/engine/Circuit.js`
  - `src/engine/Solver.js`
- Updated tests and documentation.
