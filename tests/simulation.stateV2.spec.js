import { describe, expect, it } from 'vitest';
import { SimulationStateV2 } from '../src/v2/simulation/SimulationStateV2.js';

describe('SimulationStateV2', () => {
    it('supports ensure/applyPatch flow with deterministic defaults', () => {
        const state = new SimulationStateV2();
        const entry = state.ensure({ id: 'C1', type: 'Capacitor' });

        expect(entry).toEqual({
            prevVoltage: 0,
            prevCharge: 0,
            prevCurrent: 0,
            dynamicHistoryReady: false
        });

        state.applyPatch('C1', {
            prevVoltage: 2.5,
            dynamicHistoryReady: true
        });

        expect(state.get('C1')).toEqual({
            prevVoltage: 2.5,
            prevCharge: 0,
            prevCurrent: 0,
            dynamicHistoryReady: true
        });
    });

    it('reset rebuilds entries from component descriptors without mutating source components', () => {
        const cap = {
            id: 'C1',
            type: 'Capacitor',
            prevVoltage: 999
        };
        const ind = {
            id: 'L1',
            type: 'Inductor',
            initialCurrent: 0.2,
            prevCurrent: 999
        };

        const state = new SimulationStateV2();
        state.ensure(cap);
        state.applyPatch('C1', { prevVoltage: 4.2 });
        state.reset([cap, ind]);

        expect(state.get('C1')).toEqual({
            prevVoltage: 0,
            prevCharge: 0,
            prevCurrent: 0,
            dynamicHistoryReady: false
        });
        expect(state.get('L1')).toEqual({
            prevCurrent: 0.2,
            prevVoltage: 0,
            dynamicHistoryReady: false
        });

        expect(cap.prevVoltage).toBe(999);
        expect(ind.prevCurrent).toBe(999);
    });

    it('reset with no component list clears all runtime states', () => {
        const state = new SimulationStateV2();
        state.ensure({ id: 'M1', type: 'Motor' });
        expect(state.size).toBe(1);

        state.reset();
        expect(state.size).toBe(0);
    });
});
