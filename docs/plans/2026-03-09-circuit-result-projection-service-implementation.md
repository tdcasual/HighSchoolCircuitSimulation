# Circuit Result Projection Service Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce `Circuit.js` maintenance load by extracting the simulation-result-to-component-display projection logic into a dedicated core service.

**Architecture:** Keep simulation orchestration in `Circuit.step()`, but move the large valid-result projection block into `src/core/services/CircuitResultProjectionService.js`. `Circuit` should inject and delegate to this service so the projection rules remain testable in isolation while runtime behavior stays unchanged.

**Tech Stack:** ESM JavaScript, Vitest, existing circuit runtime and solver tests.

---

### Task 1: Add seam tests

**Files:**
- Create: `tests/circuit.resultProjectionService.spec.js`
- Create: `tests/circuit.resultProjectionDelegation.spec.js`

**Step 1: Write the failing service test**

Assert the new service:
- zeros display values for disconnected components
- blows connected fuses when `i2tAccum` crosses threshold and marks the solver dirty

Run: `npx vitest run tests/circuit.resultProjectionService.spec.js -v`
Expected: FAIL because the service module does not exist yet.

**Step 2: Write the failing delegation test**

Assert `Circuit.step()` delegates projection work to an injected `resultProjectionService`.

Run: `npx vitest run tests/circuit.resultProjectionDelegation.spec.js -v`
Expected: FAIL because `Circuit` does not yet inject or delegate to that service.

### Task 2: Extract the projection service

**Files:**
- Create: `src/core/services/CircuitResultProjectionService.js`
- Modify: `src/core/runtime/Circuit.js`
- Test: `tests/circuit.resultProjectionService.spec.js`
- Test: `tests/circuit.resultProjectionDelegation.spec.js`
- Test: `tests/circuit.acSubstep.spec.js`
- Test: `tests/solver.dynamicIntegration.spec.js`
- Test: `tests/wireShortCircuit.spec.js`

**Step 1: Implement the new service**

Move component display projection and fuse `I²t` update logic into `CircuitResultProjectionService`.

**Step 2: Delegate from `Circuit.step()`**

Inject `resultProjectionService` in the constructor and replace the inline projection block with a single delegation call.

**Step 3: Verify behavior**

Run:
- `npx vitest run tests/circuit.resultProjectionService.spec.js tests/circuit.resultProjectionDelegation.spec.js tests/circuit.acSubstep.spec.js tests/solver.dynamicIntegration.spec.js tests/wireShortCircuit.spec.js -v`
- `npm run lint`
- `npm run check:core-size`
- `npm run check:maintainability`
- `npm run report:debt-dashboard`
- `npm run baseline:p0`
- `npm run baseline:circuitjs`

Expected: all PASS.
