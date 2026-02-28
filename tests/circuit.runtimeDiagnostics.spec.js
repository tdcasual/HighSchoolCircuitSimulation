import { describe, expect, it } from 'vitest';
import { FailureCategories } from '../src/core/simulation/FailureDiagnostics.js';
import { addComponent, connectWire, createTestCircuit } from './helpers/circuitTestUtils.js';

describe('Circuit runtime diagnostics guard rails', () => {
    it('attaches structured diagnostics when simulation step becomes invalid', () => {
        const circuit = createTestCircuit();
        circuit.dt = 0.01;

        const v1 = addComponent(circuit, 'PowerSource', 'V1', { voltage: 5, internalResistance: 0 });
        const v2 = addComponent(circuit, 'PowerSource', 'V2', { voltage: 9, internalResistance: 0 });

        connectWire(circuit, 'W1', v1, 0, v2, 0);
        connectWire(circuit, 'W2', v1, 1, v2, 1);

        circuit.isRunning = true;
        expect(() => circuit.step()).not.toThrow();
        circuit.isRunning = false;

        expect(circuit.lastResults?.valid).toBe(false);
        expect(circuit.lastResults?.runtimeDiagnostics).toBeTruthy();
        expect(circuit.lastResults.runtimeDiagnostics.code).toBe(FailureCategories.ConflictingSources);
        expect(circuit.lastResults.runtimeDiagnostics.fatal).toBe(true);
        expect(Array.isArray(circuit.lastResults.runtimeDiagnostics.hints)).toBe(true);
    });
});
