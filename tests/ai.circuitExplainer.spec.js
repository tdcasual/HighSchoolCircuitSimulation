import { describe, expect, it } from 'vitest';
import { CircuitExplainer } from '../src/ai/CircuitExplainer.js';
import { addComponent, connectWire, createTestCircuit } from './helpers/circuitTestUtils.js';

describe('CircuitExplainer ViewMap overlay', () => {
    it('prefers lastResults.viewMap including a true-zero current over stale live fields', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 3, internalResistance: 2 });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 8 });
        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, source, 1);

        resistor.voltageValue = 9;
        resistor.currentValue = 9;
        resistor.powerValue = 9;
        circuit.lastResults = {
            valid: true,
            backendUsed: 'v2',
            viewMap: new Map([
                ['R1', { currentValue: 0, voltageValue: 0, powerValue: 0 }]
            ])
        };

        const text = new CircuitExplainer(circuit).extractCircuitState({ concise: false });
        expect(text).toContain('电流 0.000A');
        expect(text).toContain('电压 0.000V');
        expect(text).not.toContain('电流 9.000A');
    });
});
