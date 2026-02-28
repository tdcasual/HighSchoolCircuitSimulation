import { describe, expect, it } from 'vitest';
import { FailureCategories } from '../src/core/simulation/FailureDiagnostics.js';
import { buildRuntimeDiagnostics } from '../src/core/simulation/RuntimeDiagnostics.js';

describe('runtime diagnostics payload', () => {
    it('builds normalized payload for conflicting sources with component ids and hints', () => {
        const diagnostics = buildRuntimeDiagnostics({
            topologyReport: {
                ok: false,
                error: {
                    code: 'TOPO_CONFLICTING_IDEAL_SOURCES',
                    details: {
                        sourceIds: ['V1', 'V2']
                    }
                },
                warnings: []
            }
        });

        expect(diagnostics.code).toBe(FailureCategories.ConflictingSources);
        expect(diagnostics.fatal).toBe(true);
        expect(diagnostics.componentIds).toEqual(['V1', 'V2']);
        expect(diagnostics.wireIds).toEqual([]);
        expect(diagnostics.summary.length).toBeGreaterThan(0);
        expect(Array.isArray(diagnostics.hints)).toBe(true);
        expect(diagnostics.hints.length).toBeGreaterThan(0);
    });

    it('includes short-circuit wire ids from runtime signals', () => {
        const diagnostics = buildRuntimeDiagnostics({
            solverShortCircuitDetected: true,
            shortedSourceIds: new Set(['Vshort']),
            shortedWireIds: new Set(['W1', 'W2'])
        });

        expect(diagnostics.code).toBe(FailureCategories.ShortCircuit);
        expect(diagnostics.componentIds).toEqual(['Vshort']);
        expect(diagnostics.wireIds).toEqual(['W1', 'W2']);
    });

    it('keeps backward-compatible defaults when no signal exists', () => {
        const diagnostics = buildRuntimeDiagnostics();

        expect(diagnostics.code).toBe('');
        expect(diagnostics.summary).toBe('');
        expect(diagnostics.fatal).toBe(false);
        expect(diagnostics.categories).toEqual([]);
        expect(diagnostics.hints).toEqual([]);
        expect(diagnostics.componentIds).toEqual([]);
        expect(diagnostics.wireIds).toEqual([]);
    });

    it('prioritizes primary category hints and limits the hint count', () => {
        const diagnostics = buildRuntimeDiagnostics({
            topologyReport: {
                ok: false,
                error: { code: 'TOPO_CONFLICTING_IDEAL_SOURCES' },
                warnings: [{ code: 'TOPO_FLOATING_SUBCIRCUIT' }]
            },
            solverShortCircuitDetected: true
        });

        expect(diagnostics.code).toBe(FailureCategories.ConflictingSources);
        expect(diagnostics.hints[0]).toContain('并联理想电压源');
        expect(diagnostics.hints.length).toBeLessThanOrEqual(4);
    });

    it('uses actionable hint verbs for singular matrix diagnostics', () => {
        const diagnostics = buildRuntimeDiagnostics({
            results: {
                valid: false,
                meta: { invalidReason: 'factorization_failed' }
            }
        });

        expect(diagnostics.code).toBe(FailureCategories.SingularMatrix);
        expect(diagnostics.hints.every((hint) => /^(检查|确认|恢复|沿|可为|为)/.test(hint))).toBe(true);
    });
});
