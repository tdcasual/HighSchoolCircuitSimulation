import { describe, expect, it, vi } from 'vitest';
import { Circuit } from '../src/core/runtime/Circuit.js';

describe('Circuit result projection delegation', () => {
    it('classroom V2 step does not copy results onto live components; onUpdate still fires', () => {
        const persistenceAdapter = {
            loadSolverDebugFlag: vi.fn(() => false),
            saveSolverDebugFlag: vi.fn(() => true)
        };
        const circuit = new Circuit({
            persistenceAdapter
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

        expect(circuit.resultProjectionService).toBeUndefined();
        expect(circuit.onUpdate).toHaveBeenCalledWith(results);
    });
});
