import { Circuit } from '../../src/core/runtime/Circuit.js';
import { createComponent } from '../../src/components/Component.js';
import { getTerminalWorldPosition } from '../../src/utils/TerminalGeometry.js';
import { MNASolver } from '../../src/core/simulation/MNASolver.js';
import { createInjectedSolverBackend } from '../../src/v2/app/createInjectedSolverBackend.js';
import { resolveComponentViewRecord } from '../../src/utils/componentViewRecord.js';

export function createTestCircuit() {
    const circuit = new Circuit();
    // Deterministic, non-overlapping placement for tests (avoid accidental coordinate-based connections).
    circuit.__testPlacementIndex = 0;
    circuit.solver = new MNASolver();
    circuit.solverBackend = createInjectedSolverBackend();
    return circuit;
}

export function getTestSolver(circuit) {
    if (!circuit.solver || typeof circuit.solver.solve !== 'function') {
        circuit.solver = new MNASolver();
    }
    return circuit.solver;
}

export function stepV1(circuit) {
    const solver = getTestSolver(circuit);
    if (circuit.simulationState && typeof solver.setSimulationState === 'function') {
        solver.setSimulationState(circuit.simulationState);
    }
    solver.setCircuit(Array.from(circuit.components.values()), circuit.nodes);
    const dt = Number.isFinite(circuit.dt) && circuit.dt > 0 ? circuit.dt : 0.01;
    const simTime = Number.isFinite(circuit.simTime) ? circuit.simTime : 0;
    const results = solver.solve(dt, simTime);
    circuit.lastResults = results;
    if (results?.valid && typeof solver.updateDynamicComponents === 'function') {
        solver.updateDynamicComponents(results.voltages, results.currents);
        circuit.simTime = simTime + dt;
    }
    return results;
}

export function viewOf(circuit, idOrComp) {
    const id = typeof idOrComp === 'string' ? idOrComp : idOrComp?.id;
    const comp = (id !== undefined && circuit.components?.get?.(id)) || idOrComp;
    return resolveComponentViewRecord(comp, circuit.lastResults?.viewMap);
}

export function addComponent(circuit, type, id, props = {}, position = null) {
    const idx = Number.isFinite(circuit.__testPlacementIndex) ? circuit.__testPlacementIndex : 0;
    circuit.__testPlacementIndex = idx + 1;

    const spacingX = 220;
    const spacingY = 180;
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    const x = position?.x ?? col * spacingX;
    const y = position?.y ?? row * spacingY;

    const component = createComponent(type, x, y, id);
    Object.assign(component, props);
    circuit.addComponent(component);
    return component;
}

export function connectWire(circuit, id, startComponent, startTerminalIndex, endComponent, endTerminalIndex) {
    const startComp = typeof startComponent === 'string' ? circuit.getComponent(startComponent) : startComponent;
    const endComp = typeof endComponent === 'string' ? circuit.getComponent(endComponent) : endComponent;
    if (!startComp || !endComp) {
        throw new Error('connectWire: start/end component not found');
    }

    const aPos = getTerminalWorldPosition(startComp, startTerminalIndex);
    const bPos = getTerminalWorldPosition(endComp, endTerminalIndex);
    if (!aPos || !bPos) {
        throw new Error('connectWire: invalid terminal positions');
    }
    const wire = {
        id,
        a: { x: aPos.x, y: aPos.y },
        b: { x: bPos.x, y: bPos.y }
    };
    circuit.addWire(wire);
    return wire;
}

export function solveCircuit(circuit, simTime = 0) {
    const solver = circuit.solver || new MNASolver();
    solver.setCircuit(
        Array.from(circuit.components.values()),
        circuit.nodes
    );
    return solver.solve(circuit.dt, simTime);
}
