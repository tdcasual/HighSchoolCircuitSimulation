import { describe, expect, it, vi } from 'vitest';
import { addComponent, connectWire, createTestCircuit } from './helpers/circuitTestUtils.js';

describe('Circuit connectivity cache', () => {
    it('refreshes cached connectivity when topology changes', () => {
        const circuit = createTestCircuit();
        const resistor = addComponent(circuit, 'Resistor', 'R1');

        expect(circuit.isComponentConnected('R1')).toBe(false);
        expect(resistor._connectionTopologyVersion).toBe(circuit.topologyVersion);
        expect(resistor._isConnectedCached).toBe(false);

        connectWire(circuit, 'W1', resistor, 0, resistor, 1);
        expect(resistor._connectionTopologyVersion).toBe(circuit.topologyVersion);
        expect(resistor._isConnectedCached).toBe(true);
        expect(circuit.isComponentConnected('R1')).toBe(true);

        circuit.removeWire('W1');
        expect(resistor._connectionTopologyVersion).toBe(circuit.topologyVersion);
        expect(resistor._isConnectedCached).toBe(false);
        expect(circuit.isComponentConnected('R1')).toBe(false);
    });

    it('reuses cached connectivity when topology version is unchanged', () => {
        const circuit = createTestCircuit();
        const resistor = addComponent(circuit, 'Resistor', 'R1');
        connectWire(circuit, 'W1', resistor, 0, resistor, 1);

        const computeSpy = vi.spyOn(circuit, 'computeComponentConnectedState');
        const first = circuit.isComponentConnected('R1');
        const second = circuit.isComponentConnected('R1');

        expect(first).toBe(true);
        expect(second).toBe(true);
        expect(computeSpy).not.toHaveBeenCalled();

        resistor._connectionTopologyVersion = -1;
        circuit.isComponentConnected('R1');
        expect(computeSpy).toHaveBeenCalledTimes(1);
    });
});
