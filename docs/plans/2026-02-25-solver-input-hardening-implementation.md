# Solver Input Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate runtime crashes and NaN state pollution caused by malformed numeric inputs from import/runtime component state, while preserving backward compatibility for existing circuit JSON files.

**Architecture:** Add defensive numeric normalization at the simulation boundary (solver/integrator/deserializer) instead of relying only on UI parsing. Lock the behavior with regression tests first, then apply minimal fixes in `Solver`, `DynamicIntegrator`, and JSON deserialization flow. Keep existing electrical behavior unchanged for valid inputs.

**Tech Stack:** JavaScript (ESM), Vitest, existing circuit test helpers, MNA solver (`src/engine/Solver.js`), dynamic integration (`src/core/simulation/DynamicIntegrator.js`), IO (`src/core/io/CircuitDeserializer.js`).

---

### Task 1: Add Regression Tests For Malformed Numeric Inputs In Solver

**Files:**
- Create: `tests/solver.inputHardening.spec.js`
- Test: `tests/solver.inputHardening.spec.js`

**Step 1: Write the failing test**

```js
import { describe, expect, it } from 'vitest';
import { addComponent, connectWire, createTestCircuit, solveCircuit } from './helpers/circuitTestUtils.js';

describe('Solver input hardening', () => {
    it('does not throw when PowerSource.internalResistance is non-numeric', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 6, internalResistance: 0.5 });
        const load = addComponent(circuit, 'Resistor', 'R1', { resistance: 10 });
        connectWire(circuit, 'W1', source, 0, load, 0);
        connectWire(circuit, 'W2', load, 1, source, 1);

        source.internalResistance = 'bad-value';
        expect(() => solveCircuit(circuit)).not.toThrow();
    });

    it('does not throw when Ammeter.resistance is non-numeric', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 6, internalResistance: 0 });
        const ammeter = addComponent(circuit, 'Ammeter', 'A1', { resistance: 0 });
        const load = addComponent(circuit, 'Resistor', 'R1', { resistance: 10 });
        connectWire(circuit, 'W1', source, 0, ammeter, 0);
        connectWire(circuit, 'W2', ammeter, 1, load, 0);
        connectWire(circuit, 'W3', load, 1, source, 1);

        ammeter.resistance = 'oops';
        expect(() => solveCircuit(circuit)).not.toThrow();
    });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/solver.inputHardening.spec.js`  
Expected: FAIL with a `TypeError` from `stampVoltageSource`/matrix indexing.

**Step 3: Commit the failing test**

```bash
git add tests/solver.inputHardening.spec.js
git commit -m "test: reproduce solver crash on malformed numeric component inputs"
```

### Task 2: Harden Voltage-Source Index Assignment And Stamp Guard

**Files:**
- Modify: `src/engine/Solver.js`
- Test: `tests/solver.inputHardening.spec.js`

**Step 1: Implement minimal solver hardening**

```js
const internalResistance = Number(comp.internalResistance);
const hasFiniteInternalR = Number.isFinite(internalResistance) && internalResistance > 1e-9;
// Use hasFiniteInternalR consistently in setCircuit + stamp logic
```

```js
stampVoltageSource(A, z, i1, i2, V, vsIndex, nodeCount) {
    if (!Number.isInteger(vsIndex) || vsIndex < 0) {
        this.logger?.warn?.('Skip voltage source stamp due to invalid vsIndex');
        return;
    }
    const k = nodeCount - 1 + vsIndex;
    if (k < 0 || k >= A.length) {
        this.logger?.warn?.('Skip voltage source stamp due to out-of-range equation row');
        return;
    }
    // existing stamping...
}
```

**Step 2: Run test to verify it passes**

Run: `npm test -- tests/solver.inputHardening.spec.js`  
Expected: PASS.

**Step 3: Run focused existing solver safety suite**

Run: `npm test -- tests/solver.commonMistakes.spec.js tests/solver.commonCases.spec.js`  
Expected: PASS.

**Step 4: Commit**

```bash
git add src/engine/Solver.js tests/solver.inputHardening.spec.js
git commit -m "fix: guard solver voltage-source stamping against malformed numeric inputs"
```

### Task 3: Sanitize Imported Component Properties Before Simulation

**Files:**
- Modify: `src/core/io/CircuitDeserializer.js`
- Modify: `tests/circuit.io.spec.js`
- Test: `tests/circuit.io.spec.js`

**Step 1: Add a failing import sanitization test**

