import { Circuit } from '../../src/engine/Circuit.js';
import { createComponent } from '../../src/components/Component.js';

export function createTestCircuit() {
    return new Circuit();
}

export function addComponent(circuit, type, id, props = {}) {
    const component = createComponent(type, 0, 0, id);
    Object.assign(component, props);
    circuit.addComponent(component);
    return component;
}

export function connectWire(circuit, id, startComponent, startTerminalIndex, endComponent, endTerminalIndex) {
    const startId = typeof startComponent === 'string' ? startComponent : startComponent.id;
    const endId = typeof endComponent === 'string' ? endComponent : endComponent.id;
    const wire = {
        id,
        startComponentId: startId,
        startTerminalIndex,
        endComponentId: endId,
        endTerminalIndex,
        controlPoints: []
    };
    circuit.addWire(wire);
    return wire;
}

export function solveCircuit(circuit) {
    circuit.solver.setCircuit(
        Array.from(circuit.components.values()),
        circuit.nodes
    );
    return circuit.solver.solve(circuit.dt);
}
