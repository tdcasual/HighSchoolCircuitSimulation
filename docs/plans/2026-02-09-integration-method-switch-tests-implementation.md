# Integration Method Switch Tests Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add tests that verify integration method selection for capacitors and inductors, including history gating and switch overrides.

**Architecture:** New solver test file that builds small RC/RL circuits and checks `solver.resolveDynamicIntegrationMethod` before and after history becomes ready, with and without connected switches.

**Tech Stack:** Vitest, circuit test helpers (`createTestCircuit`, `addComponent`, `connectWire`, `solveCircuit`).

---

### Task 1: Capacitor auto/trapezoidal/backward-euler selection

**Files:**
- Create: `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/.worktrees/codex/multi-source-multi-ground/tests/solver.integrationMethodSwitch.spec.js`

**Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { addComponent, connectWire, createTestCircuit } from './helpers/circuitTestUtils.js';

describe('Integration method selection', () => {
    it('switches capacitor auto from backward-euler to trapezoidal after history', () => {
        const circuit = createTestCircuit();
        circuit.dt = 0.01;

        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 10, internalResistance: 0 });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        const capacitor = addComponent(circuit, 'Capacitor', 'C1', { capacitance: 0.001, integrationMethod: 'auto' });

        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, capacitor, 0);
        connectWire(circuit, 'W3', capacitor, 1, source, 1);

        circuit.solver.setCircuit(Array.from(circuit.components.values()), circuit.nodes);
        expect(circuit.solver.resolveDynamicIntegrationMethod(capacitor)).toBe('backward-euler');

        circuit.isRunning = true;
        circuit.step();
        circuit.step();

        expect(circuit.solver.resolveDynamicIntegrationMethod(capacitor)).toBe('trapezoidal');
        circuit.isRunning = false;
    });

    it('forces backward-euler for capacitor auto when a connected switch exists', () => {
        const circuit = createTestCircuit();
        circuit.dt = 0.01;

        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 10, internalResistance: 0 });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        const capacitor = addComponent(circuit, 'Capacitor', 'C1', { capacitance: 0.001, integrationMethod: 'auto' });
        const sw = addComponent(circuit, 'Switch', 'S1', { closed: false });

        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, capacitor, 0);
        connectWire(circuit, 'W3', capacitor, 1, source, 1);
        connectWire(circuit, 'W4', source, 0, sw, 0);
        connectWire(circuit, 'W5', sw, 1, source, 1);

        circuit.solver.setCircuit(Array.from(circuit.components.values()), circuit.nodes);
        circuit.isRunning = true;
        circuit.step();
        circuit.step();

        expect(circuit.solver.resolveDynamicIntegrationMethod(capacitor)).toBe('backward-euler');
        circuit.isRunning = false;
    });

    it('keeps capacitor explicit backward-euler even after history', () => {
        const circuit = createTestCircuit();
        circuit.dt = 0.01;

        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 10, internalResistance: 0 });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        const capacitor = addComponent(circuit, 'Capacitor', 'C1', { capacitance: 0.001, integrationMethod: 'backward-euler' });

        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, capacitor, 0);
        connectWire(circuit, 'W3', capacitor, 1, source, 1);

        circuit.solver.setCircuit(Array.from(circuit.components.values()), circuit.nodes);
        expect(circuit.solver.resolveDynamicIntegrationMethod(capacitor)).toBe('backward-euler');

        circuit.isRunning = true;
        circuit.step();
        circuit.step();

        expect(circuit.solver.resolveDynamicIntegrationMethod(capacitor)).toBe('backward-euler');
        circuit.isRunning = false;
    });

    it('uses trapezoidal for capacitor explicit trapezoidal only after history', () => {
        const circuit = createTestCircuit();
        circuit.dt = 0.01;

        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 10, internalResistance: 0 });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        const capacitor = addComponent(circuit, 'Capacitor', 'C1', { capacitance: 0.001, integrationMethod: 'trapezoidal' });

        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, capacitor, 0);
        connectWire(circuit, 'W3', capacitor, 1, source, 1);

        circuit.solver.setCircuit(Array.from(circuit.components.values()), circuit.nodes);
        expect(circuit.solver.resolveDynamicIntegrationMethod(capacitor)).toBe('backward-euler');

        circuit.isRunning = true;
        circuit.step();
        circuit.step();

        expect(circuit.solver.resolveDynamicIntegrationMethod(capacitor)).toBe('trapezoidal');
        circuit.isRunning = false;
    });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/solver.integrationMethodSwitch.spec.js`
Expected: FAIL until code is implemented.

**Step 3: Run test to verify it passes**

Run: `npm test -- tests/solver.integrationMethodSwitch.spec.js`
Expected: PASS

**Step 4: Commit**

```bash
git add /Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/.worktrees/codex/multi-source-multi-ground/tests/solver.integrationMethodSwitch.spec.js
git commit -m "test: add capacitor integration method selection cases"
```

---

### Task 2: Inductor auto/trapezoidal/backward-euler selection

**Files:**
- Modify: `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/.worktrees/codex/multi-source-multi-ground/tests/solver.integrationMethodSwitch.spec.js`

**Step 1: Write the failing test**

```js
    it('switches inductor auto from backward-euler to trapezoidal after history', () => {
        const circuit = createTestCircuit();
        circuit.dt = 0.01;

        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 10, internalResistance: 0 });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 10 });
        const inductor = addComponent(circuit, 'Inductor', 'L1', { inductance: 0.1, integrationMethod: 'auto' });

        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, inductor, 0);
        connectWire(circuit, 'W3', inductor, 1, source, 1);

        circuit.solver.setCircuit(Array.from(circuit.components.values()), circuit.nodes);
        expect(circuit.solver.resolveDynamicIntegrationMethod(inductor)).toBe('backward-euler');

        circuit.isRunning = true;
        circuit.step();
        circuit.step();

        expect(circuit.solver.resolveDynamicIntegrationMethod(inductor)).toBe('trapezoidal');
        circuit.isRunning = false;
    });

    it('forces backward-euler for inductor auto when a connected switch exists', () => {
        const circuit = createTestCircuit();
        circuit.dt = 0.01;

        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 10, internalResistance: 0 });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 10 });
        const inductor = addComponent(circuit, 'Inductor', 'L1', { inductance: 0.1, integrationMethod: 'auto' });
        const sw = addComponent(circuit, 'Switch', 'S1', { closed: false });

        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, inductor, 0);
        connectWire(circuit, 'W3', inductor, 1, source, 1);
        connectWire(circuit, 'W4', source, 0, sw, 0);
        connectWire(circuit, 'W5', sw, 1, source, 1);

        circuit.solver.setCircuit(Array.from(circuit.components.values()), circuit.nodes);
        circuit.isRunning = true;
        circuit.step();
        circuit.step();

        expect(circuit.solver.resolveDynamicIntegrationMethod(inductor)).toBe('backward-euler');
        circuit.isRunning = false;
    });

    it('keeps inductor explicit backward-euler even after history', () => {
        const circuit = createTestCircuit();
        circuit.dt = 0.01;

        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 10, internalResistance: 0 });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 10 });
        const inductor = addComponent(circuit, 'Inductor', 'L1', { inductance: 0.1, integrationMethod: 'backward-euler' });

        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, inductor, 0);
        connectWire(circuit, 'W3', inductor, 1, source, 1);

        circuit.solver.setCircuit(Array.from(circuit.components.values()), circuit.nodes);
        expect(circuit.solver.resolveDynamicIntegrationMethod(inductor)).toBe('backward-euler');

        circuit.isRunning = true;
        circuit.step();
        circuit.step();

        expect(circuit.solver.resolveDynamicIntegrationMethod(inductor)).toBe('backward-euler');
        circuit.isRunning = false;
    });

    it('uses trapezoidal for inductor explicit trapezoidal only after history', () => {
        const circuit = createTestCircuit();
        circuit.dt = 0.01;

        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 10, internalResistance: 0 });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 10 });
        const inductor = addComponent(circuit, 'Inductor', 'L1', { inductance: 0.1, integrationMethod: 'trapezoidal' });

        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, inductor, 0);
        connectWire(circuit, 'W3', inductor, 1, source, 1);

        circuit.solver.setCircuit(Array.from(circuit.components.values()), circuit.nodes);
        expect(circuit.solver.resolveDynamicIntegrationMethod(inductor)).toBe('backward-euler');

        circuit.isRunning = true;
        circuit.step();
        circuit.step();

        expect(circuit.solver.resolveDynamicIntegrationMethod(inductor)).toBe('trapezoidal');
        circuit.isRunning = false;
    });
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/solver.integrationMethodSwitch.spec.js`
Expected: FAIL until code is implemented.

**Step 3: Run test to verify it passes**

Run: `npm test -- tests/solver.integrationMethodSwitch.spec.js`
Expected: PASS

**Step 4: Commit**

```bash
git add /Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/.worktrees/codex/multi-source-multi-ground/tests/solver.integrationMethodSwitch.spec.js
git commit -m "test: add inductor integration method selection cases"
```

---

### Task 3: Full verification

**Files:**
- Test: `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/.worktrees/codex/multi-source-multi-ground/tests/solver.integrationMethodSwitch.spec.js`

**Step 1: Run targeted suite**

Run: `npm test -- tests/solver.integrationMethodSwitch.spec.js`
Expected: PASS

**Step 2: Run full suite**

Run: `npm test`
Expected: PASS (existing warnings about `--localstorage-file` are acceptable)

**Step 3: Final commit (if needed)**

```bash
git status -sb
```
If there are uncommitted changes, commit:

```bash
git add /Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/.worktrees/codex/multi-source-multi-ground/tests/solver.integrationMethodSwitch.spec.js
git commit -m "test: add integration method switch cases"
```
