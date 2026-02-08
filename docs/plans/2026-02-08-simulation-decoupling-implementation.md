# Simulation Core Decoupling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Decouple runtime simulation state from component objects and centralize component behavior to reduce coupling while keeping behavior stable.

**Architecture:** Introduce `SimulationState` first (dual-write for compatibility), then migrate to a `ComponentRegistry` for behavior routing, and optionally add a Netlist adapter to isolate solver from geometry.

**Tech Stack:** ES modules (vanilla JS), Vitest, existing MNA solver.

---

Note: Execute this plan in a dedicated git worktree (use @superpowers:using-git-worktrees). Keep commits small and frequent.

## Phase 1: SimulationState (Low Risk)

### Task 1: Add SimulationState container

**Files:**
- Create: `src/core/simulation/SimulationState.js`
- Test: `tests/simulation.state.spec.js`

**Step 1: Write the failing test**

```js
import { describe, expect, it } from 'vitest';
import { SimulationState } from '../src/core/simulation/SimulationState.js';

describe('SimulationState', () => {
    it('resets dynamic defaults by component type', () => {
        const state = new SimulationState();
        const components = [
            { id: 'C1', type: 'Capacitor' },
            { id: 'L1', type: 'Inductor', initialCurrent: 0.2 },
            { id: 'M1', type: 'Motor' },
            { id: 'D1', type: 'Diode' },
            { id: 'RLY', type: 'Relay' }
        ];

        state.resetForComponents(components);

        const cap = state.get('C1');
        const ind = state.get('L1');
        const motor = state.get('M1');
        const diode = state.get('D1');
        const relay = state.get('RLY');

        expect(cap.prevVoltage).toBe(0);
        expect(cap.prevCharge).toBe(0);
        expect(cap.prevCurrent).toBe(0);
        expect(cap._dynamicHistoryReady).toBe(false);

        expect(ind.prevCurrent).toBeCloseTo(0.2, 6);
        expect(ind.prevVoltage).toBe(0);
        expect(ind._dynamicHistoryReady).toBe(false);

        expect(motor.speed).toBe(0);
        expect(motor.backEmf).toBe(0);

        expect(diode.conducting).toBe(false);
        expect(relay.energized).toBe(false);
    });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/simulation.state.spec.js`  
Expected: FAIL with "SimulationState is not a constructor" (or module not found).

**Step 3: Write minimal implementation**

```js
export class SimulationState {
    constructor() {
        this.byId = new Map();
    }

    get(id) {
        return this.byId.get(id);
    }

    ensure(id) {
        if (!this.byId.has(id)) {
            this.byId.set(id, {});
        }
        return this.byId.get(id);
    }

    resetForComponents(components = []) {
        for (const comp of components) {
            if (!comp || !comp.id) continue;
            const entry = this.ensure(comp.id);
            this.resetEntryForComponent(entry, comp);
        }
    }

    resetEntryForComponent(entry, comp) {
        switch (comp.type) {
            case 'Capacitor':
            case 'ParallelPlateCapacitor':
                entry.prevVoltage = 0;
                entry.prevCharge = 0;
                entry.prevCurrent = 0;
                entry._dynamicHistoryReady = false;
                break;
            case 'Inductor':
                entry.prevCurrent = Number.isFinite(comp.initialCurrent) ? comp.initialCurrent : 0;
                entry.prevVoltage = 0;
                entry._dynamicHistoryReady = false;
                break;
            case 'Motor':
                entry.speed = 0;
                entry.backEmf = 0;
                break;
            case 'Diode':
            case 'LED':
                entry.conducting = false;
                break;
            case 'Relay':
                entry.energized = false;
                break;
            default:
                break;
        }
    }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/simulation.state.spec.js`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/simulation/SimulationState.js tests/simulation.state.spec.js
git commit -m "Add SimulationState container"
```

### Task 2: Wire SimulationState into Circuit reset path

**Files:**
- Modify: `src/engine/Circuit.js`
- Test: `tests/circuit.simulationState.spec.js`

**Step 1: Write the failing test**

```js
import { describe, expect, it } from 'vitest';
import { Circuit } from '../src/engine/Circuit.js';
import { createComponent } from '../src/components/Component.js';

