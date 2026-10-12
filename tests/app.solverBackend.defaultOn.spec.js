import { afterEach, describe, expect, it, vi } from 'vitest';
import { wrapSolverBackend } from '../src/app/simulation/ComponentViewAdapter.js';
import { parseEmbedRuntimeOptionsFromSearch } from '../src/embed/EmbedRuntimeOptions.js';
import {
    createInjectedSolverBackend,
    DEFAULT_SOLVER_BACKEND_MODE
} from '../src/v2/app/createInjectedSolverBackend.js';
import { addComponent, connectWire, createTestCircuit } from './helpers/circuitTestUtils.js';

function buildSeriesFixture() {
    const circuit = createTestCircuit();
    circuit.dt = 0.01;
    addComponent(circuit, 'PowerSource', 'V1', { voltage: 3, internalResistance: 2 });
    addComponent(circuit, 'Resistor', 'R1', { resistance: 8 });
    connectWire(circuit, 'W1', 'V1', 0, 'R1', 0);
    connectWire(circuit, 'W2', 'R1', 1, 'V1', 1);
    return circuit;
}

function buildRcFixture() {
    const circuit = createTestCircuit();
    circuit.dt = 0.01;
    addComponent(circuit, 'PowerSource', 'V1', { voltage: 6, internalResistance: 0 });
    addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
    addComponent(circuit, 'Capacitor', 'C1', { capacitance: 0.001 });
    connectWire(circuit, 'W1', 'V1', 0, 'R1', 0);
    connectWire(circuit, 'W2', 'R1', 1, 'C1', 0);
    connectWire(circuit, 'W3', 'C1', 1, 'V1', 1);
    return circuit;
}

