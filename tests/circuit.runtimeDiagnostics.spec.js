import { describe, expect, it, vi } from 'vitest';
import { FailureCategories } from '../src/core/simulation/FailureDiagnostics.js';
import { Circuit } from '../src/core/runtime/Circuit.js';
import { addComponent, connectWire, createTestCircuit } from './helpers/circuitTestUtils.js';

describe('Circuit runtime diagnostics guard rails', () => {
    it('routes topology rebuild through topology service once per request', () => {
        const circuit = createTestCircuit();
        const rebuildSpy = vi.spyOn(circuit.topologyService, 'rebuild');
        const startVersion = circuit.topologyVersion;

        circuit.requestTopologyRebuild();

        expect(rebuildSpy).toHaveBeenCalledTimes(1);
        expect(circuit.topologyVersion).toBe(startVersion + 1);
    });

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

    it('defers topology-derived validation while topology batch rebuild is still pending', () => {
        const circuit = createTestCircuit();
        const originalRebuild = circuit.rebuildNodes.bind(circuit);
        let rebuildCount = 0;
        circuit.rebuildNodes = (...args) => {
            rebuildCount += 1;
            return originalRebuild(...args);
        };

        circuit.beginTopologyBatch();
        circuit.addWire({ id: 'W1', a: { x: 0, y: 0 }, b: { x: 20, y: 0 } });

        const diagnostics = circuit.collectRuntimeDiagnostics({
            valid: false,
            voltages: [],
            currents: new Map(),
            meta: { invalidReason: 'factorization_failed' }
        }, 0);

        expect(rebuildCount).toBe(0);
        expect(circuit.topologyBatchDepth).toBe(1);
        expect(circuit.topologyRebuildPending).toBe(true);
        expect(diagnostics.topologyValidationDeferred).toBe(true);
        expect(diagnostics.code).toBe(FailureCategories.SingularMatrix);
    });


    it('stamps topology and simulation freshness versions on collected diagnostics', () => {
        const circuit = createTestCircuit();
        circuit.simulationStepId = 12;

        const diagnostics = circuit.collectRuntimeDiagnostics({
            valid: false,
            voltages: [],
            currents: new Map(),
            meta: { invalidReason: 'factorization_failed' }
        }, 0);

        expect(diagnostics.topologyVersion).toBe(circuit.topologyVersion);
        expect(diagnostics.simulationVersion).toBe(12);
    });
});
