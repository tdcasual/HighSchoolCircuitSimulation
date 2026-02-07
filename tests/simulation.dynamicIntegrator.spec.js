import { describe, expect, it } from 'vitest';
import { createComponent } from '../src/components/Component.js';
import { DynamicIntegrator } from '../src/core/simulation/DynamicIntegrator.js';

describe('DynamicIntegrator', () => {
    it('updates capacitor state using selected integration method', () => {
        const integrator = new DynamicIntegrator();
        const capacitor = createComponent('Capacitor', 0, 0, 'C1');
        capacitor.nodes = [0, 1];
        capacitor.capacitance = 0.001;
        capacitor.integrationMethod = 'backward-euler';
        const components = [capacitor];
        const voltages = [5, 1];
        const currents = new Map([['C1', 0.1]]);

        integrator.updateDynamicComponents(components, voltages, currents, 0.01, false);

        expect(capacitor.prevVoltage).toBeCloseTo(4, 6);
        expect(capacitor.prevCharge).toBeCloseTo(0.004, 6);
        expect(capacitor.prevCurrent).toBeCloseTo(0.1, 6);
    });
});
