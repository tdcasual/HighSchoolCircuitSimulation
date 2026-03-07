import { describe, expect, it, vi } from 'vitest';
import { resolveRuntimeDiagnosticsForUpdate } from '../src/app/RuntimeDiagnosticsPipeline.js';

describe('runtime diagnostics freshness guard', () => {
    it('recomputes stale runtime diagnostics when topology or simulation versions no longer match', () => {
        const existing = {
            code: 'SHORT_CIRCUIT',
            summary: 'stale',
            hints: ['old'],
            topologyVersion: 1,
            simulationVersion: 2
        };
        const collected = {
            code: 'SINGULAR_MATRIX',
            summary: 'fresh',
            hints: ['new'],
            topologyVersion: 3,
            simulationVersion: 4
        };
        const collectRuntimeDiagnostics = vi.fn(() => collected);
        const circuit = {
            collectRuntimeDiagnostics,
            simTime: 2.5,
            topologyVersion: 3,
            simulationStepId: 4
        };
        const results = {
            valid: false,
            runtimeDiagnostics: existing
        };

        const diagnostics = resolveRuntimeDiagnosticsForUpdate({ results, circuit });

        expect(collectRuntimeDiagnostics).toHaveBeenCalledTimes(1);
        expect(collectRuntimeDiagnostics).toHaveBeenCalledWith(results, 2.5);
        expect(diagnostics).toBe(collected);
        expect(results.runtimeDiagnostics).toBe(collected);
    });
});