describe('Circuit simulation state reset', () => {
    it('resets state without starting timers', () => {
        const circuit = new Circuit();
        const cap = createComponent('Capacitor', 0, 0, 'C1');
        cap.nodes = [0, 1];
        circuit.addComponent(cap);

        circuit.resetSimulationState();

        const state = circuit.simulationState.get('C1');
        expect(state.prevVoltage).toBe(0);
        expect(state.prevCharge).toBe(0);
        expect(state._dynamicHistoryReady).toBe(false);
    });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/circuit.simulationState.spec.js`  
Expected: FAIL with "resetSimulationState is not a function".

**Step 3: Write minimal implementation**

```js
import { SimulationState } from '../core/simulation/SimulationState.js';

export class Circuit {
    constructor() {
        // ...existing fields...
        this.simulationState = new SimulationState();
    }

    resetSimulationState() {
        this.simulationState.resetForComponents(Array.from(this.components.values()));
    }

    startSimulation() {
        if (this.isRunning) return;
        // ...existing code...
        this.resetSimulationState();
        // ...existing code...
    }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/circuit.simulationState.spec.js`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/engine/Circuit.js tests/circuit.simulationState.spec.js
git commit -m "Add Circuit simulation state reset"
```

### Task 3: Update DynamicIntegrator to write SimulationState (dual-write)

**Files:**
- Modify: `src/core/simulation/DynamicIntegrator.js`
- Modify: `tests/simulation.dynamicIntegrator.spec.js`

**Step 1: Write the failing test**

```js
import { describe, expect, it } from 'vitest';
import { createComponent } from '../src/components/Component.js';
import { DynamicIntegrator } from '../src/core/simulation/DynamicIntegrator.js';
import { SimulationState } from '../src/core/simulation/SimulationState.js';

describe('DynamicIntegrator with SimulationState', () => {
    it('updates SimulationState and keeps component mirror', () => {
        const integrator = new DynamicIntegrator();
        const capacitor = createComponent('Capacitor', 0, 0, 'C1');
        capacitor.nodes = [0, 1];
        capacitor.capacitance = 0.001;
        capacitor.integrationMethod = 'backward-euler';

        const state = new SimulationState();
        const voltages = [5, 1];
        const currents = new Map([['C1', 0.1]]);

        integrator.updateDynamicComponents([capacitor], voltages, currents, 0.01, false, state);

        const entry = state.get('C1');
        expect(entry.prevVoltage).toBeCloseTo(4, 6);
        expect(entry.prevCharge).toBeCloseTo(0.004, 6);
        expect(entry.prevCurrent).toBeCloseTo(0.1, 6);
        expect(entry._dynamicHistoryReady).toBe(true);

        // Compatibility mirror
        expect(capacitor.prevVoltage).toBeCloseTo(4, 6);
    });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/simulation.dynamicIntegrator.spec.js`  
Expected: FAIL with "updateDynamicComponents(...) expects fewer arguments" or missing state updates.

**Step 3: Write minimal implementation**

```js
updateDynamicComponents(components, voltages, currents = null, dt = 0.001, hasConnectedSwitch = false, simulationState = null) {
    const list = Array.isArray(components) ? components : [];
    const nodeVoltages = Array.isArray(voltages) ? voltages : [];
    const isValidNode = (nodeIdx) => nodeIdx !== undefined && nodeIdx !== null && nodeIdx >= 0;

    for (const comp of list) {
        const entry = simulationState && comp?.id ? simulationState.ensure(comp.id) : null;

        if (comp.type === 'Capacitor' || comp.type === 'ParallelPlateCapacitor') {
            if (!comp.nodes || !isValidNode(comp.nodes[0]) || !isValidNode(comp.nodes[1])) continue;
            const v1 = nodeVoltages[comp.nodes[0]] || 0;
            const v2 = nodeVoltages[comp.nodes[1]] || 0;
            const v = v1 - v2;
            if (entry) {
                entry.prevVoltage = v;
                entry.prevCharge = (comp.capacitance || 0) * v;
            }
            const measuredCurrent = currents && typeof currents.get === 'function'
                ? currents.get(comp.id)
                : undefined;
            if (entry && Number.isFinite(measuredCurrent)) {
                entry.prevCurrent = measuredCurrent;
            }
            if (entry) entry._dynamicHistoryReady = true;

            // Dual-write for compatibility
            comp.prevVoltage = entry?.prevVoltage ?? comp.prevVoltage;
            comp.prevCharge = entry?.prevCharge ?? comp.prevCharge;
            if (Number.isFinite(entry?.prevCurrent)) comp.prevCurrent = entry.prevCurrent;
            comp._dynamicHistoryReady = entry?._dynamicHistoryReady ?? comp._dynamicHistoryReady;
        }

        // Repeat for Motor and Inductor with entry mirror
    }

    return { hasConnectedSwitch, method: DynamicIntegrationMethods };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/simulation.dynamicIntegrator.spec.js`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/simulation/DynamicIntegrator.js tests/simulation.dynamicIntegrator.spec.js
git commit -m "Write dynamic state to SimulationState"
```

### Task 4: Update Solver and ResultPostprocessor to read SimulationState

**Files:**
- Modify: `src/engine/Solver.js`
- Modify: `src/core/simulation/ResultPostprocessor.js`
- Test: `tests/solver.dynamicState.spec.js`

**Step 1: Write the failing test**

```js
import { describe, expect, it } from 'vitest';
import { Circuit } from '../src/engine/Circuit.js';
import { createComponent } from '../src/components/Component.js';

describe('Solver uses SimulationState', () => {
    it('stores diode conduction state in SimulationState', () => {
        const circuit = new Circuit();
        const diode = createComponent('Diode', 0, 0, 'D1');
        diode.nodes = [0, 1];
        diode.forwardVoltage = 0.7;
        diode.onResistance = 1;
        diode.offResistance = 1e9;

        circuit.addComponent(diode);
        circuit.rebuildNodes();
        circuit.resetSimulationState();

        circuit.solver.setCircuit([diode], circuit.nodes);
        circuit.solver.setSimulationState(circuit.simulationState);
        const result = circuit.solver.solve(0.01, 0);

        const entry = circuit.simulationState.get('D1');
        expect(result.valid).toBe(true);
        expect(entry.conducting).toBeTypeOf('boolean');
    });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/solver.dynamicState.spec.js`  
Expected: FAIL with "setSimulationState is not a function".

**Step 3: Write minimal implementation**

```js
// Solver.js
import { SimulationState } from '../core/simulation/SimulationState.js';

export class MNASolver {
    constructor() {
        // ...existing fields...
        this.simulationState = new SimulationState();
    }

    setSimulationState(state) {
        this.simulationState = state instanceof SimulationState ? state : this.simulationState;
    }

    // Pass state into ResultPostprocessor
    solve(dt = 0.001, simTime = 0) {
        // ...existing code...
        const { currents } = this.resultPostprocessor.apply({
            components: this.components,
            voltages,
            x,
            nodeCount,
            dt: this.dt,
            debugMode: this.debugMode,
            resolveDynamicIntegrationMethod: (component) => this.resolveDynamicIntegrationMethod(component),
            getSourceInstantVoltage: (component) => this.getSourceInstantVoltage(component),
            simulationState: this.simulationState
        });
        // ...existing code...
    }

    updateDynamicComponents(voltages, currents = null) {
        return this.dynamicIntegrator.updateDynamicComponents(
            this.components,
            voltages,
            currents,
            this.dt,
            this.hasConnectedSwitch,
            this.simulationState
        );
    }
}
```

```js
// ResultPostprocessor.js
apply({ components = [], voltages = [], x = [], nodeCount = 0, dt = 0.001, debugMode = false, resolveDynamicIntegrationMethod, getSourceInstantVoltage, simulationState } = {}) {
    const currents = new Map();
    for (const comp of components || []) {
        const current = this.calculateCurrent(comp, {
            voltages,
            x,
            nodeCount,
            dt,
            resolveDynamicIntegrationMethod,
            getSourceInstantVoltage,
            simulationState
        });
        currents.set(comp.id, current);
    }
    return { currents };
}

calculateCurrent(comp, context = {}) {
    const state = context.simulationState && comp?.id ? context.simulationState.get(comp.id) : null;
    // Use state.conducting for Diode/LED
    if (comp.type === 'Diode' || comp.type === 'LED') {
        const conducting = state ? !!state.conducting : !!comp.conducting;
        // ...use conducting in current computation...
    }
    // Repeat for Relay (energized), Motor (backEmf), Capacitor/Inductor prev values when needed
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/solver.dynamicState.spec.js`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/engine/Solver.js src/core/simulation/ResultPostprocessor.js tests/solver.dynamicState.spec.js
git commit -m "Route solver and postprocessor through SimulationState"
```

### Task 5: Keep UI compatibility via state-to-component sync

**Files:**
- Modify: `src/engine/Circuit.js`

**Step 1: Add compatibility sync helper**

```js
syncSimulationStateToComponents() {
    for (const comp of this.components.values()) {
        const entry = this.simulationState.get(comp.id);
        if (!entry) continue;
        if (comp.type === 'Diode' || comp.type === 'LED') {
            comp.conducting = !!entry.conducting;
        }
        if (comp.type === 'Relay') {
            comp.energized = !!entry.energized;
        }
        if (comp.type === 'Motor') {
            comp.backEmf = Number.isFinite(entry.backEmf) ? entry.backEmf : comp.backEmf;
            comp.speed = Number.isFinite(entry.speed) ? entry.speed : comp.speed;
        }
        if (comp.type === 'Capacitor' || comp.type === 'ParallelPlateCapacitor' || comp.type === 'Inductor') {
            if (Number.isFinite(entry.prevCurrent)) comp.prevCurrent = entry.prevCurrent;
            if (Number.isFinite(entry.prevVoltage)) comp.prevVoltage = entry.prevVoltage;
            if (Number.isFinite(entry.prevCharge)) comp.prevCharge = entry.prevCharge;
            if (typeof entry._dynamicHistoryReady === 'boolean') comp._dynamicHistoryReady = entry._dynamicHistoryReady;
        }
    }
}
```

**Step 2: Call it during simulation step**

```js
this.solver.updateDynamicComponents(substepResults.voltages, substepResults.currents);
this.syncSimulationStateToComponents();
```

**Step 3: Commit**

```bash
git add src/engine/Circuit.js
git commit -m "Sync SimulationState back to components for UI compatibility"
```

## Phase 2: ComponentRegistry (Medium Risk)

### Task 6: Create ComponentRegistry scaffold

**Files:**
- Create: `src/core/simulation/ComponentRegistry.js`
- Test: `tests/simulation.componentRegistry.spec.js`

**Step 1: Write the failing test**

```js
import { describe, expect, it } from 'vitest';
import { ComponentRegistry } from '../src/core/simulation/ComponentRegistry.js';

describe('ComponentRegistry', () => {
    it('returns handlers for known types', () => {
        const registry = new ComponentRegistry();
        registry.register('Resistor', { stamp: () => 'ok' });
        expect(registry.get('Resistor').stamp()).toBe('ok');
        expect(registry.get('Unknown')).toBe(null);
    });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/simulation.componentRegistry.spec.js`  
Expected: FAIL with module not found.

**Step 3: Write minimal implementation**

```js
export class ComponentRegistry {
    constructor() {
        this.byType = new Map();
    }

    register(type, handlers) {
        if (!type) return;
        this.byType.set(type, handlers || {});
    }

    get(type) {
        return this.byType.get(type) || null;
    }
}

export const DefaultComponentRegistry = new ComponentRegistry();
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/simulation.componentRegistry.spec.js`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/simulation/ComponentRegistry.js tests/simulation.componentRegistry.spec.js
git commit -m "Add ComponentRegistry scaffold"
```

### Task 7: Register Resistor/Bulb and route stamping

**Files:**
- Modify: `src/core/simulation/ComponentRegistry.js`
- Modify: `src/engine/Solver.js`

**Step 1: Write the failing test**

```js
import { describe, expect, it } from 'vitest';
import { DefaultComponentRegistry } from '../src/core/simulation/ComponentRegistry.js';

describe('ComponentRegistry stamping', () => {
    it('stamps resistor via registry', () => {
        const handler = DefaultComponentRegistry.get('Resistor');
        const calls = [];
        const context = {
            stampResistor: (i1, i2, r) => calls.push({ i1, i2, r })
        };

        handler.stamp({ resistance: 100 }, context, { i1: 0, i2: 1 });
        expect(calls).toEqual([{ i1: 0, i2: 1, r: 100 }]);
    });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/simulation.componentRegistry.spec.js`  
Expected: FAIL with "handler is null".

**Step 3: Write minimal implementation**

```js
import { computeNtcThermistorResistance, computePhotoresistorResistance } from '../../utils/Physics.js';

export const DefaultComponentRegistry = new ComponentRegistry();

DefaultComponentRegistry.register('Resistor', {
    stamp: (comp, context, nodes) => {
        context.stampResistor(nodes.i1, nodes.i2, comp.resistance);
    },
    current: (comp, context, nodes) => {
        const dV = context.voltage(nodes.n1) - context.voltage(nodes.n2);
        return comp.resistance > 0 ? dV / comp.resistance : 0;
    }
});

DefaultComponentRegistry.register('Bulb', DefaultComponentRegistry.get('Resistor'));
```

```js
// Solver.js (inside stampComponent)
const registry = this.componentRegistry || DefaultComponentRegistry;
const handler = registry.get(comp.type);
if (handler?.stamp) {
    handler.stamp(comp, {
        stampResistor: (i1, i2, r) => this.stampResistor(A, i1, i2, r)
    }, { i1, i2, n1, n2 });
    return;
}
// fallback to existing switch for non-migrated types
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/simulation.componentRegistry.spec.js`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/simulation/ComponentRegistry.js src/engine/Solver.js tests/simulation.componentRegistry.spec.js
git commit -m "Route Resistor/Bulb stamping through ComponentRegistry"
```

### Task 8: Route current calculation through registry

**Files:**
- Modify: `src/core/simulation/ResultPostprocessor.js`

**Step 1: Add registry-based current lookup**

```js
import { DefaultComponentRegistry } from './ComponentRegistry.js';

calculateCurrent(comp, context = {}) {
    const registry = context.registry || DefaultComponentRegistry;
    const handler = registry.get(comp.type);
    if (handler?.current) {
        return handler.current(comp, {
            voltage: (nodeIdx) => (nodeIdx === undefined || nodeIdx < 0 ? 0 : (context.voltages[nodeIdx] || 0))
        }, { n1: comp.nodes?.[0], n2: comp.nodes?.[1] });
    }
    // fallback to existing switch
}
```

**Step 2: Commit**

```bash
git add src/core/simulation/ResultPostprocessor.js
git commit -m "Use ComponentRegistry for current calculation where available"
```

### Task 9: Migrate dynamic components into registry (incremental)

**Files:**
- Modify: `src/core/simulation/ComponentRegistry.js`
- Modify: `src/engine/Solver.js` (remove migrated switch cases)
- Modify: `src/core/simulation/ResultPostprocessor.js` (remove migrated switch cases)

**Step 1: Add Capacitor/Inductor handlers**

```js
DefaultComponentRegistry.register('Capacitor', {
    stamp: (comp, context, nodes) => {
        const C = Math.max(1e-18, comp.capacitance || 0);
        const Req = context.dt / C;
        context.stampResistor(nodes.i1, nodes.i2, Req);
        const entry = context.state?.get(comp.id);
        const Ieq = (entry?.prevCharge || 0) / context.dt;
        context.stampCurrentSource(nodes.i1, nodes.i2, Ieq);
    },
    current: (comp, context, nodes) => {
        const dV = context.voltage(nodes.n1) - context.voltage(nodes.n2);
        return comp.capacitance > 0 ? dV / (context.dt / comp.capacitance) : 0;
    }
});

DefaultComponentRegistry.register('Inductor', {
    stamp: (comp, context, nodes) => {
        const L = Math.max(1e-12, comp.inductance || 0);
        const Req = L / context.dt;
        const entry = context.state?.get(comp.id);
        context.stampResistor(nodes.i1, nodes.i2, Req);
        context.stampCurrentSource(nodes.i1, nodes.i2, entry?.prevCurrent || 0);
    }
});
```

**Step 2: Remove corresponding switch branches**

```js
// Solver.js: remove or gate Capacitor/Inductor cases when registry handles them
if (handler?.stamp) { /* ... */ return; }
// ...existing switch now excludes migrated types
```

**Step 3: Commit**

```bash
git add src/core/simulation/ComponentRegistry.js src/engine/Solver.js src/core/simulation/ResultPostprocessor.js
git commit -m "Migrate Capacitor/Inductor behavior into ComponentRegistry"
```

## Phase 3: Netlist Adapter (Optional)

### Task 10: Add NetlistBuilder skeleton

**Files:**
- Create: `src/core/simulation/NetlistBuilder.js`
- Test: `tests/simulation.netlistBuilder.spec.js`

**Step 1: Write the failing test**

```js
import { describe, expect, it } from 'vitest';
import { NetlistBuilder } from '../src/core/simulation/NetlistBuilder.js';

describe('NetlistBuilder', () => {
    it('creates a netlist DTO', () => {
        const builder = new NetlistBuilder();
        const netlist = builder.build({ components: [], nodes: [] });
        expect(netlist).toEqual({ nodes: [], components: [] });
    });
});
```

**Step 2: Implement skeleton**

```js
export class NetlistBuilder {
    build({ components = [], nodes = [] } = {}) {
        return {
            nodes: Array.isArray(nodes) ? nodes : [],
            components: Array.isArray(components) ? components : []
        };
    }
}
```

**Step 3: Commit**

```bash
git add src/core/simulation/NetlistBuilder.js tests/simulation.netlistBuilder.spec.js
git commit -m "Add NetlistBuilder skeleton"
```

## Rollback Checklist

- `git log` and locate the commit range for the phase being rolled back.
- `git reset --hard <last-good-commit>` in the worktree only.
- `npm test` and `npm run baseline:p0` to confirm baseline stability.
- Remove any newly added files not present before rollback.
- Re-run `npm run baseline:circuitjs` if solver behavior was touched.

---

Plan complete and saved to `docs/plans/2026-02-08-simulation-decoupling-implementation.md`.

Two execution options:

1. Subagent-Driven (this session) - I dispatch fresh subagent per task, review between tasks, fast iteration
2. Parallel Session (separate) - Open new session with executing-plans, batch execution with checkpoints

Which approach?
