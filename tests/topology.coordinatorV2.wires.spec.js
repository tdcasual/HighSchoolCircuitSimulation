import { describe, expect, it } from 'vitest';
import { createComponent } from '../src/components/Component.js';
import { Circuit } from '../src/core/runtime/Circuit.js';
import { getTerminalWorldPosition } from '../src/utils/TerminalGeometry.js';
import { TopologyCoordinatorV2 } from '../src/v2/app/coordinators/TopologyCoordinatorV2.js';
import { solveCircuitV2, normalizeComponent } from '../src/v2/simulation/SolveCircuitV2.js';
import { snapshotCircuitModel } from '../src/v2/simulation/snapshotCircuitModel.js';
import { SimulationStateV2 } from '../src/v2/simulation/SimulationStateV2.js';
import { connectWire, createTestCircuit, solveCircuit } from './helpers/circuitTestUtils.js';

function resolveTerminalWorldPosition(_componentId, terminalIndex, comp) {
    return getTerminalWorldPosition(comp, terminalIndex);
}

function addWiredComponent(circuit, type, id, props, position) {
    const component = createComponent(type, position.x, position.y, id);
    Object.assign(component, props);
    delete component.nodes;
    circuit.addComponent(component);
    return component;
}

function connectByTerminals(circuit, id, startId, startTerminal, endId, endTerminal) {
    return connectWire(circuit, id, startId, startTerminal, endId, endTerminal);
}

function buildV2Netlist(circuit) {
    const snapshot = snapshotCircuitModel(circuit);
    for (const component of snapshot.components) {
        expect(component.nodes).toBeUndefined();
    }
    const coordinator = new TopologyCoordinatorV2();
    return {
        snapshot,
        netlist: coordinator.buildNetlist(snapshot, {
            getTerminalWorldPosition: resolveTerminalWorldPosition
        })
    };
}

function netlistComponent(netlist, id) {
    return netlist.components.find((item) => item.id === id);
}

function relativeError(actual, expected) {
    const denom = Math.max(Math.abs(expected), 1e-12);
    return Math.abs(Number(actual) - Number(expected)) / denom;
}

