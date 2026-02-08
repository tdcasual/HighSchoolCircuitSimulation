import { describe, expect, it } from 'vitest';
import { SimulationState } from '../src/core/simulation/SimulationState.js';

describe('SimulationState', () => {
    it('resets dynamic defaults by component type', () => {
        const state = new SimulationState();
        const components = [
            { id: 'C1', type: 'Capacitor' },
            { id: 'L1', type: 'Inductor', initialCurrent: 0.2 },
            { id: 'M1', type: 'Motor' },
            { id: 'D1', type: 'Diode' },
            { id: 'RLY', type: 'Relay' }
        ];

        state.resetForComponents(components);

        const cap = state.get('C1');
        const ind = state.get('L1');
        const motor = state.get('M1');
        const diode = state.get('D1');
        const relay = state.get('RLY');

        expect(cap.prevVoltage).toBe(0);
        expect(cap.prevCharge).toBe(0);
        expect(cap.prevCurrent).toBe(0);
        expect(cap._dynamicHistoryReady).toBe(false);

        expect(ind.prevCurrent).toBeCloseTo(0.2, 6);
        expect(ind.prevVoltage).toBe(0);
        expect(ind._dynamicHistoryReady).toBe(false);

        expect(motor.speed).toBe(0);
        expect(motor.backEmf).toBe(0);

        expect(diode.conducting).toBe(false);
        expect(relay.energized).toBe(false);
    });
});
