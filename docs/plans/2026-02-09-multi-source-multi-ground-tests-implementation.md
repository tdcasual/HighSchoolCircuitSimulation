# Multi-Source / Multi-Ground Tests Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add deterministic C-group tests covering multi-source and multi-ground topologies without changing solver behavior.

**Architecture:** New solver test file with four linear, closed-form scenarios using existing test helpers. Assertions focus on node voltages, branch currents, and ground selection to keep behavior stable.

**Tech Stack:** Vitest, existing circuit test helpers (`createTestCircuit`, `addComponent`, `connectWire`, `solveCircuit`).

---

### Task 1: Parallel sources with internal resistance + shared load

**Files:**
- Create: `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/.worktrees/codex/multi-source-multi-ground/tests/solver.multiSourceMultiGround.spec.js`

**Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { addComponent, connectWire, createTestCircuit, solveCircuit } from './helpers/circuitTestUtils.js';

describe('Solver multi-source / multi-ground cases', () => {
    it('solves parallel sources with internal resistance and shared load', () => {
        const circuit = createTestCircuit();
        const v1 = addComponent(circuit, 'PowerSource', 'V1', { voltage: 12, internalResistance: 1 });
        const v2 = addComponent(circuit, 'PowerSource', 'V2', { voltage: 6, internalResistance: 1 });
        const load = addComponent(circuit, 'Resistor', 'R1', { resistance: 6 });

        connectWire(circuit, 'Wpos', v1, 0, v2, 0);
        connectWire(circuit, 'Wneg', v1, 1, v2, 1);
        connectWire(circuit, 'Wload', v1, 0, load, 0);
        connectWire(circuit, 'Wreturn', load, 1, v1, 1);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);

        const expectedV = (12 / 1 + 6 / 1) / (1 / 1 + 1 / 1 + 1 / 6);
        const vTerminal = (results.voltages[v1.nodes[0]] || 0) - (results.voltages[v1.nodes[1]] || 0);
        expect(vTerminal).toBeCloseTo(expectedV, 6);

        const iLoad = results.currents.get('R1') || 0;
        expect(iLoad).toBeCloseTo(expectedV / 6, 6);

        const i1 = results.currents.get('V1') || 0;
        const i2 = results.currents.get('V2') || 0;
        expect(i1 + i2).toBeCloseTo(iLoad, 6);
    });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/solver.multiSourceMultiGround.spec.js`
Expected: FAIL if any of the assertions reveal a gap; if it passes, proceed to next task.

**Step 3: Adjust expectations if needed**

If the test fails, correct the expected values/indices (not solver code) to match the analytic solution and rerun.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/solver.multiSourceMultiGround.spec.js`
Expected: PASS

**Step 5: Commit**

```bash
git add /Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/.worktrees/codex/multi-source-multi-ground/tests/solver.multiSourceMultiGround.spec.js
git commit -m "test: add parallel internal-resistance sources case"
```

---

### Task 2: Series sources with midpoint ground

**Files:**
- Modify: `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/.worktrees/codex/multi-source-multi-ground/tests/solver.multiSourceMultiGround.spec.js`

**Step 1: Write the failing test**

```js
    it('uses midpoint ground for series sources and resolves signed node voltages', () => {
        const circuit = createTestCircuit();
        const ground = addComponent(circuit, 'Ground', 'GND');
        const v1 = addComponent(circuit, 'PowerSource', 'V1', { voltage: 5, internalResistance: 0 });
        const v2 = addComponent(circuit, 'PowerSource', 'V2', { voltage: 7, internalResistance: 0 });
        const load = addComponent(circuit, 'Resistor', 'R1', { resistance: 6 });

        connectWire(circuit, 'Wg', v1, 1, ground, 0);
        connectWire(circuit, 'Wseries', v1, 0, v2, 1);
        connectWire(circuit, 'WloadTop', v2, 0, load, 0);
        connectWire(circuit, 'WloadReturn', load, 1, ground, 0);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);
        expect(ground.nodes[0]).toBe(0);

        const vTop = results.voltages[v2.nodes[0]] || 0;
        const vMid = results.voltages[v1.nodes[1]] || 0;
        expect(vMid).toBeCloseTo(0, 6);
        expect(vTop).toBeCloseTo(12, 6);

        const iLoad = results.currents.get('R1') || 0;
        expect(iLoad).toBeCloseTo(12 / 6, 6);
    });
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/solver.multiSourceMultiGround.spec.js`
Expected: FAIL if any assertion reveals a gap; if it passes, proceed.

**Step 3: Adjust expectations if needed**

Fix expected values if the circuit orientation differs.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/solver.multiSourceMultiGround.spec.js`
Expected: PASS

**Step 5: Commit**

```bash
git add /Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/.worktrees/codex/multi-source-multi-ground/tests/solver.multiSourceMultiGround.spec.js
git commit -m "test: add series sources with midpoint ground case"
```

---

### Task 3: Multiple grounds on the same node

**Files:**
- Modify: `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/.worktrees/codex/multi-source-multi-ground/tests/solver.multiSourceMultiGround.spec.js`

**Step 1: Write the failing test**

```js
    it('assigns node 0 to multiple grounds tied to the same node', () => {
        const circuit = createTestCircuit();
        const g1 = addComponent(circuit, 'Ground', 'GND1');
        const g2 = addComponent(circuit, 'Ground', 'GND2');
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 9, internalResistance: 0 });
        const load = addComponent(circuit, 'Resistor', 'R1', { resistance: 9 });

        connectWire(circuit, 'Wg1', source, 1, g1, 0);
        connectWire(circuit, 'Wg2', g1, 0, g2, 0);
        connectWire(circuit, 'W1', source, 0, load, 0);
        connectWire(circuit, 'W2', load, 1, g1, 0);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);
        expect(g1.nodes[0]).toBe(0);
        expect(g2.nodes[0]).toBe(0);

        const iLoad = results.currents.get('R1') || 0;
        expect(iLoad).toBeCloseTo(1, 6);
    });
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/solver.multiSourceMultiGround.spec.js`
Expected: FAIL if any assertion reveals a gap; if it passes, proceed.

**Step 3: Adjust expectations if needed**

Ensure ground wiring is correct if node indices are unexpected.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/solver.multiSourceMultiGround.spec.js`
Expected: PASS

