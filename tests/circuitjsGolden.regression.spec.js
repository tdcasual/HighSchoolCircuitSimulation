import { describe, expect, it } from 'vitest';
import {
    CIRCUITJS_GOLDEN_SCENARIO_DEFINITIONS,
    runCircuitJsGoldenScenarios
} from '../scripts/benchmark/circuitjs-golden-regression.mjs';

describe('CircuitJS converted golden scenarios', () => {
    it('keeps exactly 10 selected CircuitJS scenarios', () => {
        expect(CIRCUITJS_GOLDEN_SCENARIO_DEFINITIONS).toHaveLength(10);
        const ids = CIRCUITJS_GOLDEN_SCENARIO_DEFINITIONS.map((scenario) => scenario.id);
        expect(new Set(ids).size).toBe(10);
    });

    it('converts and solves all selected scenarios without unsupported primitives', () => {
        const snapshots = runCircuitJsGoldenScenarios();
        expect(snapshots).toHaveLength(10);

        for (const snapshot of snapshots) {
            expect(snapshot.valid).toBe(true);
            expect(snapshot.conversion.unsupportedElements).toHaveLength(0);
            expect(snapshot.components).toBeGreaterThan(0);
            expect(snapshot.wires).toBeGreaterThanOrEqual(0);
            expect(snapshot.nodes).toBeGreaterThan(0);
        }
    });
});
