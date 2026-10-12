import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { wrapSolverBackend } from '../src/app/simulation/ComponentViewAdapter.js';
import { RuntimeUiBridge } from '../src/app/RuntimeUiBridge.js';
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
        commitStandbyFromCircuit: vi.fn(),
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
        expect(loop).not.toContain("mode === 'v1'");
        expect(loop).toContain('solveFrame');
        expect(loop).not.toContain('restoreStandby');
        expect(loop).not.toContain('commitV1Substep');
        expect(loop).not.toContain('SHADOW_SAMPLE_EVERY_N');

        const factory = readSource('src/v2/app/createInjectedSolverBackend.js');
        expect(factory).toContain("DEFAULT_SOLVER_BACKEND_MODE = 'v2'");
        expect(factory).toContain('runSimulationStepV2');
        expect(factory).not.toContain('shadowReady');
        expect(factory).not.toContain('sampleEveryN');
        expect(factory).toContain('consecutiveFallbackSteps');
        expect(factory).not.toContain('commitStandbyFromCircuit');
        expect(factory).not.toContain('fellBackThisStep');
        expect(factory).not.toContain('restoreStandby');
        expect(runtime).not.toContain('DEFAULT_SOLVER_BACKEND_MODE');
        expect(readSource('src/embed/EmbedRuntimeOptions.js')).not.toContain('DEFAULT_SOLVER_BACKEND_MODE');
        expect(readSource('src/app/AppDocument.js')).not.toContain('lowerArchivedV2');
        expect(loop).toContain('consecutiveFallbackSteps');
        expect(loop).not.toContain('commitStandbyFromCircuit');
        expect(loop).not.toContain('fellBackThisStep');
        expect(loop).not.toMatch(/backend\.mode\s*=\s*['"]v1['"]/);
        expect(readSource('src/app/RuntimeUiBridge.js')).not.toContain('fellBackThisStep');
        expect(readSource('src/app/RuntimeUiBridge.js')).toContain('仿真已回退到稳定求解器');
        expect(readSource('src/app/RuntimeUiBridge.js')).toContain('已回退');
        expect(readSource('src/app/RuntimeUiBridge.js')).not.toMatch(/solverBackend\.mode\s*=/);
        expect(readSource('README.md')).toContain('ui.solverBackend');
        expect(readSource('AGENTS.md')).toContain('ui.solverBackend');

        const adapter = readSource('src/app/simulation/ComponentViewAdapter.js');
        expect(adapter).not.toContain('copyDynamicsToV1Standby');
        expect(adapter).not.toContain('applySolverBackendRuntimeOptions');
        expect(adapter).not.toContain('applyViewMapToComponents');
        expect(adapter).not.toContain('backend.restoreStandby');
        expect(adapter).toContain('does not restore standby');

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

    it('skips V1 display projection on v2 success and leaves live seed stale', () => {
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

        circuit.prepareSimulation();
        resistor.currentValue = 9;
        circuit.step();
        circuit.haltSimulation();
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.currents.get('R1')).toBe(0.37);
        expect(circuit.lastResults.viewMap.get('R1').currentValue).toBe(0);
        expect(resistor.currentValue).toBe(9);
        expect(resistor.nodes).toBe(liveNodes);
        expect(circuit.nodes).toBe(circuitNodes);
        expect(backend.restoreStandby).not.toHaveBeenCalled();
    });

    it('does not construct V1 MNASolver on the v2 success path', () => {
        const circuit = buildSeriesFixture();
        expect(circuit._solver).toBeUndefined();
        circuit.solverBackend = wrapSolverBackend(createInjectedSolverBackend());
        circuit.prepareSimulation();
        expect(circuit._solver).toBeUndefined();
        circuit.step();
        expect(circuit._solver).toBeUndefined();
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.valid).toBe(true);
        circuit.haltSimulation();
    });

    it('hands the live v2 ViewMap to Renderer.setViewMap through RuntimeUiBridge', () => {
        const circuit = buildSeriesFixture();
        circuit.solverBackend = wrapSolverBackend(createInjectedSolverBackend());
        circuit.prepareSimulation();
        circuit.step();
        circuit.haltSimulation();

        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.viewMap).toBeInstanceOf(Map);
        expect(circuit.lastResults.viewMap.has('R1')).toBe(true);

        const renderer = {
            setViewMap: vi.fn(),
            updateValues: vi.fn(),
            updateWireAnimations: vi.fn()
        };
        const bridge = new RuntimeUiBridge({
            circuit,
            renderer,
            chartWorkspace: {
                onCircuitUpdate: vi.fn(),
                setRuntimeStatus: vi.fn()
            },
            interaction: { selectedComponent: null }
        }, {
            setStatusTextImpl: vi.fn(),
            setSimulationControlsRunningImpl: vi.fn()
        });
        bridge.onCircuitUpdate(circuit.lastResults);
        expect(renderer.setViewMap).toHaveBeenCalledTimes(1);
        expect(renderer.setViewMap).toHaveBeenCalledWith(circuit.lastResults.viewMap);
    });

    it('uses solveFrame even when mode is labeled v1, and stays invalid without a backend', () => {
        const withLabel = buildSeriesFixture();
        const backend = createMockBackend({ mode: 'v1' });
        withLabel.solverBackend = backend;
        const v1Solve = vi.spyOn(withLabel.solver, 'solve');
        withLabel.prepareSimulation();
        withLabel.step();
        withLabel.haltSimulation();
        expect(backend.solveFrame).toHaveBeenCalledTimes(1);
        expect(v1Solve).not.toHaveBeenCalled();
        expect(withLabel.lastResults.backendUsed).toBe('v2');
        expect(withLabel.lastResults.currents.get('R1')).toBe(0.37);

        const bare = buildSeriesFixture();
        delete bare.solverBackend;
        const bareSolve = vi.spyOn(bare.solver, 'solve');
        bare.prepareSimulation();
        bare.step();
        bare.haltSimulation();
        expect(bareSolve).not.toHaveBeenCalled();
        expect(bare.lastResults.valid).toBe(false);
        expect(bare.lastResults.backendUsed).toBe('v2');
    });

    it('keeps V1 unconstructed and the substep invalid when v2 fails', () => {
        const circuit = buildSeriesFixture();
        const backend = createMockBackend({
            solveFrame: vi.fn(() => ({
                valid: false,
                voltages: [],
                currents: new Map(),
                backendUsed: 'v2',
                diagnostics: { code: 'SIM_SINGULAR_MATRIX' }
            }))
        });
        circuit.solverBackend = backend;

        circuit.prepareSimulation();
        expect(circuit._solver).toBeUndefined();
        circuit.step();
        circuit.haltSimulation();

        expect(backend.solveFrame).toHaveBeenCalledTimes(1);
        expect(backend.restoreStandby).not.toHaveBeenCalled();
        expect(backend.commitStandbyFromCircuit).not.toHaveBeenCalled();
        expect(circuit._solver).toBeUndefined();
        expect(backend.fallbackCount).toBe(0);
        expect(backend.consecutiveFallbackSteps).toBe(0);
        expect(backend.mode).toBe('v2');
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.valid).toBe(false);
        expect(circuit.lastResults.diagnostics).toEqual({ code: 'SIM_SINGULAR_MATRIX' });
        expect(circuit.simTime).toBe(0);
        expect(circuit.currentDt).toBeCloseTo(0.01, 12);
    });

    it('feeds an invalid v2 substep into adaptive dt when adaptive is enabled', () => {
        const circuit = buildSeriesFixture();
        circuit.enableAdaptiveTimeStep = true;
        circuit.minAdaptiveDt = 0.001;
        const backend = createMockBackend({
            solveFrame: vi.fn(() => ({
                valid: false,
                voltages: [],
                currents: new Map(),
                backendUsed: 'v2'
            }))
        });
        circuit.solverBackend = backend;
        circuit.prepareSimulation();
        circuit.step();
        circuit.haltSimulation();
        expect(circuit.lastResults.valid).toBe(false);
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit._solver).toBeUndefined();
        expect(circuit.currentDt).toBeCloseTo(0.005, 9);
    });

    it('uses solveFrame for every AC substep even when the backend is labeled shadow', () => {
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
        circuit.solverBackend = wrapSolverBackend(backend);
        const solveSpy = vi.spyOn(circuit.solver, 'solve');

        circuit.prepareSimulation();
        resistor.currentValue = 9;
        const substeps = circuit.getSimulationSubstepCount(circuit.dt);
        expect(substeps).toBeGreaterThan(1);
        circuit.step();
        circuit.haltSimulation();

        expect(solveFrame).toHaveBeenCalledTimes(substeps);
        expect(solveSpy).not.toHaveBeenCalled();
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.currents.get('R1')).toBe(0.37);
        expect(resistor.currentValue).toBe(9);
        expect(circuit.simTime).toBeCloseTo(0.01, 12);
    });
});

