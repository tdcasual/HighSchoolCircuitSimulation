import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { wrapSolverBackend } from '../src/app/simulation/ComponentViewAdapter.js';
import { debugRuntimeCircuit } from '../src/app/AppRuntimeV2Delegates.js';
import { SimulationRefreshSkill } from '../src/ai/skills/SimulationRefreshSkill.js';
import { createInjectedSolverBackend, DEFAULT_SOLVER_BACKEND_MODE } from '../src/v2/app/createInjectedSolverBackend.js';
import {
    addComponent,
    connectWire,
    createTestCircuit,
    solveCircuit
} from './helpers/circuitTestUtils.js';

function readSource(relPath) {
    return readFileSync(resolve(process.cwd(), relPath), 'utf8');
}

function createMockBackend(overrides = {}) {
    return {
        mode: 'v2',
        fallbackCount: 0,
        shadowWallClockTick: 0,
        shadowCompareCount: 0,
        shadowMismatchCount: 0,
        shadowErrorCount: 0,
        solveFrame: vi.fn(({ dt, simTime }) => ({
            valid: true,
            voltages: [0, 2.4],
            currents: new Map([
                ['R1', 0.37],
                ['V1', 0.37]
            ]),
            backendUsed: 'v2',
            dt,
            simTime
        })),
        restoreStandby: vi.fn(),
        reset: vi.fn(),
        ...overrides
    };
}

function buildSeriesFixture() {
    const circuit = createTestCircuit();
    addComponent(circuit, 'PowerSource', 'V1', { voltage: 3, internalResistance: 2 });
    addComponent(circuit, 'Resistor', 'R1', { resistance: 8 });
    connectWire(circuit, 'W1', 'V1', 0, 'R1', 0);
    connectWire(circuit, 'W2', 'R1', 1, 'V1', 1);
    return circuit;
}

function buildAcFixture() {
    const circuit = createTestCircuit();
    circuit.dt = 0.01;
    addComponent(circuit, 'ACVoltageSource', 'VAC', {
        rmsVoltage: 10,
        frequency: 50,
        phase: 90,
        offset: 0,
        internalResistance: 0
    });
    addComponent(circuit, 'Resistor', 'R1', { resistance: 10 });
    connectWire(circuit, 'W1', 'VAC', 0, 'R1', 0);
    connectWire(circuit, 'W2', 'R1', 1, 'VAC', 1);
    return circuit;
}

function createDebugLogger() {
    return {
        child: () => ({
            info: () => {},
            debug: () => {},
            error: () => {}
        })
    };
}

