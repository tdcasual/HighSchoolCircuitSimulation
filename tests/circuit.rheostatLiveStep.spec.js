import { describe, expect, it } from 'vitest';
import { getTerminalWorldPosition } from '../src/utils/TerminalGeometry.js';
import { addComponent, connectWire, createTestCircuit } from './helpers/circuitTestUtils.js';

describe('Rheostat live Circuit.step', () => {
    it('updates current on the next step after slider position changes', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 12,
            internalResistance: 0
        });
        const rheo = addComponent(circuit, 'Rheostat', 'Rh1', {
            minResistance: 0,
            maxResistance: 100,
            position: 0.5
        });
        connectWire(circuit, 'W1', source, 0, rheo, 0);
        connectWire(circuit, 'W2', rheo, 2, source, 1);

        circuit.isRunning = true;
        circuit.step();
        expect(circuit.lastResults?.valid).toBe(true);
        expect(circuit.lastResults.currents.get('Rh1')).toBeCloseTo(0.24, 4);

        rheo.position = 0.25;
        const sliderPos = getTerminalWorldPosition(rheo, 2);
        const sliderWire = circuit.getWire('W2');
        sliderWire.a = { x: sliderPos.x, y: sliderPos.y };
        circuit.markSolverCircuitDirty();
        circuit.step();
        expect(circuit.lastResults?.valid).toBe(true);
        expect(circuit.lastResults.currents.get('Rh1')).toBeCloseTo(0.48, 4);
        circuit.isRunning = false;
    });
});