describe('wrapSolverBackend', () => {
    it('leaves live seed stale on v2 success and skips the adapter in shadow mode', () => {
        const circuit = buildSeriesFixture();
        const resistor = circuit.getComponent('R1');
        resistor.currentValue = 9;
        resistor.voltageValue = 1;
        resistor.powerValue = 2;
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
        expect(resistor.currentValue).toBe(9);
        expect(resistor.voltageValue).toBe(1);
        expect(resistor.powerValue).toBe(2);
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

    it('leaves the injected backend mode unchanged', () => {
        const backend = { mode: 'v2', solveFrame() {} };
        wrapSolverBackend(backend, { runtimeOptions: { solverBackend: 'v1' } });
        expect(backend.mode).toBe('v2');

        const factory = createInjectedSolverBackend();
        expect(factory.mode).toBe('v2');
        wrapSolverBackend(factory, { runtimeOptions: { solverBackend: 'v1' } });
        expect(factory.mode).toBe('v2');
    });
});

describe('one-shot solveFrame callers', () => {
    it('solveCircuit uses the V1 kernel helper and does not start the clock', () => {
        const circuit = buildSeriesFixture();
        const backend = createMockBackend();
        circuit.solverBackend = backend;
        const solveSpy = vi.spyOn(circuit.solver, 'solve');
        const result = solveCircuit(circuit, 0.02);
        expect(backend.solveFrame).not.toHaveBeenCalled();
        expect(solveSpy).toHaveBeenCalled();
        expect(circuit.isRunning).toBe(false);
        expect(result.currents.get('R1')).toBeCloseTo(0.3, 6);
    });

    it('debugCircuit leaves isRunning false so prepareSimulation still resets simTime', () => {
        const circuit = buildSeriesFixture();
        circuit.solverBackend = createInjectedSolverBackend();
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
        expect(v2Backend.restoreStandby).toBeUndefined();
        expect(circuit.nodes).toBe(liveNodes);
        expect(circuit.getComponent('R1').nodes).toBe(resistorNodes);
        expect(dynSpy).not.toHaveBeenCalled();
        v2Backend.fallbackCount = 3;
        v2Backend.consecutiveFallbackSteps = 12;
        v2Backend.reset();
        expect(v2Backend.fallbackCount).toBe(0);
        expect(v2Backend.consecutiveFallbackSteps).toBe(0);
        expect(v2Backend).not.toHaveProperty('fellBackThisStep');
        expect(v2Backend.mode).toBe('v2');
        expect(v2Backend.commitStandbyFromCircuit).toBeUndefined();
    });
});