describe('solverBackend wiring contracts', () => {
    it('keeps production app/core/embed free of V2 solver identifiers', () => {
        const files = [
            'src/app/AppRuntimeV2.js',
            'src/app/AppRuntimeV2Delegates.js',
            'src/app/simulation/ComponentViewAdapter.js',
            'src/core/services/CircuitSimulationLoopService.js',
            'src/core/runtime/Circuit.js',
            'src/embed/EmbedRuntimeOptions.js',
            'src/ai/skills/SimulationRefreshSkill.js'
        ];
        for (const relPath of files) {
            expect(readSource(relPath), relPath).not.toMatch(/SolveCircuitV2|runSimulationStepV2/);
        }
        const runtime = readSource('src/app/AppRuntimeV2.js');
        expect(runtime).not.toMatch(/from\s+['"][^'"]*\/v2\//);
        expect(runtime).toContain('wrapSolverBackend');
        expect(runtime).toContain('options.solverBackend');
        expect(runtime).toContain('new Circuit');

        const loop = readSource('src/core/services/CircuitSimulationLoopService.js');
        expect(loop).not.toContain('snapshotCircuitModel');
        expect(loop).not.toContain('applyViewMapToComponents');
        expect(loop).toContain("mode === 'v1'");
        expect(loop).toContain('solveFrame');
        expect(loop).toContain('restoreStandby');

        const factory = readSource('src/v2/app/createInjectedSolverBackend.js');
        expect(factory).toContain("mode: normalizeMode(options.mode)");
        expect(factory).toContain("DEFAULT_SOLVER_BACKEND_MODE = 'v1'");
        expect(factory).toContain('runSimulationStepV2');

        const bootstrap = readSource('src/v2/main/bootstrapV2.js');
        expect(bootstrap).toContain('createInjectedSolverBackend');
        expect(bootstrap).toContain('solverBackend: createInjectedSolverBackend()');

        const driver = readSource('src/app/SimulationDriver.js');
        expect(driver).toContain('intervalMs = 10');
    });

    it('requires quality scripts to inject the bootstrap factory and haltSimulation', () => {
        const scripts = [
            'scripts/benchmark/p0-electrical-regression.mjs',
            'scripts/benchmark/p0-electrical-extensions.mjs',
            'scripts/benchmark/p0-baseline.mjs',
            'scripts/benchmark/circuitjs-golden-regression.mjs',
            'scripts/benchmark/ai-eval-regression.mjs'
        ];
        for (const relPath of scripts) {
            const source = readSource(relPath);
            expect(source, relPath).toContain('createInjectedSolverBackend');
            expect(source, relPath).toContain('prepareSimulation');
            expect(source, relPath).toContain('.step(');
            expect(source, relPath).toContain('haltSimulation');
        }
    });
});

describe('CircuitSimulationLoopService solverBackend dispatch', () => {
    it('calls solveFrame once per AC substep when mode is v2 and does not call solver.solve', () => {
        const circuit = buildAcFixture();
        const backend = createMockBackend();
        circuit.solverBackend = backend;
        const solveSpy = vi.spyOn(circuit.solver, 'solve');

        circuit.prepareSimulation();
        const substeps = circuit.getSimulationSubstepCount(circuit.dt);
        expect(substeps).toBeGreaterThan(1);
        circuit.step();
        circuit.haltSimulation();

        expect(backend.solveFrame).toHaveBeenCalledTimes(substeps);
        expect(backend.solveFrame.mock.calls[0][0].dt).toBeCloseTo(circuit.dt / substeps, 12);
        expect(backend.solveFrame.mock.calls[1][0].simTime).toBeCloseTo(circuit.dt / substeps, 12);
        expect(solveSpy).not.toHaveBeenCalled();
        expect(backend.restoreStandby).not.toHaveBeenCalled();
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.currents.has('R1')).toBe(true);
        expect(circuit.lastResults.currents.get('R1')).toBe(0.37);
        expect(circuit.simTime).toBeCloseTo(0.01, 12);
        expect(backend.reset).toHaveBeenCalled();
    });

    it('keeps the v1 arm on solver.solve when mode is v1 or backend is missing', () => {
        const withV1 = buildSeriesFixture();
        const backend = createMockBackend({ mode: 'v1' });
        withV1.solverBackend = backend;
        const v1Solve = vi.spyOn(withV1.solver, 'solve');
        withV1.prepareSimulation();
        withV1.step();
        withV1.haltSimulation();
        expect(backend.solveFrame).not.toHaveBeenCalled();
        expect(v1Solve).toHaveBeenCalled();
        expect(withV1.lastResults.currents.has('R1')).toBe(true);
        expect(withV1.lastResults.currents.get('R1')).toBeCloseTo(0.3, 6);
        expect(withV1.lastResults.backendUsed).toBeUndefined();

        const bare = buildSeriesFixture();
        const bareSolve = vi.spyOn(bare.solver, 'solve');
        bare.prepareSimulation();
        bare.step();
        bare.haltSimulation();
        expect(bareSolve).toHaveBeenCalled();
        expect(bare.lastResults.currents.get('R1')).toBeCloseTo(0.3, 6);
    });

    it('restores standby then solves that substep with V1 when v2 fails', () => {
        const circuit = buildSeriesFixture();
        const callOrder = [];
        const backend = createMockBackend({
            solveFrame: vi.fn(() => {
                callOrder.push('solveFrame');
                return {
                    valid: false,
                    voltages: [],
                    currents: new Map(),
                    backendUsed: 'v2'
                };
            }),
            restoreStandby: vi.fn(() => {
                callOrder.push('restoreStandby');
            })
        });
        const originalSolve = circuit.solver.solve.bind(circuit.solver);
        circuit.solver.solve = (...args) => {
            callOrder.push('solver.solve');
            return originalSolve(...args);
        };
        circuit.solverBackend = backend;

        circuit.prepareSimulation();
        circuit.step();
        circuit.haltSimulation();

        expect(backend.solveFrame).toHaveBeenCalledTimes(1);
        expect(backend.restoreStandby).toHaveBeenCalledTimes(1);
        expect(backend.restoreStandby).toHaveBeenCalledWith(circuit);
        expect(callOrder).toEqual(['solveFrame', 'restoreStandby', 'solver.solve']);
        expect(backend.fallbackCount).toBe(1);
        expect(circuit.lastResults.backendUsed).toBe('v1');
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.currents.has('R1')).toBe(true);
        expect(circuit.lastResults.currents.get('R1')).toBeCloseTo(0.3, 6);
        expect(circuit.simTime).toBeCloseTo(0.01, 12);
    });

    it('samples shadow on wall-clock ticks 0 and 5 at substep 0 only and does not run the adapter', () => {
        const circuit = buildAcFixture();
        const backend = createMockBackend({
            mode: 'shadow',
            solveFrame: vi.fn(() => ({
                valid: true,
                voltages: [0, 10],
                currents: new Map([
                    ['R1', Math.SQRT2],
                    ['VAC', Math.SQRT2]
                ]),
                backendUsed: 'v2'
            }))
        });
        circuit.solverBackend = backend;
        const solveSpy = vi.spyOn(circuit.solver, 'solve');

        circuit.prepareSimulation();
        const substeps = circuit.getSimulationSubstepCount(circuit.dt);
        expect(substeps).toBeGreaterThan(1);
        for (let tick = 0; tick < 10; tick += 1) {
            circuit.step();
        }
        circuit.haltSimulation();

        expect(backend.solveFrame).toHaveBeenCalledTimes(2);
        expect(backend.solveFrame.mock.calls[0][0].simTime).toBe(0);
        expect(backend.shadowWallClockTick).toBe(10);
        expect(solveSpy.mock.calls.length).toBe(10 * substeps);
        expect(circuit.lastResults.backendUsed).not.toBe('v2');
        expect(circuit.lastResults.currents.has('R1')).toBe(true);
        expect(Math.abs(circuit.lastResults.currents.get('R1'))).toBeGreaterThan(0);
        expect(circuit.simTime).toBeCloseTo(0.1, 12);
    });
});

