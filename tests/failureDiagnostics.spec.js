import { describe, expect, it } from 'vitest';
import {
    FailureCategories,
    collectFailureCategories,
    hasFatalFailure
} from '../src/core/simulation/FailureDiagnostics.js';

describe('failure diagnostics category mapping', () => {
    it('maps topology conflicting ideal sources to CONFLICTING_SOURCES', () => {
        const categories = collectFailureCategories({
            topologyReport: {
                ok: false,
                error: { code: 'TOPO_CONFLICTING_IDEAL_SOURCES' },
                warnings: []
            }
        });

        expect(categories).toContain(FailureCategories.ConflictingSources);
        expect(hasFatalFailure(categories)).toBe(true);
    });

    it('maps floating subcircuit warnings to FLOATING_SUBCIRCUIT', () => {
        const categories = collectFailureCategories({
            topologyReport: {
                ok: true,
                error: null,
                warnings: [{ code: 'TOPO_FLOATING_SUBCIRCUIT' }]
            }
        });

        expect(categories).toEqual([FailureCategories.FloatingSubcircuit]);
        expect(hasFatalFailure(categories)).toBe(false);
    });

    it('maps solver factorization failures to SINGULAR_MATRIX', () => {
        const categories = collectFailureCategories({
            results: {
                valid: false,
                meta: { invalidReason: 'factorization_failed' }
            }
        });

        expect(categories).toContain(FailureCategories.SingularMatrix);
    });

    it('maps short-circuit diagnostics to SHORT_CIRCUIT', () => {
        const categories = collectFailureCategories({
            solverShortCircuitDetected: true
        });

        expect(categories).toContain(FailureCategories.ShortCircuit);
    });

    it('maps explicit invalid parameter issues to INVALID_PARAMS', () => {
        const categories = collectFailureCategories({
            invalidParameterIssues: [
                { componentId: 'R1', field: 'resistance', reason: 'NaN' }
            ]
        });

        expect(categories).toContain(FailureCategories.InvalidParams);
    });

    it('deduplicates categories and keeps deterministic priority order', () => {
        const categories = collectFailureCategories({
            topologyReport: {
                ok: false,
                error: { code: 'TOPO_CONFLICTING_IDEAL_SOURCES' },
                warnings: [{ code: 'TOPO_FLOATING_SUBCIRCUIT' }]
            },
            results: {
                valid: false,
                meta: { invalidReason: 'factorization_failed' }
            },
            solverShortCircuitDetected: true,
            invalidParameterIssues: [{ componentId: 'R1' }]
        });

        expect(categories).toEqual([
            FailureCategories.ConflictingSources,
            FailureCategories.ShortCircuit,
            FailureCategories.SingularMatrix,
            FailureCategories.InvalidParams,
            FailureCategories.FloatingSubcircuit
        ]);
    });
});
