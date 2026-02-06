import { Circuit } from '../../src/engine/Circuit.js';
import { createComponent } from '../../src/components/Component.js';
import { getTerminalWorldPosition } from '../../src/utils/TerminalGeometry.js';

export function createTestCircuit() {
    const circuit = new Circuit();
    // Deterministic, non-overlapping placement for tests (avoid accidental coordinate-based connections).
    circuit.__testPlacementIndex = 0;
    return circuit;
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
    circuit.solver.setCircuit(
        Array.from(circuit.components.values()),
        circuit.nodes
    );
    return circuit.solver.solve(circuit.dt, simTime);
}
