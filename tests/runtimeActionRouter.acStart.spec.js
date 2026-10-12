import { describe, expect, it, vi } from 'vitest';
import { RuntimeActionRouter } from '../src/app/RuntimeActionRouter.js';
import { SimulationDriver } from '../src/app/SimulationDriver.js';

describe('RuntimeActionRouter AC start gate', () => {
    it('starts the simulation driver clock when the only source is an ACVoltageSource', () => {
        const prepareSimulation = vi.fn();
        const step = vi.fn();
        const haltSimulation = vi.fn();
        const startSimulation = vi.fn();
        let tick = null;
        const setIntervalFn = vi.fn((fn) => {
            tick = fn;
            return 17;
        });
        const clearIntervalFn = vi.fn();
        const circuit = {
            components: new Map([['VAC', { type: 'ACVoltageSource' }]]),
            startSimulation,
            validateSimulationTopology: vi.fn(() => ({ ok: true })),
            prepareSimulation,
            step,
            haltSimulation
        };
        const simulationDriver = new SimulationDriver({
            circuit,
            intervalMs: 10,
            setIntervalFn,
            clearIntervalFn
        });
        const uiBridge = {
            updateStatus: vi.fn(),
            showSimulationStarted: vi.fn()
        };
        const router = new RuntimeActionRouter({
            circuit,
            simulationDriver,
            chartWorkspace: {}
        }, { uiBridge });

        expect(router.startSimulation()).toBe(true);
        expect(prepareSimulation).toHaveBeenCalledTimes(1);
        expect(setIntervalFn).toHaveBeenCalledTimes(1);
        expect(startSimulation).not.toHaveBeenCalled();
        expect(simulationDriver.isRunning).toBe(true);
        expect(uiBridge.showSimulationStarted).toHaveBeenCalledTimes(1);

        tick();
        expect(step).toHaveBeenCalledTimes(1);
    });
});
