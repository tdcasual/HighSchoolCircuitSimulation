import { describe, expect, it } from 'vitest';
import { createComponent } from '../src/components/Component.js';
import { Circuit } from '../src/core/runtime/Circuit.js';
import { getTerminalWorldPosition } from '../src/utils/TerminalGeometry.js';
import { TopologyCoordinatorV2 } from '../src/v2/app/coordinators/TopologyCoordinatorV2.js';
import { solveCircuitV2, normalizeComponent } from '../src/v2/simulation/SolveCircuitV2.js';
import { snapshotCircuitModel } from '../src/v2/simulation/snapshotCircuitModel.js';
import { SimulationStateV2 } from '../src/v2/simulation/SimulationStateV2.js';
import { connectWire, createTestCircuit, solveCircuit } from './helpers/circuitTestUtils.js';

const SNAPSHOT_OMIT_KEYS = [
    'currentValue',
    'voltageValue',
    'powerValue',
    'brightness',
    'vsIndex',
    '_nortonModel',
    '_isShorted',
    'prevVoltage',
    'prevCharge',
    'prevCurrent',
    'junctionVoltage',
    'junctionCurrent',
    'nodes'
];

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

function buildV2Netlist(circuit, getTerminalWorldPositionOption = resolveTerminalWorldPosition) {
    const snapshot = snapshotCircuitModel(circuit);
    for (const component of snapshot.components) {
        expect(component.nodes).toBeUndefined();
    }
    const coordinator = new TopologyCoordinatorV2();
    return {
        snapshot,
        netlist: coordinator.buildNetlist(snapshot, {
            getTerminalWorldPosition: getTerminalWorldPositionOption
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

function placeRheostatFixture(circuit) {
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
    addWiredComponent(circuit, 'Resistor', 'R1', { resistance: 50 }, { x: 500, y: 100 });
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

    it('snaps non-integer wire and terminal points before union-find', () => {
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
        expect(production.currents.get('R1')).toBeCloseTo(0.12, 6);

        const snapshot = snapshotCircuitModel(circuit);
        for (const wire of snapshot.wires) {
            wire.a.x += 0.4;
            wire.a.y += 0.4;
            wire.b.x += 0.4;
            wire.b.y += 0.4;
        }

        const coordinator = new TopologyCoordinatorV2();
        const netlist = coordinator.buildNetlist(snapshot, {
            getTerminalWorldPosition: (_componentId, terminalIndex, comp) => {
                const pos = getTerminalWorldPosition(comp, terminalIndex);
                return { x: pos.x + 0.4, y: pos.y + 0.4 };
            }
        });

        expect(netlistComponent(netlist, 'V1').nodes).toEqual(circuit.getComponent('V1').nodes);
        expect(netlistComponent(netlist, 'R1').nodes).toEqual(circuit.getComponent('R1').nodes);

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
        expect(v2.currents.get('R1')).toBe(0);
        expect(v2.currents.get('R2')).toBe(0);
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
        expect(v2.currents.get('R1')).toBe(0);
        expect(v2.currents.get('V1')).toBeCloseTo(0, 6);
    });

    it('does not inject Norton current when a source terminal is disconnected', () => {
        const circuit = createTestCircuit();
        addWiredComponent(circuit, 'Ground', 'GND', {}, { x: 100, y: 220 });
        addWiredComponent(circuit, 'PowerSource', 'V1', {
            voltage: 12,
            internalResistance: 2
        }, { x: 100, y: 100 });
        addWiredComponent(circuit, 'Resistor', 'R1', { resistance: 100 }, { x: 300, y: 100 });
        connectByTerminals(circuit, 'W1', 'V1', 0, 'R1', 0);
        connectByTerminals(circuit, 'W2', 'R1', 1, 'GND', 0);

        const { netlist } = buildV2Netlist(circuit);
        expect(netlistComponent(netlist, 'V1').nodes[1]).toBe(-1);
        expect(netlistComponent(netlist, 'R1').nodes[1]).toBe(0);

        const v2 = solveCircuitV2(netlist, new SimulationStateV2(), { dt: 0.01 });
        expect(v2.currents.get('V1')).toBe(0);
        expect(v2.currents.get('R1')).toBe(0);
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

    it.each([
        { mode: 'none', wires: [] },
        {
            mode: 'left-right',
            wires: [
                ['V1', 0, 'RH1', 0],
                ['V1', 1, 'RH1', 1]
            ]
        },
        {
            mode: 'left-slider',
            wires: [
                ['V1', 0, 'RH1', 0],
                ['V1', 1, 'RH1', 2]
            ]
        },
        {
            mode: 'right-slider',
            wires: [
                ['V1', 0, 'RH1', 1],
                ['V1', 1, 'RH1', 2]
            ]
        },
        {
            mode: 'slider-only',
            wires: [
                ['V1', 0, 'RH1', 2],
                ['V1', 1, 'GND', 0]
            ]
        },
        {
            mode: 'all',
            wires: [
                ['V1', 0, 'RH1', 0],
                ['V1', 1, 'GND', 0],
                ['RH1', 1, 'R1', 0],
                ['R1', 1, 'GND', 0],
                ['RH1', 2, 'V1', 0]
            ]
        }
    ])('emits rheostat connectionMode $mode', ({ mode, wires }) => {
        const circuit = createTestCircuit();
        placeRheostatFixture(circuit);
        wires.forEach((link, index) => {
            connectByTerminals(circuit, `W${index}`, link[0], link[1], link[2], link[3]);
        });

        const { netlist } = buildV2Netlist(circuit);
        const rh = netlistComponent(netlist, 'RH1');
        expect(rh.params.connectionMode).toBe(mode);
        expect(circuit.getComponent('RH1').connectionMode).toBe(mode);
        expect(rh.nodes).toEqual(circuit.getComponent('RH1').nodes);

        if (mode === 'slider-only') {
            expect(rh.nodes).toHaveLength(3);
            expect(rh.nodes[0]).toBe(-1);
            expect(rh.nodes[1]).toBe(-1);
            expect(rh.nodes[2]).toBeGreaterThanOrEqual(0);
        }
    });

    it('omits every snapshot runtime field and copies topologyVersion', () => {
        const circuit = new Circuit();
        addWiredComponent(circuit, 'Resistor', 'R1', { resistance: 8 }, { x: 40, y: 40 });
        const live = circuit.getComponent('R1');
        Object.assign(live, {
            currentValue: 11,
            voltageValue: 12,
            powerValue: 13,
            brightness: 14,
            vsIndex: 15,
            _nortonModel: { i: 1 },
            _isShorted: true,
            prevVoltage: 16,
            prevCharge: 17,
            prevCurrent: 18,
            junctionVoltage: 19,
            junctionCurrent: 20,
            nodes: [3, 4]
        });

        const snapshot = snapshotCircuitModel(circuit);
        expect(Number.isInteger(snapshot.topologyVersion)).toBe(true);
        expect(snapshot.topologyVersion).toBe(circuit.topologyVersion);
        for (const key of SNAPSHOT_OMIT_KEYS) {
            expect(snapshot.components[0]).not.toHaveProperty(key);
        }
        expect(snapshot.components[0].resistance).toBe(8);
        expect(snapshot.wires).toEqual([]);
    });
});