describe('wrapSolverBackend', () => {
    it('applies ViewMap zeros on v2 success and skips the adapter in shadow mode', () => {
        const circuit = buildSeriesFixture();
        const resistor = circuit.getComponent('R1');
        resistor.currentValue = 9;
        resistor.nodes = [7, 8];
        const liveNodes = resistor.nodes;

        const v2Backend = {
            mode: 'v2',
            fallbackCount: 0,
            solveFrame: () => ({
                valid: true,
                voltages: [0, 2.4],
                currents: new Map([['R1', 0.3]]),
                backendUsed: 'v2',
                viewMap: new Map([
                    ['R1', {
                        currentValue: 0,
                        voltageValue: 2.4,
                        powerValue: 0,
                        nodes: [1, 0]
                    }]
                ])
            }),
            restoreStandby() {},
            reset() {}
        };
        const wrapped = wrapSolverBackend(v2Backend);
        wrapped.solveFrame({ circuit, dt: 0.01, simTime: 0 });
        expect(resistor.currentValue).toBe(0);
        expect(resistor.voltageValue).toBe(2.4);
        expect(resistor.powerValue).toBe(0);
        expect(resistor.nodes).toBe(liveNodes);
        expect(resistor.nodes).toEqual([7, 8]);

        const shadowCircuit = buildSeriesFixture();
        const shadowResistor = shadowCircuit.getComponent('R1');
        shadowResistor.currentValue = 9;
        const shadowBackend = {
            mode: 'shadow',
            solveFrame: () => ({
                valid: true,
                voltages: [0, 2.4],
                currents: new Map([['R1', 0.3]]),
                backendUsed: 'v2',
                viewMap: new Map([
                    ['R1', { currentValue: 0, voltageValue: 0, powerValue: 0 }]
                ])
            }),
            restoreStandby() {},
            reset() {}
        };
        wrapSolverBackend(shadowBackend).solveFrame({ circuit: shadowCircuit, dt: 0.01, simTime: 0 });
        expect(shadowResistor.currentValue).toBe(9);
    });
});