**Step 5: Commit**

```bash
git add /Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/.worktrees/codex/multi-source-multi-ground/tests/solver.multiSourceMultiGround.spec.js
git commit -m "test: add multi-ground same-node case"
```

---

### Task 4: Ground in a floating subcircuit

**Files:**
- Modify: `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/.worktrees/codex/multi-source-multi-ground/tests/solver.multiSourceMultiGround.spec.js`

**Step 1: Write the failing test**

```js
    it('keeps floating ground from becoming the global reference', () => {
        const circuit = createTestCircuit();
        const gMain = addComponent(circuit, 'Ground', 'GMAIN');
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 10, internalResistance: 0 });
        const load = addComponent(circuit, 'Resistor', 'R1', { resistance: 10 });

        connectWire(circuit, 'Wg', source, 1, gMain, 0);
        connectWire(circuit, 'W1', source, 0, load, 0);
        connectWire(circuit, 'W2', load, 1, gMain, 0);

        const gFloat = addComponent(circuit, 'Ground', 'GFLOAT');
        const vFloat = addComponent(circuit, 'PowerSource', 'V2', { voltage: 4, internalResistance: 0 });
        const rFloat = addComponent(circuit, 'Resistor', 'R2', { resistance: 4 });

        connectWire(circuit, 'W3', vFloat, 1, gFloat, 0);
        connectWire(circuit, 'W4', vFloat, 0, rFloat, 0);
        connectWire(circuit, 'W5', rFloat, 1, gFloat, 0);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);
        expect(gMain.nodes[0]).toBe(0);
        expect(gFloat.nodes[0]).not.toBe(0);

        const iMain = results.currents.get('R1') || 0;
        const iFloat = results.currents.get('R2') || 0;
        expect(iMain).toBeCloseTo(1, 6);
        expect(iFloat).toBeCloseTo(1, 6);
    });
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/solver.multiSourceMultiGround.spec.js`
Expected: FAIL if any assertion reveals a gap; if it passes, proceed.

**Step 3: Adjust expectations if needed**

Fix node expectations if required by wiring.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/solver.multiSourceMultiGround.spec.js`
Expected: PASS

**Step 5: Commit**

```bash
git add /Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/.worktrees/codex/multi-source-multi-ground/tests/solver.multiSourceMultiGround.spec.js
git commit -m "test: add floating ground subcircuit case"
```

---

### Task 5: Full verification

**Files:**
- Test: `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/.worktrees/codex/multi-source-multi-ground/tests/solver.multiSourceMultiGround.spec.js`

**Step 1: Run targeted suite**

Run: `npm test -- tests/solver.multiSourceMultiGround.spec.js`
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
git add /Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/.worktrees/codex/multi-source-multi-ground/tests/solver.multiSourceMultiGround.spec.js
git commit -m "test: add multi-source multi-ground cases"
```