describe('solverBackend default-on v2', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('uses the factory default v2 on 3V/8Ω with backendUsed v2 and no fallback', () => {
        expect(DEFAULT_SOLVER_BACKEND_MODE).toBe('v2');
        const circuit = buildSeriesFixture();
        const backend = createInjectedSolverBackend();
        expect(backend.mode).toBe('v2');
        circuit.solverBackend = backend;

        circuit.prepareSimulation();
        expect(circuit.getSimulationSubstepCount(circuit.dt)).toBe(1);
        circuit.step();
        circuit.haltSimulation();

        expect(circuit.simTime).toBeCloseTo(0.01, 12);
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.solverBackend.fallbackCount).toBe(0);
        expect(circuit.solverBackend.consecutiveFallbackSteps).toBe(0);
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.currents.has('R1')).toBe(true);
        expect(circuit.lastResults.currents.get('R1')).toBeCloseTo(0.3, 6);
        expect(circuit.lastResults.currents.has('V1')).toBe(true);
        expect(circuit.lastResults.currents.get('V1')).toBeCloseTo(0.3, 6);
        const resistor = circuit.getComponent('R1');
        const n1 = resistor.nodes[0];
        const n2 = resistor.nodes[1];
        expect(Number.isInteger(n1)).toBe(true);
        expect(Number.isInteger(n2)).toBe(true);
        expect(circuit.lastResults.voltages[n1] - circuit.lastResults.voltages[n2]).toBeCloseTo(2.4, 6);
    });

    it('advances simTime by dt across four forced substeps and calls solveFrame four times', () => {
        const circuit = buildSeriesFixture();
        const backend = createInjectedSolverBackend();
        const solveFrame = vi.spyOn(backend, 'solveFrame');
        circuit.solverBackend = backend;
        vi.spyOn(circuit.simulationLoopService, 'getSimulationSubstepCount').mockReturnValue(4);

        circuit.prepareSimulation();
        circuit.step();
        circuit.haltSimulation();

        expect(circuit.simTime).toBeCloseTo(0.01, 12);
        expect(solveFrame).toHaveBeenCalledTimes(4);
        expect(solveFrame.mock.calls[0][0].dt).toBeCloseTo(0.0025, 12);
        expect(solveFrame.mock.calls[1][0].dt).toBeCloseTo(0.0025, 12);
        expect(solveFrame.mock.calls[1][0].simTime).toBeCloseTo(0.0025, 12);
        expect(solveFrame.mock.calls[3][0].simTime).toBeCloseTo(0.0075, 12);
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(backend.fallbackCount).toBe(0);
        expect(circuit.lastResults.currents.has('R1')).toBe(true);
        expect(circuit.lastResults.currents.get('R1')).toBeCloseTo(0.3, 6);
    });

    it('stops the v2 step on the first invalid substep without constructing V1', () => {
        const circuit = buildSeriesFixture();
        const backend = createInjectedSolverBackend();
        const innerSolveFrame = backend.solveFrame.bind(backend);
        let frame = 0;
        backend.solveFrame = (input) => {
            frame += 1;
            if (frame === 2) {
                return {
                    valid: false,
                    voltages: [],
                    currents: new Map(),
                    backendUsed: 'v2',
                    diagnostics: { code: 'SIM_SINGULAR_MATRIX' }
                };
            }
            return innerSolveFrame(input);
        };
        circuit.solverBackend = backend;
        vi.spyOn(circuit.simulationLoopService, 'getSimulationSubstepCount').mockReturnValue(4);

        circuit.prepareSimulation();
        expect(circuit._solver).toBeUndefined();
        circuit.step();
        circuit.haltSimulation();

        expect(frame).toBe(2);
        expect(circuit._solver).toBeUndefined();
        expect(backend.fallbackCount).toBe(0);
        expect(backend.consecutiveFallbackSteps).toBe(0);
        expect(backend.mode).toBe('v2');
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.valid).toBe(false);
        expect(circuit.lastResults.diagnostics).toEqual({ code: 'SIM_SINGULAR_MATRIX' });
        expect(circuit.simTime).toBeCloseTo(0.0025, 12);
    });

    it('resumes v2 on the next wall-clock step after an invalid substep', () => {
        const circuit = buildSeriesFixture();
        const backend = createInjectedSolverBackend();
        const innerSolveFrame = backend.solveFrame.bind(backend);
        let wallClock = 0;
        backend.solveFrame = (input) => {
            if (wallClock === 0) {
                return {
                    valid: false,
                    voltages: [],
                    currents: new Map(),
                    backendUsed: 'v2'
                };
            }
            return innerSolveFrame(input);
        };
        circuit.solverBackend = backend;
        circuit.prepareSimulation();
        circuit.step();
        expect(circuit._solver).toBeUndefined();
        expect(backend.fallbackCount).toBe(0);
        expect(backend.consecutiveFallbackSteps).toBe(0);
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.valid).toBe(false);
        expect(circuit.simTime).toBe(0);

        wallClock = 1;
        circuit.step();
        circuit.haltSimulation();
        expect(circuit._solver).toBeUndefined();
        expect(backend.consecutiveFallbackSteps).toBe(0);
        expect(backend.mode).toBe('v2');
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.currents.has('R1')).toBe(true);
        expect(circuit.lastResults.currents.get('R1')).toBeCloseTo(0.3, 6);
        expect(circuit.simTime).toBeCloseTo(0.01, 12);
    });

    it('wraps the factory so ViewMap holds 3V/8Ω current and live seed stays stale', () => {
        const circuit = buildSeriesFixture();
        const backend = createInjectedSolverBackend();
        expect(backend.restoreStandby).toBeUndefined();
        circuit.solverBackend = wrapSolverBackend(backend);
        const dynSpy = vi.spyOn(circuit.solver, 'updateDynamicComponents');

        circuit.prepareSimulation();
        const resistor = circuit.getComponent('R1');
        const liveNodes = resistor.nodes;
        const circuitNodes = circuit.nodes;
        resistor.currentValue = 9;
        circuit.step();
        circuit.haltSimulation();

        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.currents.has('R1')).toBe(true);
        expect(circuit.lastResults.currents.get('R1')).toBeCloseTo(0.3, 6);
        expect(circuit.lastResults.viewMap.has('R1')).toBe(true);
        expect(circuit.lastResults.viewMap.get('R1').currentValue).toBeCloseTo(0.3, 6);
        expect(resistor.currentValue).toBe(9);
        expect(dynSpy).not.toHaveBeenCalled();
        expect(resistor.nodes).toBe(liveNodes);
        expect(circuit.nodes).toBe(circuitNodes);
        expect(backend.fallbackCount).toBe(0);
        expect(backend.consecutiveFallbackSteps).toBe(0);
    });

    it('keeps live fuse unblown while ViewMap reports the blown V2 state', () => {
        const circuit = buildSeriesFixture();
        const fuse = addComponent(circuit, 'Fuse', 'F1', {
            ratedCurrent: 3,
            coldResistance: 0.05,
            blownResistance: 1e12,
            blown: false,
            i2tAccum: 0.1
        });
        const backend = {
            mode: 'v2',
            fallbackCount: 0,
            consecutiveFallbackSteps: 0,
            solveFrame: vi.fn(() => ({
                valid: true,
                voltages: [0, 2.4],
                currents: new Map([
                    ['R1', 0.3],
                    ['F1', 0]
                ]),
                backendUsed: 'v2',
                viewMap: new Map([
                    ['R1', { currentValue: 0.3, voltageValue: 2.4, powerValue: 0.72 }],
                    ['F1', { currentValue: 0, voltageValue: 0, powerValue: 0, blown: true, i2tAccum: 4 }]
                ])
            })),
            restoreStandby: vi.fn(),
            reset: vi.fn()
        };
        circuit.solverBackend = wrapSolverBackend(backend);
        circuit.prepareSimulation();
        fuse.blown = false;
        fuse.i2tAccum = 0.1;
        circuit.step();
        circuit.haltSimulation();

        expect(backend.restoreStandby).not.toHaveBeenCalled();
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.valid).toBe(true);
        expect(fuse.blown).toBe(false);
        expect(fuse.i2tAccum).toBe(0.1);
        expect(circuit.lastResults.viewMap.get('F1').blown).toBe(true);
        expect(circuit.getComponentProperties(fuse).blown).toBe(true);
        expect(circuit.getComponentProperties(fuse).i2tAccum).toBe(4);
        expect(circuit._solver).toBeUndefined();
    });

    it('calls solveFrame once when every v2 substep would be invalid', () => {
        const circuit = buildSeriesFixture();
        const backend = createInjectedSolverBackend();
        backend.solveFrame = vi.fn(() => ({
            valid: false,
            voltages: [],
            currents: new Map(),
            backendUsed: 'v2'
        }));
        circuit.solverBackend = backend;
        vi.spyOn(circuit.simulationLoopService, 'getSimulationSubstepCount').mockReturnValue(4);

        circuit.prepareSimulation();
        circuit.step();
        circuit.haltSimulation();

        expect(backend.solveFrame).toHaveBeenCalledTimes(1);
        expect(circuit._solver).toBeUndefined();
        expect(backend.fallbackCount).toBe(0);
        expect(backend.consecutiveFallbackSteps).toBe(0);
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.valid).toBe(false);
        expect(circuit.simTime).toBe(0);
        expect(backend.mode).toBe('v2');
    });

    it('keeps capacitor V2 history across a failed wall-clock step', () => {
        const circuit = buildRcFixture();
        const backend = createInjectedSolverBackend();
        const innerSolveFrame = backend.solveFrame.bind(backend);
        let failV2 = false;
        backend.solveFrame = (input) => {
            if (failV2) {
                return {
                    valid: false,
                    voltages: [],
                    currents: new Map(),
                    backendUsed: 'v2'
                };
            }
            return innerSolveFrame(input);
        };
        circuit.solverBackend = backend;

        circuit.prepareSimulation();
        circuit.step();
        expect(circuit._solver).toBeUndefined();
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.nextState.get('C1')).toBeDefined();
        const voltageA = circuit.lastResults.nextState.get('C1').prevVoltage;
        expect(Number.isFinite(voltageA)).toBe(true);
        expect(Math.abs(voltageA)).toBeGreaterThan(0.01);
        expect(backend.fallbackCount).toBe(0);

        failV2 = true;
        circuit.step();
        expect(circuit._solver).toBeUndefined();
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.valid).toBe(false);
        expect(circuit.simTime).toBeCloseTo(0.01, 12);

        failV2 = false;
        circuit.step();
        circuit.haltSimulation();
        expect(circuit._solver).toBeUndefined();
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.nextState.get('C1')).toBeDefined();
        const voltageD = circuit.lastResults.nextState.get('C1').prevVoltage;
        expect(Number.isFinite(voltageD)).toBe(true);
        expect(voltageD).not.toBe(voltageA);
        expect(Math.abs(voltageD)).toBeGreaterThan(Math.abs(voltageA));
        expect(backend.consecutiveFallbackSteps).toBe(0);
        expect(circuit.simTime).toBeCloseTo(0.02, 12);
    });

    it('pins embed without solver= to v2 matching the classroom factory default', () => {
        expect(DEFAULT_SOLVER_BACKEND_MODE).toBe('v2');
        const embed = parseEmbedRuntimeOptionsFromSearch(
            '?embed=1&targetOrigin=https%3A%2F%2Flms.example'
        );
        expect(embed.enabled).toBe(true);
        expect(embed.solverBackend).toBe('v2');
        expect(embed.solverBackendExplicit).toBe(false);

        const classroom = parseEmbedRuntimeOptionsFromSearch('');
        expect(classroom.solverBackend).toBeUndefined();
        expect(classroom.solverBackendExplicit).toBe(false);

        const backend = createInjectedSolverBackend();
        expect(backend.mode).toBe('v2');
        wrapSolverBackend(backend, { runtimeOptions: embed });
        expect(backend.mode).toBe('v2');
    });
});
