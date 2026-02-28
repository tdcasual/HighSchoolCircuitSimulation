import { describe, expect, it, vi } from 'vitest';
import { resolveRuntimeDiagnosticsForUpdate } from '../src/app/RuntimeDiagnosticsPipeline.js';

describe('runtime diagnostics pipeline', () => {
    it('keeps existing diagnostics payload without recompute', () => {
        const existing = { code: 'SHORT_CIRCUIT', summary: 'x', hints: ['h1'] };
        const collectRuntimeDiagnostics = vi.fn();
        const circuit = { collectRuntimeDiagnostics, simTime: 1.2 };
        const results = { valid: false, runtimeDiagnostics: existing };

        const diagnostics = resolveRuntimeDiagnosticsForUpdate({ results, circuit });

        expect(diagnostics).toBe(existing);
        expect(results.runtimeDiagnostics).toBe(existing);
        expect(collectRuntimeDiagnostics).not.toHaveBeenCalled();
    });

    it('collects diagnostics from circuit when result payload is missing', () => {
        const collected = { code: 'CONFLICTING_SOURCES', summary: 'stop', hints: ['fix'] };
        const collectRuntimeDiagnostics = vi.fn(() => collected);
        const circuit = { collectRuntimeDiagnostics, simTime: 2.5 };
        const results = { valid: false };

        const diagnostics = resolveRuntimeDiagnosticsForUpdate({ results, circuit });

        expect(collectRuntimeDiagnostics).toHaveBeenCalledTimes(1);
        expect(collectRuntimeDiagnostics).toHaveBeenCalledWith(results, 2.5);
        expect(diagnostics).toBe(collected);
        expect(results.runtimeDiagnostics).toBe(collected);
    });

    it('falls back to ad-hoc diagnostics when circuit collector is unavailable', () => {
        const circuit = {
            simTime: 0.2,
            solver: { shortCircuitDetected: true },
            shortedSourceIds: ['V1'],
            shortedWireIds: ['W1']
        };
        const results = { valid: false };

        const diagnostics = resolveRuntimeDiagnosticsForUpdate({ results, circuit });

        expect(diagnostics.code).toBe('SHORT_CIRCUIT');
        expect(results.runtimeDiagnostics).toBeTruthy();
        expect(Array.isArray(diagnostics.hints)).toBe(true);
    });
});
