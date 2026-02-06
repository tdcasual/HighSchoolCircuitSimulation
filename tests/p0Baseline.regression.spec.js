import { describe, it, expect } from 'vitest';
import { P0_SCENARIO_DEFINITIONS, runAllScenarios } from '../scripts/benchmark/p0-electrical-regression.mjs';

describe('P0 electrical baseline scenarios', () => {
    it('keeps exactly 20 canonical scenarios', () => {
        expect(P0_SCENARIO_DEFINITIONS).toHaveLength(20);
        const ids = P0_SCENARIO_DEFINITIONS.map((scenario) => scenario.id);
        expect(new Set(ids).size).toBe(20);
    });

    it('runs all baseline scenarios with valid solver results', () => {
        const snapshots = runAllScenarios();
        expect(snapshots).toHaveLength(20);
        for (const snapshot of snapshots) {
            expect(snapshot.valid).toBe(true);
        }
    });
});
