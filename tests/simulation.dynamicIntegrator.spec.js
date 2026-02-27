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

    it('accelerates a motor under constant voltage with no load', () => {
        const integrator = new DynamicIntegrator();
        const motor = createComponent('Motor', 0, 0, 'M1');
        motor.nodes = [0, 1];
        motor.resistance = 5;
        motor.torqueConstant = 0.1;
        motor.emfConstant = 0.1;
        motor.inertia = 0.01;
        motor.loadTorque = 0;

        const state = new SimulationState();
        const voltages = [12, 0];
        const dt = 0.01;

        integrator.updateDynamicComponents([motor], voltages, null, dt, false, state);
        const initialSpeed = motor.speed || 0;
        const initialBackEmf = motor.backEmf || 0;
        const initialCurrent = (voltages[0] - voltages[1] - initialBackEmf) / motor.resistance;

        for (let i = 0; i < 100; i++) {
            integrator.updateDynamicComponents([motor], voltages, null, dt, false, state);
        }

        const laterCurrent = (voltages[0] - voltages[1] - motor.backEmf) / motor.resistance;
        expect(motor.speed).toBeGreaterThan(initialSpeed);
        expect(motor.backEmf).toBeGreaterThan(initialBackEmf);
        expect(laterCurrent).toBeLessThan(initialCurrent);
    });

    it('keeps motor stalled when load torque dominates', () => {
        const integrator = new DynamicIntegrator();
        const motor = createComponent('Motor', 0, 0, 'M1');
        motor.nodes = [0, 1];
        motor.resistance = 5;
        motor.torqueConstant = 0.1;
        motor.emfConstant = 0.1;
        motor.inertia = 0.01;
        motor.loadTorque = 100;

        const state = new SimulationState();
        const voltages = [12, 0];
        const dt = 0.01;

        for (let i = 0; i < 50; i++) {
            integrator.updateDynamicComponents([motor], voltages, null, dt, false, state);
        }

        expect(motor.speed).toBeLessThan(1e-6);
        expect(motor.backEmf).toBeLessThan(1e-6);
    });

    it('keeps motor state finite when resistance/inertia are invalid', () => {
        const integrator = new DynamicIntegrator();
        const motor = createComponent('Motor', 0, 0, 'M_bad');
        motor.nodes = [0, 1];
        motor.resistance = 0;
        motor.torqueConstant = 0.1;
        motor.emfConstant = 0.1;
        motor.inertia = 0;
        motor.loadTorque = 0.01;

        const state = new SimulationState();
        integrator.updateDynamicComponents([motor], [12, 0], null, 0.01, false, state);

        expect(Number.isFinite(motor.speed)).toBe(true);
        expect(Number.isFinite(motor.backEmf)).toBe(true);

        const entry = state.get('M_bad');
        expect(Number.isFinite(entry?.speed)).toBe(true);
        expect(Number.isFinite(entry?.backEmf)).toBe(true);
    });
});
