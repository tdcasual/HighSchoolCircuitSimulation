# RC/RL Transient Tests Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add deterministic backward-Euler transient tests for RC charge/discharge and RL rise/decay.

**Architecture:** New solver test file that builds small RC/RL loops and checks discrete-step recurrence against expected values.

**Tech Stack:** Vitest, circuit test helpers (`createTestCircuit`, `addComponent`, `connectWire`).

---

### Task 1: RC charge and discharge tests (backward-Euler)

**Files:**
- Create: `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/.worktrees/codex/rc-rl-transient/tests/solver.rcRlTransient.spec.js`

**Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { addComponent, connectWire, createTestCircuit } from './helpers/circuitTestUtils.js';

describe('RC/RL transient recurrence (backward-euler)', () => {
    it('matches RC charging recurrence over two steps', () => {
        const circuit = createTestCircuit();
        circuit.dt = 0.01;

        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 10, internalResistance: 0 });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        const capacitor = addComponent(circuit, 'Capacitor', 'C1', {
            capacitance: 0.001,
            integrationMethod: 'backward-euler'
        });

        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, capacitor, 0);
        connectWire(circuit, 'W3', capacitor, 1, source, 1);

        const alpha = circuit.dt / (resistor.resistance * capacitor.capacitance);
        let vExpected = 0;

        circuit.isRunning = true;
        circuit.step();
        vExpected = (vExpected + alpha * source.voltage) / (1 + alpha);
        const v1 = (circuit.lastResults?.voltages?.[capacitor.nodes[0]] || 0)
            - (circuit.lastResults?.voltages?.[capacitor.nodes[1]] || 0);
        expect(v1).toBeCloseTo(vExpected, 6);

        circuit.step();
        vExpected = (vExpected + alpha * source.voltage) / (1 + alpha);
        const v2 = (circuit.lastResults?.voltages?.[capacitor.nodes[0]] || 0)
            - (circuit.lastResults?.voltages?.[capacitor.nodes[1]] || 0);
        expect(v2).toBeCloseTo(vExpected, 6);
        circuit.isRunning = false;
    });

    it('matches RC discharging recurrence over two steps', () => {
        const circuit = createTestCircuit();
        circuit.dt = 0.01;

        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 0, internalResistance: 0 });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        const capacitor = addComponent(circuit, 'Capacitor', 'C1', {
            capacitance: 0.001,
            integrationMethod: 'backward-euler'
        });

        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, capacitor, 0);
        connectWire(circuit, 'W3', capacitor, 1, source, 1);

        const alpha = circuit.dt / (resistor.resistance * capacitor.capacitance);
        let vExpected = 10;
        capacitor.prevCharge = capacitor.capacitance * vExpected;
        capacitor.prevVoltage = vExpected;

        circuit.isRunning = true;
        circuit.step();
        vExpected = vExpected / (1 + alpha);
        const v1 = (circuit.lastResults?.voltages?.[capacitor.nodes[0]] || 0)
            - (circuit.lastResults?.voltages?.[capacitor.nodes[1]] || 0);
        expect(v1).toBeCloseTo(vExpected, 6);

        circuit.step();
        vExpected = vExpected / (1 + alpha);
        const v2 = (circuit.lastResults?.voltages?.[capacitor.nodes[0]] || 0)
            - (circuit.lastResults?.voltages?.[capacitor.nodes[1]] || 0);
        expect(v2).toBeCloseTo(vExpected, 6);
        circuit.isRunning = false;
    });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/solver.rcRlTransient.spec.js`
Expected: FAIL until the code is saved.

**Step 3: Run test to verify it passes**

Run: `npm test -- tests/solver.rcRlTransient.spec.js`
Expected: PASS

**Step 4: Commit**

```bash
git add /Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/.worktrees/codex/rc-rl-transient/tests/solver.rcRlTransient.spec.js
git commit -m "test: add rc charging/discharging recurrence cases"
```

---

### Task 2: RL rise and decay tests (backward-Euler)

**Files:**
- Modify: `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/.worktrees/codex/rc-rl-transient/tests/solver.rcRlTransient.spec.js`

**Step 1: Write the failing test**

```js
    it('matches RL current rise recurrence over two steps', () => {
        const circuit = createTestCircuit();
        circuit.dt = 0.01;

        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 10, internalResistance: 0 });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 10 });
        const inductor = addComponent(circuit, 'Inductor', 'L1', {
            inductance: 0.1,
            integrationMethod: 'backward-euler',
            initialCurrent: 0
        });

        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, inductor, 0);
        connectWire(circuit, 'W3', inductor, 1, source, 1);

        const beta = (circuit.dt * resistor.resistance) / inductor.inductance;
        const gamma = (circuit.dt * source.voltage) / inductor.inductance;
        let iExpected = 0;

        circuit.isRunning = true;
        circuit.step();
        iExpected = (iExpected + gamma) / (1 + beta);
        const i1 = circuit.lastResults?.currents?.get('L1') || 0;
        expect(i1).toBeCloseTo(iExpected, 6);

        circuit.step();
        iExpected = (iExpected + gamma) / (1 + beta);
        const i2 = circuit.lastResults?.currents?.get('L1') || 0;
        expect(i2).toBeCloseTo(iExpected, 6);
        circuit.isRunning = false;
    });

    it('matches RL current decay recurrence over two steps', () => {
        const circuit = createTestCircuit();
        circuit.dt = 0.01;

        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 0, internalResistance: 0 });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 10 });
        const inductor = addComponent(circuit, 'Inductor', 'L1', {
            inductance: 0.1,
            integrationMethod: 'backward-euler',
            initialCurrent: 0
        });

        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, inductor, 0);
        connectWire(circuit, 'W3', inductor, 1, source, 1);

        const beta = (circuit.dt * resistor.resistance) / inductor.inductance;
        let iExpected = 1;
        inductor.prevCurrent = iExpected;

        circuit.isRunning = true;
        circuit.step();
        iExpected = iExpected / (1 + beta);
        const i1 = circuit.lastResults?.currents?.get('L1') || 0;
        expect(i1).toBeCloseTo(iExpected, 6);

        circuit.step();
        iExpected = iExpected / (1 + beta);
        const i2 = circuit.lastResults?.currents?.get('L1') || 0;
        expect(i2).toBeCloseTo(iExpected, 6);
        circuit.isRunning = false;
    });
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/solver.rcRlTransient.spec.js`
Expected: FAIL until the code is saved.

**Step 3: Run test to verify it passes**

Run: `npm test -- tests/solver.rcRlTransient.spec.js`
Expected: PASS

**Step 4: Commit**

```bash
git add /Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/.worktrees/codex/rc-rl-transient/tests/solver.rcRlTransient.spec.js
git commit -m "test: add rl rise/decay recurrence cases"
```

---

### Task 3: Full verification

**Files:**
- Test: `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/.worktrees/codex/rc-rl-transient/tests/solver.rcRlTransient.spec.js`

**Step 1: Run targeted suite**

Run: `npm test -- tests/solver.rcRlTransient.spec.js`
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
git add /Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/.worktrees/codex/rc-rl-transient/tests/solver.rcRlTransient.spec.js
git commit -m "test: add rc-rl transient recurrence cases"
```
