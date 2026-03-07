import { describe, expect, it, vi } from 'vitest';
import { CircuitTopologyService } from '../src/core/services/CircuitTopologyService.js';
import { getTerminalWorldPosition } from '../src/utils/TerminalGeometry.js';
import { addComponent, connectWire, createTestCircuit } from './helpers/circuitTestUtils.js';

describe('CircuitTopologyService', () => {
    it('rebuilds nodes and increments topologyVersion exactly once per request', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 3, internalResistance: 2 });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 8 });
        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, source, 1);

        const service = new CircuitTopologyService();
        const refreshSpy = vi.spyOn(circuit, 'refreshComponentConnectivityCache');
        const startVersion = circuit.topologyVersion;

        service.rebuild(circuit);

        expect(circuit.topologyVersion).toBe(startVersion + 1);
        expect(refreshSpy).toHaveBeenCalledTimes(1);
        expect(circuit.nodes.length).toBeGreaterThan(0);
        expect(circuit.solverCircuitDirty).toBe(true);
    });

    it('merges a visually continuous segmented wire path into one electrical node during rebuild', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 3, internalResistance: 2 }, { x: 0, y: 0 });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 8 }, { x: 220, y: 0 });

        const sourceTerminal = getTerminalWorldPosition(source, 0);
        const resistorTerminal = getTerminalWorldPosition(resistor, 0);
        const junction = {
            x: Math.round((sourceTerminal.x + resistorTerminal.x) / 2),
            y: sourceTerminal.y
        };

        circuit.addWire({
            id: 'W1',
            a: { x: -999, y: -999 },
            b: { x: junction.x, y: junction.y },
            aRef: { componentId: 'V1', terminalIndex: 0 }
        });
        circuit.addWire({
            id: 'W2',
            a: { x: junction.x, y: junction.y },
            b: { x: 999, y: 999 },
            bRef: { componentId: 'R1', terminalIndex: 0 }
        });

        const service = new CircuitTopologyService();
        service.rebuild(circuit);

        expect(circuit.getWire('W1')?.a).toEqual({ x: sourceTerminal.x, y: sourceTerminal.y });
        expect(circuit.getWire('W2')?.b).toEqual({ x: resistorTerminal.x, y: resistorTerminal.y });
        expect(source.nodes[0]).toBeGreaterThanOrEqual(0);
        expect(resistor.nodes[0]).toBe(source.nodes[0]);
        expect(circuit.getWire('W1')?.nodeIndex).toBe(source.nodes[0]);
        expect(circuit.getWire('W2')?.nodeIndex).toBe(source.nodes[0]);
    });
});
