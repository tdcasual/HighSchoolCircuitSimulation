import { describe, expect, it, vi } from 'vitest';
import { SimulationDriver } from '../src/app/SimulationDriver.js';
import { Circuit } from '../src/core/runtime/Circuit.js';

describe('SimulationDriver', () => {
    it('pairs circuit.isRunning with driver.isRunning on start and stop', () => {
        const circuit = new Circuit();
        const timers = [];
        const driver = new SimulationDriver({
            circuit,
            intervalMs: 10,
            setIntervalFn: (fn, ms) => {
                timers.push({ fn, ms });
                return 1;
            },
            clearIntervalFn: vi.fn()
        });

        driver.start();
        expect(circuit.isRunning).toBe(true);
        expect(driver.isRunning).toBe(true);
        expect(timers).toHaveLength(1);

        driver.stop();
        expect(circuit.isRunning).toBe(false);
        expect(driver.isRunning).toBe(false);
    });

    it('prepareSimulation without driver.start leaves the timer unarmed', () => {
        const circuit = new Circuit();
        const driver = new SimulationDriver({
            circuit,
            setIntervalFn: () => 7,
            clearIntervalFn: vi.fn()
        });
        circuit.prepareSimulation();
        expect(circuit.isRunning).toBe(true);
        expect(driver.isRunning).toBe(false);
    });
});
