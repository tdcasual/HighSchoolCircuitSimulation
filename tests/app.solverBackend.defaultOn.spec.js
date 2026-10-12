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

    it('restores capacitor prevVoltage from V2 standby on a singular substep-2 fallback', () => {
        const circuit = buildRcFixture();
        const backend = createInjectedSolverBackend();
        const innerSolveFrame = backend.solveFrame.bind(backend);
        let frame = 0;
        let standbyPrevVoltage;
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
            const result = innerSolveFrame(input);
            if (frame === 1) {
                const entry = result.nextState?.get?.('C1');
                standbyPrevVoltage = entry?.prevVoltage;
            }
            return result;
        };
        const innerRestore = backend.restoreStandby.bind(backend);
        const restoreSnapshots = [];
        backend.restoreStandby = (target) => {
            const cap = target.getComponent('C1');
            const entry = target.simulationState?.get?.('C1');
            restoreSnapshots.push({
                phase: 'before',
                comp: cap.prevVoltage,
                state: entry?.prevVoltage
            });
            innerRestore(target);
            restoreSnapshots.push({
                phase: 'after',
                comp: cap.prevVoltage,
                state: target.simulationState?.get?.('C1')?.prevVoltage
            });
        };
        const originalSolve = circuit.solver.solve.bind(circuit.solver);
        const v1SolveArgs = [];
        circuit.solver.solve = (dt, simTime) => {
            const cap = circuit.getComponent('C1');
            v1SolveArgs.push({
                dt,
                simTime,
                prevVoltage: cap.prevVoltage,
                statePrevVoltage: circuit.simulationState.get('C1')?.prevVoltage
            });
            return originalSolve(dt, simTime);
        };
        circuit.solverBackend = backend;
        vi.spyOn(circuit.simulationLoopService, 'getSimulationSubstepCount').mockReturnValue(4);

        circuit.prepareSimulation();
        const cap = circuit.getComponent('C1');
        expect(cap.prevVoltage).toBe(0);
        expect(circuit.simulationState.get('C1')?.prevVoltage).toBe(0);

        circuit.step();
        circuit.haltSimulation();

        expect(frame).toBe(4);
        expect(v1SolveArgs).toHaveLength(1);
        expect(v1SolveArgs[0].dt).toBeCloseTo(0.0025, 12);
        expect(v1SolveArgs[0].simTime).toBeCloseTo(0.0025, 12);
        expect(Number.isFinite(standbyPrevVoltage)).toBe(true);
        expect(Math.abs(standbyPrevVoltage)).toBeGreaterThan(0.01);
        expect(restoreSnapshots.some((snap) => snap.phase === 'before')).toBe(true);
        const before = restoreSnapshots.find((snap) => snap.phase === 'before');
        const after = restoreSnapshots.find((snap) => snap.phase === 'after');
        expect(before.comp).toBe(0);
        expect(before.state).toBe(0);
        expect(after.comp).toBe(standbyPrevVoltage);
        expect(after.state).toBe(standbyPrevVoltage);
        expect(v1SolveArgs[0].prevVoltage).toBe(standbyPrevVoltage);
        expect(v1SolveArgs[0].statePrevVoltage).toBe(standbyPrevVoltage);
        expect(circuit.simTime).toBeCloseTo(0.01, 12);
        expect(backend.fallbackCount).toBe(1);
        expect(backend.consecutiveFallbackSteps).toBe(1);
        expect(backend.mode).toBe('v2');
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.currents.has('C1')).toBe(true);
        expect(Number.isFinite(circuit.lastResults.currents.get('C1'))).toBe(true);
    });

    it('resets consecutive fallback on the next clean v2 wall-clock step', () => {
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
        expect(backend.fallbackCount).toBe(1);
        expect(backend.consecutiveFallbackSteps).toBe(1);
        expect(circuit.lastResults.backendUsed).toBe('v1');
        expect(circuit.lastResults.currents.has('R1')).toBe(true);
        expect(circuit.lastResults.currents.get('R1')).toBeCloseTo(0.3, 6);

        wallClock = 1;
        circuit.step();
        circuit.haltSimulation();
        expect(backend.consecutiveFallbackSteps).toBe(0);
        expect(backend.mode).toBe('v2');
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.currents.has('R1')).toBe(true);
        expect(circuit.lastResults.currents.get('R1')).toBeCloseTo(0.3, 6);
        expect(circuit.simTime).toBeCloseTo(0.02, 12);
    });

    it('wraps the factory so ViewMap holds 3V/8Ω current and live seed stays stale', () => {
        const circuit = buildSeriesFixture();
        const backend = createInjectedSolverBackend();
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

    it('counts four V1 fallbacks in one wall-clock step as one consecutive step', () => {
        const circuit = buildSeriesFixture();
        const backend = createInjectedSolverBackend();
        backend.solveFrame = () => ({
            valid: false,
            voltages: [],
            currents: new Map(),
            backendUsed: 'v2'
        });
        circuit.solverBackend = backend;
        vi.spyOn(circuit.simulationLoopService, 'getSimulationSubstepCount').mockReturnValue(4);

        circuit.prepareSimulation();
        circuit.step();
        circuit.haltSimulation();

        expect(backend.fallbackCount).toBe(4);
        expect(backend.consecutiveFallbackSteps).toBe(1);
        expect(circuit.lastResults.backendUsed).toBe('v1');
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.currents.has('R1')).toBe(true);
        expect(circuit.lastResults.currents.get('R1')).toBeCloseTo(0.3, 6);
        expect(circuit.simTime).toBeCloseTo(0.01, 12);
        expect(backend.mode).toBe('v2');
    });

    it('recaptures V1-advanced capacitor history after consecutive wall-clock fallbacks', () => {
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
        const originalSolve = circuit.solver.solve.bind(circuit.solver);
        const v1Solves = [];
        circuit.solver.solve = (dt, simTime) => {
            const cap = circuit.getComponent('C1');
            v1Solves.push({
                dt,
                simTime,
                prevVoltage: cap.prevVoltage,
                statePrevVoltage: circuit.simulationState.get('C1')?.prevVoltage
            });
            return originalSolve(dt, simTime);
        };
        circuit.solverBackend = backend;

        circuit.prepareSimulation();
        circuit.step();
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.nextState.get('C1')).toBeDefined();
        const voltageA = circuit.lastResults.nextState.get('C1').prevVoltage;
        expect(Number.isFinite(voltageA)).toBe(true);
        expect(Math.abs(voltageA)).toBeGreaterThan(0.01);
        expect(backend.fallbackCount).toBe(0);

        failV2 = true;
        circuit.step();
        expect(v1Solves).toHaveLength(1);
        expect(v1Solves[0].prevVoltage).toBe(voltageA);
        expect(v1Solves[0].statePrevVoltage).toBe(voltageA);
        expect(circuit.lastResults.backendUsed).toBe('v1');
        expect(circuit.simulationState.get('C1')).toBeDefined();
        const voltageB = circuit.simulationState.get('C1').prevVoltage;
        expect(Number.isFinite(voltageB)).toBe(true);
        expect(voltageB).not.toBe(voltageA);
        expect(Math.abs(voltageB - voltageA)).toBeGreaterThan(1e-6);
        expect(backend.consecutiveFallbackSteps).toBe(1);

        circuit.step();
        expect(v1Solves).toHaveLength(2);
        expect(v1Solves[1].prevVoltage).toBe(voltageB);
        expect(v1Solves[1].statePrevVoltage).toBe(voltageB);
        expect(v1Solves[1].prevVoltage).not.toBe(voltageA);
        expect(circuit.lastResults.backendUsed).toBe('v1');
        const voltageC = circuit.simulationState.get('C1').prevVoltage;
        expect(Number.isFinite(voltageC)).toBe(true);
        expect(voltageC).not.toBe(voltageB);
        expect(Math.abs(voltageC - voltageB)).toBeGreaterThan(1e-6);
        expect(backend.consecutiveFallbackSteps).toBe(2);
        expect(backend.fallbackCount).toBe(2);

        failV2 = false;
        circuit.step();
        circuit.haltSimulation();
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.nextState.get('C1')).toBeDefined();
        const voltageD = circuit.lastResults.nextState.get('C1').prevVoltage;
        expect(Number.isFinite(voltageD)).toBe(true);
        expect(voltageD).not.toBe(voltageA);
        expect(voltageD).not.toBe(voltageB);
        expect(voltageD).toBeGreaterThan(voltageC - 1e-12);
        expect(backend.consecutiveFallbackSteps).toBe(0);
        expect(circuit.simTime).toBeCloseTo(0.04, 12);
    });

    it('keeps embed without solver= pinned to v1 while classroom factory default is v2', () => {
        expect(DEFAULT_SOLVER_BACKEND_MODE).toBe('v2');
        const embed = parseEmbedRuntimeOptionsFromSearch(
            '?embed=1&targetOrigin=https%3A%2F%2Flms.example'
        );
        expect(embed.enabled).toBe(true);
        expect(embed.solverBackend).toBe('v1');
        expect(embed.solverBackendExplicit).toBe(false);

        const classroom = parseEmbedRuntimeOptionsFromSearch('');
        expect(classroom.solverBackend).toBeUndefined();
        expect(classroom.solverBackendExplicit).toBe(false);

        const backend = createInjectedSolverBackend();
        expect(backend.mode).toBe('v2');
        wrapSolverBackend(backend, { runtimeOptions: embed });
        expect(backend.mode).toBe('v1');
    });
});
