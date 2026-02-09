# Misuse Tests Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add instrument/switch misuse tests and dynamic misuse tests covering common classroom wiring mistakes.

**Architecture:** Extend existing solver test suites with deterministic circuits and closed-form expectations; no solver changes.

**Tech Stack:** Vitest, existing test helpers (`createTestCircuit`, `addComponent`, `connectWire`, `solveCircuit`).

---

### Task 1: Instrument/Switch Misuse Tests

**Files:**
- Modify: `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/tests/solver.commonMistakes.spec.js`
- Test: `npm test -- tests/solver.commonMistakes.spec.js`

**Step 1: Write the failing tests**

Add these `it` blocks under `describe('Solver common wiring mistakes', ...)`:

```js
    it('bypasses the load when a parallel switch is closed', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 12, internalResistance: 0 });
        const limiter = addComponent(circuit, 'Resistor', 'Rlim', { resistance: 10 });
        const load = addComponent(circuit, 'Resistor', 'Rload', { resistance: 100 });
        const sw = addComponent(circuit, 'Switch', 'S1', { closed: true });

        connectWire(circuit, 'W1', source, 0, limiter, 0);
        connectWire(circuit, 'W2', limiter, 1, load, 0);
        connectWire(circuit, 'W3', load, 1, source, 1);
        connectWire(circuit, 'W4', limiter, 1, sw, 0);
        connectWire(circuit, 'W5', sw, 1, source, 1);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);
        expect(circuit.solver.shortCircuitDetected).toBe(false);

        const expectedCurrent = source.voltage / limiter.resistance;
        const iLimiter = Math.abs(results.currents.get('Rlim') || 0);
        const iLoad = Math.abs(results.currents.get('Rload') || 0);
        const vNode = results.voltages[limiter.nodes[1]] || 0;
        expect(iLimiter).toBeCloseTo(expectedCurrent, 6);
        expect(iLoad).toBeLessThan(1e-3);
        expect(Math.abs(vNode)).toBeLessThan(1e-3);
    });

    it('routes current through a parallel ammeter and starves the load', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 12, internalResistance: 0 });
        const limiter = addComponent(circuit, 'Resistor', 'Rlim', { resistance: 10 });
        const load = addComponent(circuit, 'Resistor', 'Rload', { resistance: 100 });
        const ammeter = addComponent(circuit, 'Ammeter', 'A1', { resistance: 0, range: 3 });

        connectWire(circuit, 'W1', source, 0, limiter, 0);
        connectWire(circuit, 'W2', limiter, 1, load, 0);
        connectWire(circuit, 'W3', load, 1, source, 1);
        connectWire(circuit, 'W4', limiter, 1, ammeter, 0);
        connectWire(circuit, 'W5', ammeter, 1, source, 1);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);
        expect(circuit.solver.shortCircuitDetected).toBe(false);

        const expectedCurrent = source.voltage / limiter.resistance;
        const iLimiter = Math.abs(results.currents.get('Rlim') || 0);
        const iLoad = Math.abs(results.currents.get('Rload') || 0);
        const iAmmeter = Math.abs(results.currents.get('A1') || 0);
        expect(iLimiter).toBeCloseTo(expectedCurrent, 6);
        expect(iAmmeter).toBeCloseTo(expectedCurrent, 6);
        expect(iLoad).toBeLessThan(1e-3);
    });

    it('reduces current when a finite-resistance voltmeter is placed in series', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 12, internalResistance: 0 });
        const voltmeter = addComponent(circuit, 'Voltmeter', 'VM1', { resistance: 1000, range: 15 });
        const load = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });

        connectWire(circuit, 'W1', source, 0, voltmeter, 0);
        connectWire(circuit, 'W2', voltmeter, 1, load, 0);
        connectWire(circuit, 'W3', load, 1, source, 1);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);

        const expectedCurrent = source.voltage / (voltmeter.resistance + load.resistance);
        const iLoad = results.currents.get('R1') || 0;
        const iVoltmeter = results.currents.get('VM1') || 0;
        expect(iLoad).toBeCloseTo(expectedCurrent, 6);
        expect(iVoltmeter).toBeCloseTo(expectedCurrent, 6);

        const vDropVm = (results.voltages[voltmeter.nodes[0]] || 0)
            - (results.voltages[voltmeter.nodes[1]] || 0);
        expect(Math.abs(vDropVm)).toBeCloseTo(expectedCurrent * voltmeter.resistance, 6);
    });
```

**Step 2: Run test to verify behavior**

Run: `npm test -- tests/solver.commonMistakes.spec.js`  
Expected: all tests pass. If any fail, capture the failure and stop.