describe('one-shot solveFrame callers', () => {
    it('solveCircuit uses solveFrame when mode is not v1 and does not start the clock', () => {
        const circuit = buildSeriesFixture();
        const backend = createMockBackend();
        circuit.solverBackend = backend;
        const solveSpy = vi.spyOn(circuit.solver, 'solve');
        const result = solveCircuit(circuit, 0.02);
        expect(backend.solveFrame).toHaveBeenCalledTimes(1);
        expect(backend.solveFrame.mock.calls[0][0].simTime).toBe(0.02);
        expect(solveSpy).not.toHaveBeenCalled();
        expect(circuit.isRunning).toBe(false);
        expect(result.currents.get('R1')).toBe(0.37);
    });

    it('debugCircuit leaves isRunning false so prepareSimulation still resets simTime', () => {
        const circuit = buildSeriesFixture();
        circuit.simTime = 4;
        const resetSpy = vi.spyOn(circuit, 'resetSimulationState');
        const snapshot = debugRuntimeCircuit({
            circuit,
            logger: createDebugLogger()
        });
        expect(circuit.isRunning).toBe(false);
        expect(resetSpy).not.toHaveBeenCalled();
        expect(snapshot.results.valid).toBe(true);
        circuit.simTime = 4;
        circuit.prepareSimulation();
        expect(circuit.simTime).toBe(0);
        expect(circuit.isRunning).toBe(true);
        circuit.haltSimulation();
    });

    it('debugCircuit uses solveFrame when mode is not v1 and does not start the clock', () => {
        const circuit = buildSeriesFixture();
        const backend = createMockBackend();
        circuit.solverBackend = backend;
        const solveSpy = vi.spyOn(circuit.solver, 'solve');
        const snapshot = debugRuntimeCircuit({
            circuit,
            logger: createDebugLogger()
        });
        expect(backend.solveFrame).toHaveBeenCalledTimes(1);
        expect(solveSpy).not.toHaveBeenCalled();
        expect(circuit.isRunning).toBe(false);
        expect(snapshot.backendUsed).toBe('v2');
        expect(snapshot.results.currents.get('R1')).toBe(0.37);
        circuit.simTime = 3;
        circuit.prepareSimulation();
        expect(circuit.simTime).toBe(0);
        circuit.haltSimulation();
    });

    it('simulation_refresh with a v2 backend does not set isRunning or skip the next prepare reset', () => {
        const circuit = buildSeriesFixture();
        const backend = createMockBackend();
        circuit.solverBackend = backend;
        circuit.simTime = 1;
        const result = SimulationRefreshSkill.run({ circuit });
        expect(result.ok).toBe(true);
        expect(backend.solveFrame).toHaveBeenCalledTimes(1);
        expect(circuit.isRunning).toBe(false);
        expect(circuit.simTime).toBe(1);
        circuit.prepareSimulation();
        expect(circuit.simTime).toBe(0);
        expect(circuit.isRunning).toBe(true);
        circuit.haltSimulation();
    });
});

describe('createInjectedSolverBackend', () => {
    it('defaults to v1 and solveFrame does not require isRunning', () => {
        expect(DEFAULT_SOLVER_BACKEND_MODE).toBe('v1');
        const backend = createInjectedSolverBackend();
        expect(backend.mode).toBe('v1');
        const circuit = buildSeriesFixture();
        expect(circuit.isRunning).toBe(false);
        const v2Backend = createInjectedSolverBackend({ mode: 'v2' });
        const result = v2Backend.solveFrame({
            circuit,
            dt: circuit.dt,
            simTime: 0
        });
        expect(circuit.isRunning).toBe(false);
        expect(result.valid).toBe(true);
        expect(result.currents.has('R1')).toBe(true);
        expect(result.currents.get('R1')).toBeCloseTo(0.3, 6);
        expect(result.backendUsed).toBe('v2');
        v2Backend.fallbackCount = 3;
        v2Backend.reset();
        expect(v2Backend.fallbackCount).toBe(0);
        expect(v2Backend.mode).toBe('v2');
    });
});
