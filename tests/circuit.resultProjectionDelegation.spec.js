import { describe, expect, it, vi } from 'vitest';
import { Circuit } from '../src/core/runtime/Circuit.js';

describe('Circuit result projection delegation', () => {
    it('delegates simulation result projection to the injected service during step', () => {
        const resultProjectionService = {
            applyStepResults: vi.fn(() => false)
        };
        const persistenceAdapter = {
            loadSolverDebugFlag: vi.fn(() => false),
            saveSolverDebugFlag: vi.fn(() => true)
        };
        const circuit = new Circuit({
            persistenceAdapter,
            resultProjectionService
        });
        const results = {
            valid: true,
            voltages: [5, 0],
            currents: new Map()
        };

        circuit.simulationLoopService = {
            runStep: vi.fn(() => ({
                lastResults: results,
                elapsedDt: 0.02,
                stepDt: 0.01
            }))
        };
        circuit.attachRuntimeDiagnostics = vi.fn();
        circuit.onUpdate = vi.fn();
        circuit.isRunning = true;

        circuit.step();

        expect(resultProjectionService.applyStepResults).toHaveBeenCalledWith(circuit, results, 0.02);
        expect(circuit.onUpdate).toHaveBeenCalledWith(results);
    });
});