**Step 3: Minimal implementation (if needed)**

No production code changes expected. If a new test fails due to solver behavior, stop and report before changing code.

**Step 4: Re-run tests**

Run: `npm test -- tests/solver.commonMistakes.spec.js`  
Expected: PASS

**Step 5: Commit**

```bash
git add /Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/tests/solver.commonMistakes.spec.js
git commit -m "test: add instrument and switch misuse cases"
```

---

### Task 2: Dynamic Misuse Tests

**Files:**
- Modify: `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/tests/solver.dynamicIntegration.spec.js`
- Test: `npm test -- tests/solver.dynamicIntegration.spec.js`

**Step 1: Write the failing tests**

Add these `it` blocks under `describe('Dynamic integration methods (capacitor/inductor)', ...)`:

```js
    it('keeps a precharged capacitor steady when the series switch is open', () => {
        const circuit = createTestCircuit();
        circuit.dt = 0.01;

        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 10, internalResistance: 0 });
        const sw = addComponent(circuit, 'Switch', 'S1', { closed: false });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        const capacitor = addComponent(circuit, 'Capacitor', 'C1', {
            capacitance: 0.001,
            integrationMethod: 'backward-euler'
        });

        connectWire(circuit, 'W1', source, 0, sw, 0);
        connectWire(circuit, 'W2', sw, 1, resistor, 0);
        connectWire(circuit, 'W3', resistor, 1, capacitor, 0);
        connectWire(circuit, 'W4', capacitor, 1, source, 1);

        const v0 = 5;
        capacitor.prevVoltage = v0;
        capacitor.prevCharge = capacitor.capacitance * v0;
        capacitor.prevCurrent = 0;

        circuit.isRunning = true;
        circuit.step();
        const vCap = readCapVoltage(circuit, capacitor);
        const iCap = Math.abs(circuit.lastResults?.currents?.get('C1') || 0);
        expect(vCap).toBeCloseTo(v0, 6);
        expect(iCap).toBeLessThan(1e-6);
        circuit.isRunning = false;
    });

    it('decays inductor current from initial state with no applied voltage', () => {
        const circuit = createTestCircuit();
        circuit.dt = 0.01;

        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 0, internalResistance: 0 });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 10 });
        const inductor = addComponent(circuit, 'Inductor', 'L1', {
            inductance: 0.1,
            integrationMethod: 'backward-euler'
        });

        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, inductor, 0);
        connectWire(circuit, 'W3', inductor, 1, source, 1);

        const alpha = (circuit.dt * resistor.resistance) / inductor.inductance;
        let iExpected = 1;
        inductor.prevCurrent = iExpected;
        inductor.prevVoltage = 0;

        circuit.isRunning = true;
        circuit.step();
        iExpected = iExpected / (1 + alpha);
        expect(inductor.currentValue).toBeCloseTo(iExpected, 6);

        circuit.step();
        iExpected = iExpected / (1 + alpha);
        expect(inductor.currentValue).toBeCloseTo(iExpected, 6);
        circuit.isRunning = false;
    });

    it('matches capacitor inrush current on the first backward-euler step', () => {
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
        const vExpected = (alpha * source.voltage) / (1 + alpha);
        const iExpected = (capacitor.capacitance * vExpected) / circuit.dt;

        circuit.isRunning = true;
        circuit.step();
        const vCap = readCapVoltage(circuit, capacitor);
        const iCap = circuit.lastResults?.currents?.get('C1') || 0;
        expect(vCap).toBeCloseTo(vExpected, 6);
        expect(iCap).toBeCloseTo(iExpected, 6);
        circuit.isRunning = false;
    });
```

**Step 2: Run test to verify behavior**

Run: `npm test -- tests/solver.dynamicIntegration.spec.js`  
Expected: all tests pass. If any fail, capture the failure and stop.

**Step 3: Minimal implementation (if needed)**

No production code changes expected. If a new test fails due to solver behavior, stop and report before changing code.

**Step 4: Re-run tests**

Run: `npm test -- tests/solver.dynamicIntegration.spec.js`  
Expected: PASS

**Step 5: Commit**

```bash
git add /Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/tests/solver.dynamicIntegration.spec.js
git commit -m "test: add dynamic misuse cases"
```

---

### Task 3: Full Test Pass

**Files:**
- Test: `npm test`

**Step 1: Run full test suite**

Run: `npm test`  
Expected: all tests pass (known warnings about `--localstorage-file` are acceptable).

**Step 2: Commit (if needed)**

Only if additional changes were made during fixes:

```bash
git add /Users/lvxiaoer/Documents/HighSchoolCircuitSimulation
git commit -m "test: fix misuse test expectations"
```
