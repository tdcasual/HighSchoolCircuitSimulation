import { describe, expect, it, vi } from 'vitest';
import { FailureCategories } from '../src/core/simulation/FailureDiagnostics.js';
import { Circuit } from '../src/engine/Circuit.js';
import { addComponent, connectWire, createTestCircuit } from './helpers/circuitTestUtils.js';

describe('Circuit runtime diagnostics guard rails', () => {
    it('delegates runtime diagnostics attachment to diagnostics adapter', () => {
        const diagnostics = {
            code: 'manual-diag',
            fatal: false,
            hints: []
        };
        const diagnosticsAdapter = {
            build: vi.fn(() => diagnostics),
            attach: vi.fn((target, payload) => {
                target.runtimeDiagnostics = payload?.diagnostics || diagnostics;
                return target.runtimeDiagnostics;
            })
        };
        const persistenceAdapter = {
            loadSolverDebugFlag: vi.fn(() => false),
            saveSolverDebugFlag: vi.fn(() => true)
        };
        const circuit = new Circuit({
            diagnosticsAdapter,
            persistenceAdapter
        });
        circuit.lastResults = {
            valid: false,
            voltages: [],
            currents: new Map()
        };

        const attached = circuit.attachRuntimeDiagnostics(circuit.lastResults, 0);

        expect(diagnosticsAdapter.build).toHaveBeenCalledTimes(1);
        expect(diagnosticsAdapter.attach).toHaveBeenCalledTimes(1);
        expect(attached).toBe(diagnostics);
        expect(circuit.lastResults.runtimeDiagnostics).toBe(diagnostics);
    });

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
