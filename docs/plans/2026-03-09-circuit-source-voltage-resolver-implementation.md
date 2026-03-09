# Circuit Source Voltage Resolver Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce duplicated AC/DC source voltage logic by extracting a shared core helper used by both `MNASolver` and `CircuitTopologyValidationService`.

**Architecture:** Move instantaneous source-voltage calculation into a shared core helper under `src/core/services/`. Keep `MNASolver` responsible for assigning the latest instantaneous voltage onto components, while topology validation consumes the same pure resolver for time-based checks.

**Tech Stack:** ESM JavaScript, Vitest, existing solver and topology validation tests.

---

### Task 1: Add seam and delegation tests

**Files:**
- Create: `tests/circuit.sourceVoltageResolver.spec.js`
- Create: `tests/mnaSolver.sourceVoltageDelegation.spec.js`
- Create: `tests/circuit.topologyValidationSourceVoltageDelegation.spec.js`
- Modify: `tests/mnaSolver.sizeTarget.spec.js`

**Step 1: Write the failing seam test**

Assert the new helper:
- returns DC source voltage unchanged
- computes AC instantaneous voltage from RMS, frequency, phase, and offset
- can assign the computed instantaneous voltage back to the component

Run: `npx vitest run tests/circuit.sourceVoltageResolver.spec.js -v`
Expected: FAIL because the helper module does not exist yet.

**Step 2: Write the failing delegation tests**

Assert:
- `MNASolver.getSourceInstantVoltage()` matches the shared helper and updates `comp.instantaneousVoltage`
- `CircuitTopologyValidationService.getSourceInstantVoltageAtTime()` matches the same shared helper

Run: `npx vitest run tests/mnaSolver.sourceVoltageDelegation.spec.js tests/circuit.topologyValidationSourceVoltageDelegation.spec.js -v`
Expected: FAIL because the shared helper is not wired yet.

**Step 3: Tighten the solver size target**

Lower the local `MNASolver` size-target test from `550` lines to `500` lines.

Run: `npx vitest run tests/mnaSolver.sizeTarget.spec.js -v`
Expected: PASS only after the extraction reduces file size enough.

### Task 2: Extract the shared helper

**Files:**
- Create: `src/core/services/CircuitSourceVoltageResolver.js`
- Modify: `src/core/simulation/MNASolver.js`
- Modify: `src/core/services/CircuitTopologyValidationService.js`
- Test: `tests/circuit.sourceVoltageResolver.spec.js`
- Test: `tests/mnaSolver.sourceVoltageDelegation.spec.js`
- Test: `tests/circuit.topologyValidationSourceVoltageDelegation.spec.js`
- Test: `tests/mnaSolver.sizeTarget.spec.js`
- Test: `tests/solver.newComponents.spec.js`
- Test: `tests/solver.dynamicIntegration.spec.js`
- Test: `tests/circuit.topologyValidationService.spec.js`

**Step 1: Implement the helper**

Create a shared helper that resolves source voltage at a given simulation time and an assignment helper for solver-side mutation.

**Step 2: Delegate from solver and topology validation**

Replace duplicate inline voltage formulas with imports from the new helper.

**Step 3: Verify behavior**

Run:
- `npx vitest run tests/circuit.sourceVoltageResolver.spec.js tests/mnaSolver.sourceVoltageDelegation.spec.js tests/circuit.topologyValidationSourceVoltageDelegation.spec.js tests/mnaSolver.sizeTarget.spec.js tests/solver.newComponents.spec.js tests/solver.dynamicIntegration.spec.js tests/circuit.topologyValidationService.spec.js -v`
- `npm run lint`
- `npm run check:core-size`
- `npm run check:maintainability`
- `npm run report:debt-dashboard`
- `npm run baseline:p0`
- `npm run baseline:circuitjs`

Expected: all PASS.