describe('TopologyCoordinatorV2 wire-aware union-find', () => {
    it('assigns the same node indices as live NodeBuilder for a wire-only source+resistor', () => {
        const circuit = createTestCircuit();
        addWiredComponent(circuit, 'PowerSource', 'V1', {
            voltage: 12,
            internalResistance: 0
        }, { x: 100, y: 100 });
        addWiredComponent(circuit, 'Resistor', 'R1', {
            resistance: 100
        }, { x: 300, y: 100 });
        connectByTerminals(circuit, 'W1', 'V1', 0, 'R1', 0);
        connectByTerminals(circuit, 'W2', 'V1', 1, 'R1', 1);

        const production = solveCircuit(circuit);
        expect(production.valid).toBe(true);
        expect(production.currents.get('R1')).toBeCloseTo(0.12, 6);

        const { netlist } = buildV2Netlist(circuit);
        const liveV1 = circuit.getComponent('V1');
        const liveR1 = circuit.getComponent('R1');
        expect(netlistComponent(netlist, 'V1').nodes).toEqual(liveV1.nodes);
        expect(netlistComponent(netlist, 'R1').nodes).toEqual(liveR1.nodes);
        expect(liveV1.nodes).toContain(0);
        expect(liveR1.nodes).toContain(0);

        const v2 = solveCircuitV2(netlist, new SimulationStateV2(), { dt: 0.01 });
        expect(v2.valid).toBe(true);
        expect(relativeError(v2.currents.get('R1'), production.currents.get('R1'))).toBeLessThanOrEqual(1e-6);
        expect(v2.currents.get('R1')).toBeCloseTo(0.12, 6);
    });

    it('does not merge two disconnected resistors onto one node', () => {
        const circuit = createTestCircuit();
        addWiredComponent(circuit, 'Resistor', 'R1', { resistance: 10 }, { x: 0, y: 0 });
        addWiredComponent(circuit, 'Resistor', 'R2', { resistance: 20 }, { x: 400, y: 200 });

        const { netlist } = buildV2Netlist(circuit);
        const r1Nodes = netlistComponent(netlist, 'R1').nodes;
        const r2Nodes = netlistComponent(netlist, 'R2').nodes;
        expect(r1Nodes).toEqual([-1, -1]);
        expect(r2Nodes).toEqual([-1, -1]);

        const v2 = solveCircuitV2(netlist, new SimulationStateV2(), { dt: 0.01 });
        expect(v2.currents.get('R1') || 0).toBeCloseTo(0, 6);
        expect(v2.currents.get('R2') || 0).toBeCloseTo(0, 6);
    });

    it('keeps a one-sided-open resistor as [n, -1] and does not stamp G to ground', () => {
        const circuit = createTestCircuit();
        addWiredComponent(circuit, 'Ground', 'GND', {}, { x: 100, y: 220 });
        addWiredComponent(circuit, 'PowerSource', 'V1', {
            voltage: 12,
            internalResistance: 0
        }, { x: 100, y: 100 });
        addWiredComponent(circuit, 'Resistor', 'R1', { resistance: 100 }, { x: 300, y: 100 });
        connectByTerminals(circuit, 'Wg', 'V1', 1, 'GND', 0);
        connectByTerminals(circuit, 'W1', 'V1', 0, 'R1', 0);

        const { netlist } = buildV2Netlist(circuit);
        const r1 = netlistComponent(netlist, 'R1');
        expect(r1.nodes).toHaveLength(2);
        expect(r1.nodes[0]).toBeGreaterThanOrEqual(0);
        expect(r1.nodes[1]).toBe(-1);
        expect(r1.nodes).toEqual(circuit.getComponent('R1').nodes);

        const normalized = normalizeComponent(r1, 0);
        expect(normalized.nodes).toEqual(r1.nodes);
        expect(normalized.nodes).toHaveLength(2);
        expect(normalized.nodes[1]).toBe(-1);

        const v2 = solveCircuitV2(netlist, new SimulationStateV2(), { dt: 0.01 });
        expect(v2.currents.get('R1') || 0).toBeCloseTo(0, 6);
        expect(v2.currents.get('V1') || 0).toBeCloseTo(0, 6);
    });

    it('unions two non-touching Ground symbols onto node 0', () => {
        const circuit = createTestCircuit();
        addWiredComponent(circuit, 'Ground', 'GND1', {}, { x: 100, y: 220 });
        addWiredComponent(circuit, 'Ground', 'GND2', {}, { x: 500, y: 220 });
        addWiredComponent(circuit, 'PowerSource', 'V1', {
            voltage: 10,
            internalResistance: 0
        }, { x: 100, y: 100 });
        addWiredComponent(circuit, 'Resistor', 'R1', { resistance: 10 }, { x: 300, y: 100 });
        connectByTerminals(circuit, 'Wg', 'V1', 1, 'GND1', 0);
        connectByTerminals(circuit, 'W1', 'V1', 0, 'R1', 0);
        connectByTerminals(circuit, 'W2', 'R1', 1, 'GND1', 0);

        const production = solveCircuit(circuit);
        expect(production.valid).toBe(true);
        expect(circuit.getComponent('GND1').nodes[0]).toBe(0);
        expect(circuit.getComponent('GND2').nodes[0]).toBe(0);

        const { netlist } = buildV2Netlist(circuit);
        expect(netlistComponent(netlist, 'GND1').nodes).toEqual(circuit.getComponent('GND1').nodes);
        expect(netlistComponent(netlist, 'GND2').nodes).toEqual(circuit.getComponent('GND2').nodes);
        expect(netlistComponent(netlist, 'GND1').nodes[0]).toBe(0);
        expect(netlistComponent(netlist, 'GND2').nodes[0]).toBe(0);
    });

    it('emits slider-only instead of collapsing it into none', () => {
        const circuit = createTestCircuit();
        addWiredComponent(circuit, 'Ground', 'GND', {}, { x: 100, y: 220 });
        addWiredComponent(circuit, 'PowerSource', 'V1', {
            voltage: 6,
            internalResistance: 0
        }, { x: 100, y: 100 });
        addWiredComponent(circuit, 'Rheostat', 'RH1', {
            minResistance: 0,
            maxResistance: 100,
            position: 0.5
        }, { x: 300, y: 100 });
        connectByTerminals(circuit, 'Wg', 'V1', 1, 'GND', 0);
        connectByTerminals(circuit, 'Ws', 'V1', 0, 'RH1', 2);

        const { netlist } = buildV2Netlist(circuit);
        expect(netlistComponent(netlist, 'RH1').params.connectionMode).toBe('slider-only');
    });

    it('omits live node and measurement fields from snapshots', () => {
        const circuit = new Circuit();
        addWiredComponent(circuit, 'Resistor', 'R1', { resistance: 8 }, { x: 40, y: 40 });
        circuit.getComponent('R1').currentValue = 0.3;
        circuit.getComponent('R1').nodes = [1, 0];
        circuit.getComponent('R1').vsIndex = 4;

        const snapshot = snapshotCircuitModel(circuit);
        expect(snapshot.components[0].nodes).toBeUndefined();
        expect(snapshot.components[0].currentValue).toBeUndefined();
        expect(snapshot.components[0].vsIndex).toBeUndefined();
        expect(snapshot.components[0].resistance).toBe(8);
        expect(snapshot.wires).toEqual([]);
    });
});