```js
it('sanitizes malformed numeric properties on deserialize', () => {
    const json = {
        components: [
            { id: 'V1', type: 'PowerSource', x: 0, y: 0, properties: { voltage: 6, internalResistance: 'bad' } },
            { id: 'R1', type: 'Resistor', x: 120, y: 0, properties: { resistance: 10 } },
            { id: 'M1', type: 'Motor', x: 240, y: 0, properties: { resistance: 0, inertia: 0 } }
        ],
        wires: []
    };
    const loaded = CircuitDeserializer.deserialize(json);
    const source = loaded.components.find((c) => c.id === 'V1');
    const motor = loaded.components.find((c) => c.id === 'M1');
    expect(Number.isFinite(source.internalResistance)).toBe(true);
    expect(source.internalResistance).toBeGreaterThan(0);
    expect(motor.resistance).toBeGreaterThan(0);
    expect(motor.inertia).toBeGreaterThan(0);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/circuit.io.spec.js`  
Expected: FAIL due to unsanitized values.

**Step 3: Implement deserializer sanitization helper**

```js
function sanitizeRuntimeCriticalProperties(comp) {
    if (comp.type === 'PowerSource' || comp.type === 'ACVoltageSource') {
        const r = Number(comp.internalResistance);
        if (!Number.isFinite(r) || r < 0) comp.internalResistance = 0.5;
    }
    if (comp.type === 'Ammeter') {
        const r = Number(comp.resistance);
        comp.resistance = Number.isFinite(r) && r >= 0 ? r : 0;
    }
    if (comp.type === 'Motor') {
        const r = Number(comp.resistance);
        const j = Number(comp.inertia);
        comp.resistance = Number.isFinite(r) && r > 0 ? r : 5;
        comp.inertia = Number.isFinite(j) && j > 0 ? j : 0.01;
    }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/circuit.io.spec.js`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/core/io/CircuitDeserializer.js tests/circuit.io.spec.js
git commit -m "fix: sanitize imported runtime-critical numeric component properties"
```

### Task 4: Guard Motor Dynamic Update Against NaN/Infinity Propagation

**Files:**
- Modify: `tests/simulation.dynamicIntegrator.spec.js`
- Modify: `src/core/simulation/DynamicIntegrator.js`
- Test: `tests/simulation.dynamicIntegrator.spec.js`

**Step 1: Add failing dynamic integrator regression test**

```js
it('keeps motor state finite when resistance/inertia are invalid', () => {
    const integrator = new DynamicIntegrator();
    const state = new SimulationState();
    const motor = createComponent('Motor', 0, 0, 'M_bad');
    motor.nodes = [0, 1];
    motor.resistance = 0;
    motor.inertia = 0;
    motor.torqueConstant = 0.1;
    motor.emfConstant = 0.1;
    motor.loadTorque = 0.01;

    integrator.updateDynamicComponents([motor], [12, 0], null, 0.01, false, state);
    expect(Number.isFinite(motor.speed)).toBe(true);
    expect(Number.isFinite(motor.backEmf)).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/simulation.dynamicIntegrator.spec.js`  
Expected: FAIL (`speed` or `backEmf` becomes `NaN`).

**Step 3: Implement motor parameter guards**

```js
const resistance = Math.max(1e-9, Number.isFinite(Number(comp.resistance)) ? Number(comp.resistance) : 5);
const inertia = Math.max(1e-12, Number.isFinite(Number(comp.inertia)) ? Number(comp.inertia) : 0.01);
const torqueConstant = Number.isFinite(Number(comp.torqueConstant)) ? Number(comp.torqueConstant) : 0.1;
const emfConstant = Number.isFinite(Number(comp.emfConstant)) ? Number(comp.emfConstant) : 0.1;
const loadTorque = Number.isFinite(Number(comp.loadTorque)) ? Number(comp.loadTorque) : 0.01;
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/simulation.dynamicIntegrator.spec.js`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/core/simulation/DynamicIntegrator.js tests/simulation.dynamicIntegrator.spec.js
git commit -m "fix: prevent motor dynamic state NaN propagation on invalid parameters"
```

### Task 5: Final Verification And Audit Closure

**Files:**
- Modify: `docs/plans/2026-02-25-solver-input-hardening-implementation.md` (optional status notes)

**Step 1: Run full verification**

Run: `npm run check:full`  
Expected: All lint/tests/baselines pass.

**Step 2: Execute focused crash repro script (should no longer throw)**

Run:

```bash
node --input-type=module scripts/repro/verify-input-hardening.mjs
```

Expected: exits 0, prints finite/valid outcomes (no `TypeError`, no `NaN` state).

**Step 3: Final commit**

```bash
git add src tests docs/plans/2026-02-25-solver-input-hardening-implementation.md
git commit -m "chore: harden solver and dynamic integration input boundaries"
```

**Step 4: Open PR checklist**

```md
- [ ] Added regression tests for malformed numeric inputs
- [ ] Preserved behavior for valid circuits
- [ ] Verified no crash on malformed import data
- [ ] Ran npm run check:full
```
