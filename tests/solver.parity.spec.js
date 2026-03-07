import { describe, expect, it } from 'vitest';
import {
    CANONICAL_SOLVER_CASES,
    getCanonicalSolverCase,
    runParityCase
} from './helpers/solverParityHarness.js';

function expectSnapshotsToMatch(runtimeSnapshot, v2Snapshot) {
    expect(v2Snapshot.valid).toBe(runtimeSnapshot.valid);
    expect(v2Snapshot.invalidReason).toBe(runtimeSnapshot.invalidReason);
    expect(Object.keys(v2Snapshot.currents).sort()).toEqual(Object.keys(runtimeSnapshot.currents).sort());
    expect(Object.keys(v2Snapshot.terminalVoltages).sort()).toEqual(Object.keys(runtimeSnapshot.terminalVoltages).sort());

    for (const [componentId, runtimeCurrent] of Object.entries(runtimeSnapshot.currents)) {
        expect(v2Snapshot.currents[componentId]).toBeCloseTo(runtimeCurrent, 6);
    }

    for (const [componentId, runtimeVoltages] of Object.entries(runtimeSnapshot.terminalVoltages)) {
        expect(v2Snapshot.terminalVoltages[componentId].length).toBe(runtimeVoltages.length);
        runtimeVoltages.forEach((runtimeVoltage, index) => {
            expect(v2Snapshot.terminalVoltages[componentId][index]).toBeCloseTo(runtimeVoltage, 6);
        });
    }
}

describe('Solver parity harness', () => {
    it('exposes shared canonical cases for both solver paths', () => {
        expect(CANONICAL_SOLVER_CASES.map((entry) => entry.id)).toEqual([
            'series-source-resistor',
            'divider-ideal-voltmeter',
            'series-ideal-ammeter',
            'conflicting-ideal-sources'
        ]);
    });

    for (const entry of CANONICAL_SOLVER_CASES) {
        it(`keeps v1 and v2 solver outputs aligned for ${entry.id}`, () => {
            const parity = runParityCase(getCanonicalSolverCase(entry.id), { dt: 0.01, simTime: 0 });
            expectSnapshotsToMatch(parity.runtime.snapshot, parity.v2.snapshot);
        });
    }
});
