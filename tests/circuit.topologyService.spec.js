import { describe, expect, it, vi } from 'vitest';
import { CircuitTopologyService } from '../src/engine/services/CircuitTopologyService.js';
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
});
