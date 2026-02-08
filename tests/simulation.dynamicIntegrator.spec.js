import { describe, expect, it } from 'vitest';
import { createComponent } from '../src/components/Component.js';
import { DynamicIntegrator } from '../src/core/simulation/DynamicIntegrator.js';
import { SimulationState } from '../src/core/simulation/SimulationState.js';

describe('DynamicIntegrator with SimulationState', () => {
    it('updates SimulationState and keeps component mirror', () => {
        const integrator = new DynamicIntegrator();
        const capacitor = createComponent('Capacitor', 0, 0, 'C1');
        capacitor.nodes = [0, 1];
        capacitor.capacitance = 0.001;
        capacitor.integrationMethod = 'backward-euler';

        const state = new SimulationState();
        const voltages = [5, 1];
        const currents = new Map([['C1', 0.1]]);

        integrator.updateDynamicComponents([capacitor], voltages, currents, 0.01, false, state);

        const entry = state.get('C1');
        expect(entry.prevVoltage).toBeCloseTo(4, 6);
        expect(entry.prevCharge).toBeCloseTo(0.004, 6);
        expect(entry.prevCurrent).toBeCloseTo(0.1, 6);
        expect(entry._dynamicHistoryReady).toBe(true);

        expect(capacitor.prevVoltage).toBeCloseTo(4, 6);
    });
});
