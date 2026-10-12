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
        expect(loop).not.toContain('shadowReady');
        expect(loop).not.toContain('sampleEveryN');
        expect(loop).not.toContain('function nowMs');
        expect(loop).toContain("mode === 'v1'");
        expect(loop).toContain('solveFrame');
        expect(loop).toContain('restoreStandby');
        expect(loop).toContain('commitV1Substep');
        expect(loop).toContain('SHADOW_SAMPLE_EVERY_N');

        const factory = readSource('src/v2/app/createInjectedSolverBackend.js');
        expect(factory).toContain("mode: normalizeMode(options.mode)");
        expect(factory).toContain("DEFAULT_SOLVER_BACKEND_MODE = 'v2'");
        expect(factory).toContain('runSimulationStepV2');
        expect(factory).not.toContain('shadowReady');
        expect(factory).not.toContain('sampleEveryN');
        expect(factory).toContain('consecutiveFallbackSteps');
        expect(runtime).not.toContain('DEFAULT_SOLVER_BACKEND_MODE');
        expect(readSource('src/embed/EmbedRuntimeOptions.js')).not.toContain('DEFAULT_SOLVER_BACKEND_MODE');
        expect(readSource('src/app/AppDocument.js')).not.toContain('lowerArchivedV2');
        expect(loop).toContain('consecutiveFallbackSteps');
        expect(loop).toContain('fellBackThisStep');
        expect(loop).not.toMatch(/backend\.mode\s*=\s*['"]v1['"]/);
        expect(readSource('src/app/RuntimeUiBridge.js')).toContain('仿真已回退到稳定求解器');
        expect(readSource('src/app/RuntimeUiBridge.js')).toContain('已回退');
        expect(readSource('src/app/RuntimeUiBridge.js')).not.toMatch(/solverBackend\.mode\s*=/);
        expect(readSource('README.md')).toContain('ui.solverBackend');
        expect(readSource('AGENTS.md')).toContain('ui.solverBackend');

        const adapter = readSource('src/app/simulation/ComponentViewAdapter.js');
        expect(adapter).not.toContain('copyDynamicsToV1Standby');
        expect(adapter).not.toContain('applySolverBackendRuntimeOptions');
        expect(adapter).toContain('backend.restoreStandby');

        const serialization = readSource('src/app/AppSerialization.js');
        expect(serialization).not.toContain('normalizeSolverBackendMode');
        expect(readSource('src/app/AppDocument.js')).not.toMatch(/export function normalizeSolverBackendMode/);

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
            expect(source, relPath).toContain('createInjectedSolverBackend()');
            expect(source, relPath).not.toMatch(/createInjectedSolverBackend\(\s*\{/);
            expect(source, relPath).toContain('prepareSimulation');
            expect(source, relPath).toContain('.step(');
            expect(source, relPath).toContain('haltSimulation');
        }
    });

    it('requires runDcSolveScenario to use prepare/step/halt instead of solver.solve', () => {
        const source = readSource('scripts/benchmark/p0-electrical-extensions.mjs');
        const dcStart = source.indexOf('function runDcSolveScenario');
        const dcEnd = source.indexOf('function runScenario');
        expect(dcStart).toBeGreaterThanOrEqual(0);
        expect(dcEnd).toBeGreaterThan(dcStart);
        const dcRunner = source.slice(dcStart, dcEnd);
        expect(dcRunner).toContain('createInjectedSolverBackend');
        expect(dcRunner).toContain('prepareSimulation');
        expect(dcRunner).toContain('.step(');
        expect(dcRunner).toContain('haltSimulation');
        expect(dcRunner).not.toContain('solver.solve');
        expect(dcRunner).not.toContain('ensureSolverPrepared');
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

    it('skips V1 display projection on v2 success after wrap writes ViewMap zeros', () => {
        const circuit = buildSeriesFixture();
        const resistor = circuit.getComponent('R1');
        const liveNodes = resistor.nodes;
        const circuitNodes = circuit.nodes;
        const backend = createMockBackend({
            solveFrame: vi.fn(() => ({
                valid: true,
                voltages: [0, 2.4],
                currents: new Map([
                    ['R1', 0.37],
                    ['V1', 0.37]
                ]),
                backendUsed: 'v2',
                viewMap: new Map([
                    ['R1', {
                        currentValue: 0,
                        voltageValue: 2.4,
                        powerValue: 0,
                        nodes: [1, 0]
                    }]
                ])
            }))
        });
        circuit.solverBackend = wrapSolverBackend(backend);
        const projectionSpy = vi.spyOn(circuit.resultProjectionService, 'updateComponentDisplayValues');

        circuit.prepareSimulation();
        resistor.currentValue = 9;
        circuit.step();
        circuit.haltSimulation();

        expect(projectionSpy).not.toHaveBeenCalled();
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.currents.get('R1')).toBe(0.37);
        expect(resistor.currentValue).toBe(0);
        expect(resistor.nodes).toBe(liveNodes);
        expect(circuit.nodes).toBe(circuitNodes);
        expect(backend.restoreStandby).toHaveBeenCalledWith(circuit);
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
        expect(backend.consecutiveFallbackSteps).toBe(1);
        expect(backend.fellBackThisStep).toBe(true);
        expect(backend.mode).toBe('v2');
        expect(circuit.lastResults.backendUsed).toBe('v1');
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.currents.has('R1')).toBe(true);
        expect(circuit.lastResults.currents.get('R1')).toBeCloseTo(0.3, 6);
        expect(circuit.simTime).toBeCloseTo(0.01, 12);
    });

    it('samples shadow on wall-clock ticks 0 and 5 at substep 0 only and does not run the adapter', () => {
        const circuit = buildAcFixture();
        const resistor = circuit.getComponent('R1');
        const solveFrame = vi.fn(() => ({
            valid: true,
            voltages: [0, 10],
            currents: new Map([
                ['R1', 0.37],
                ['VAC', 0.37]
            ]),
            backendUsed: 'v2',
            viewMap: new Map([
                ['R1', { currentValue: 0, voltageValue: 0, powerValue: 0 }]
            ])
        }));
        const backend = createMockBackend({
            mode: 'shadow',
            solveFrame
        });
        const wrapped = wrapSolverBackend(backend);
        circuit.solverBackend = wrapped;
        const solveSpy = vi.spyOn(circuit.solver, 'solve');
        vi.spyOn(circuit.resultProjectionService, 'updateComponentDisplayValues').mockImplementation(() => {});

        circuit.prepareSimulation();
        resistor.currentValue = 9;
        const substeps = circuit.getSimulationSubstepCount(circuit.dt);
        expect(substeps).toBeGreaterThan(1);
        for (let tick = 0; tick < 10; tick += 1) {
            circuit.step();
        }
        circuit.haltSimulation();

        expect(solveFrame).toHaveBeenCalledTimes(2);
        expect(solveFrame.mock.calls[0][0].simTime).toBe(0);
        expect(solveFrame.mock.calls[1][0].simTime).toBeCloseTo(0.05, 12);
        expect(backend.shadowWallClockTick).toBe(10);
        expect(solveSpy.mock.calls.length).toBe(10 * substeps);
        expect(circuit.lastResults.backendUsed).not.toBe('v2');
        expect(circuit.lastResults.currents.has('R1')).toBe(true);
        const lastV1 = solveSpy.mock.results.at(-1)?.value;
        expect(circuit.lastResults.currents.get('R1')).toBe(lastV1.currents.get('R1'));
        expect(Math.abs(circuit.lastResults.currents.get('R1'))).toBeCloseTo(Math.SQRT2, 1);
        expect(circuit.lastResults.currents.get('R1')).not.toBe(0.37);
        expect(resistor.currentValue).toBe(9);
        expect(circuit.simTime).toBeCloseTo(0.1, 12);
    });

    it('treats a missing V2 current key as a shadow mismatch even when V1 is 0', () => {
        const probe = createTestCircuit();
        addComponent(probe, 'PowerSource', 'V1', { voltage: 6, internalResistance: 0 });
        addComponent(probe, 'Switch', 'S1', { closed: false });
        addComponent(probe, 'Resistor', 'R1', { resistance: 10 });
        connectWire(probe, 'W1', 'V1', 0, 'S1', 0);
        connectWire(probe, 'W2', 'S1', 1, 'R1', 0);
        connectWire(probe, 'W3', 'R1', 1, 'V1', 1);
        probe.prepareSimulation();
        probe.step();
        probe.haltSimulation();
        expect(probe.lastResults.currents.has('R1')).toBe(true);
        expect(Math.abs(probe.lastResults.currents.get('R1'))).toBeLessThan(1e-7);
        const v1Voltages = probe.lastResults.voltages.slice();
        const v2Currents = new Map();
        for (const [id, value] of probe.lastResults.currents) {
            if (id !== 'R1') v2Currents.set(id, value);
        }
        expect(v2Currents.has('R1')).toBe(false);

        const circuit = createTestCircuit();
        addComponent(circuit, 'PowerSource', 'V1', { voltage: 6, internalResistance: 0 });
        addComponent(circuit, 'Switch', 'S1', { closed: false });
        addComponent(circuit, 'Resistor', 'R1', { resistance: 10 });
        connectWire(circuit, 'W1', 'V1', 0, 'S1', 0);
        connectWire(circuit, 'W2', 'S1', 1, 'R1', 0);
        connectWire(circuit, 'W3', 'R1', 1, 'V1', 1);
        const backend = createMockBackend({
            mode: 'shadow',
            solveFrame: vi.fn(() => ({
                valid: true,
                voltages: v1Voltages.slice(),
                currents: new Map(v2Currents),
                backendUsed: 'v2'
            }))
        });
        circuit.solverBackend = backend;
        circuit.prepareSimulation();
        circuit.step();
        circuit.haltSimulation();
        expect(circuit.lastResults.currents.has('R1')).toBe(true);
        expect(Math.abs(circuit.lastResults.currents.get('R1'))).toBeLessThan(1e-7);
        expect(backend.shadowCompareCount).toBe(1);
        expect(backend.shadowMismatchCount).toBe(1);
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

    it('copies runtimeOptions.solverBackend onto backend.mode', () => {
        const backend = { mode: 'v1', solveFrame() {} };
        wrapSolverBackend(backend, { runtimeOptions: { solverBackend: 'v2' } });
        expect(backend.mode).toBe('v2');

        const kept = { mode: 'v1', solveFrame() {} };
        wrapSolverBackend(kept, { runtimeOptions: {} });
        expect(kept.mode).toBe('v1');

        const factory = createInjectedSolverBackend();
        expect(factory.mode).toBe('v2');
        wrapSolverBackend(factory, { runtimeOptions: { solverBackend: 'v1' } });
        expect(factory.mode).toBe('v1');

        const classroom = createInjectedSolverBackend();
        wrapSolverBackend(classroom, { runtimeOptions: {} });
        expect(classroom.mode).toBe('v2');
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
    it('defaults to v2 and solveFrame does not require isRunning', () => {
        expect(DEFAULT_SOLVER_BACKEND_MODE).toBe('v2');
        const backend = createInjectedSolverBackend();
        expect(backend.mode).toBe('v2');
        const circuit = buildSeriesFixture();
        expect(circuit.isRunning).toBe(false);
        const v2Backend = createInjectedSolverBackend();
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
        const liveNodes = circuit.nodes;
        const resistorNodes = circuit.getComponent('R1').nodes;
        const dynSpy = vi.spyOn(circuit.solver, 'updateDynamicComponents');
        v2Backend.restoreStandby(circuit);
        expect(circuit.nodes).toBe(liveNodes);
        expect(circuit.getComponent('R1').nodes).toBe(resistorNodes);
        expect(dynSpy).not.toHaveBeenCalled();
        v2Backend.fallbackCount = 3;
        v2Backend.consecutiveFallbackSteps = 12;
        v2Backend.fellBackThisStep = true;
        v2Backend.reset();
        expect(v2Backend.fallbackCount).toBe(0);
        expect(v2Backend.consecutiveFallbackSteps).toBe(0);
        expect(v2Backend.fellBackThisStep).toBe(false);
        expect(v2Backend.mode).toBe('v2');
    });
});
