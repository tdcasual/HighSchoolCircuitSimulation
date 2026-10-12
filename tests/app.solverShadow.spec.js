import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getTerminalWorldPosition } from '../src/utils/TerminalGeometry.js';
import * as ComponentViewAdapter from '../src/app/simulation/ComponentViewAdapter.js';
import { runSimulationStepV2 } from '../src/v2/app/usecases/RunSimulationStepV2.js';
import {
    compareSolveSnapshots,
    SHADOW_ABS_TOL,
    SHADOW_REL_TOL,
    SHADOW_SAMPLE_EVERY_N
} from '../src/v2/app/shadow/compareSolveSnapshots.js';
import { SimulationStateV2 } from '../src/v2/simulation/SimulationStateV2.js';
import { snapshotCircuitModel } from '../src/v2/simulation/snapshotCircuitModel.js';
import {
    CANONICAL_SOLVER_CASES,
    getCanonicalSolverCase,
    buildRuntimeCircuit
} from './helpers/solverParityHarness.js';
import { addComponent, connectWire, createTestCircuit, solveCircuit } from './helpers/circuitTestUtils.js';

const SAMPLE_EVERY_N = SHADOW_SAMPLE_EVERY_N;

function readSource(relPath) {
    return readFileSync(resolve(process.cwd(), relPath), 'utf8');
}

function snapshotNodes(circuit) {
    const components = {};
    for (const [id, component] of circuit.components) {
        components[id] = Array.isArray(component.nodes) ? [...component.nodes] : [];
    }
    const wires = {};
    for (const [id, wire] of circuit.wires) {
        wires[id] = wire.nodeIndex;
    }
    return {
        components,
        wires,
        circuitNodes: Array.isArray(circuit.nodes) ? circuit.nodes.map((node) => node) : []
    };
}

function collectSolveSnapshot(result, nodeSources) {
    const currents = {};
    const terminalVoltages = {};
    for (const source of nodeSources) {
        const id = source.id;
        if (result?.currents instanceof Map) {
            if (result.currents.has(id)) {
                currents[id] = result.currents.get(id);
            }
        } else if (result?.currents && Object.prototype.hasOwnProperty.call(result.currents, id)) {
            currents[id] = result.currents[id];
        }
        const nodes = Array.isArray(source.nodes) ? source.nodes : [];
        terminalVoltages[id] = nodes.map((nodeIndex) => {
            if (!Number.isInteger(nodeIndex) || nodeIndex < 0) return undefined;
            if (!Array.isArray(result?.voltages) || nodeIndex >= result.voltages.length) {
                return undefined;
            }
            return result.voltages[nodeIndex];
        });
    }
    return { currents, terminalVoltages };
}

function runV2ShadowLeg({ circuit, simulationState, dt, simTime }) {
    return runSimulationStepV2({
        circuitModel: snapshotCircuitModel(circuit),
        simulationState,
        options: {
            dt,
            simTime,
            getTerminalWorldPosition: (_componentId, terminalIndex, comp) => (
                getTerminalWorldPosition(comp, terminalIndex)
            )
        }
    });
}

describe('compareSolveSnapshots', () => {
    it('treats missing current keys as mismatches instead of coercing them to 0', () => {
        const missingVsZero = compareSolveSnapshots(
            { currents: { R1: 0 }, terminalVoltages: { R1: [0, 0] } },
            { currents: {}, terminalVoltages: { R1: [0, 0] } }
        );
        expect(missingVsZero.mismatchCount).toBeGreaterThan(0);

        const missingVsNoise = compareSolveSnapshots(
            { currents: { R1: 1e-7 }, terminalVoltages: { R1: [0, 0] } },
            { currents: {}, terminalVoltages: { R1: [0, 0] } }
        );
        expect(missingVsNoise.mismatchCount).toBeGreaterThan(0);
    });

    it('mismatches only when relative error exceeds 1e-3 and absolute error exceeds 1e-6', () => {
        expect(SHADOW_REL_TOL).toBe(1e-3);
        expect(SHADOW_ABS_TOL).toBe(1e-6);

        const aligned = compareSolveSnapshots(
            { currents: { R1: 0.3 }, terminalVoltages: { R1: [2.4, 0] } },
            { currents: { R1: 0.3 }, terminalVoltages: { R1: [2.4, 0] } }
        );
        expect(aligned.mismatchCount).toBe(0);

        const tinyAbsolute = compareSolveSnapshots(
            { currents: { R1: 0 }, terminalVoltages: { R1: [0, 0] } },
            { currents: { R1: 1e-7 }, terminalVoltages: { R1: [0, 0] } }
        );
        expect(tinyAbsolute.mismatchCount).toBe(0);

        const largeRelativeSmallStep = compareSolveSnapshots(
            { currents: { R1: 1000 }, terminalVoltages: { R1: [1000, 0] } },
            { currents: { R1: 1000.9 }, terminalVoltages: { R1: [1000, 0] } }
        );
        expect(largeRelativeSmallStep.mismatchCount).toBe(0);

        const bothOver = compareSolveSnapshots(
            { currents: { R1: 1 }, terminalVoltages: { R1: [1, 0] } },
            { currents: { R1: 1.002 }, terminalVoltages: { R1: [1, 0] } }
        );
        expect(bothOver.mismatchCount).toBeGreaterThan(0);
    });

    it('mismatches voltage-only snapshots while currents stay aligned', () => {
        const currents = { R1: 0.3 };

        const missingKey = compareSolveSnapshots(
            { currents, terminalVoltages: { R1: [1, 0] } },
            { currents, terminalVoltages: {} }
        );
        expect(missingKey.mismatchCount).toBeGreaterThan(0);

        const overThreshold = compareSolveSnapshots(
            { currents, terminalVoltages: { R1: [1, 0] } },
            { currents, terminalVoltages: { R1: [1.002, 0] } }
        );
        expect(overThreshold.mismatchCount).toBeGreaterThan(0);

        const tinyAbsolute = compareSolveSnapshots(
            { currents, terminalVoltages: { R1: [0] } },
            { currents, terminalVoltages: { R1: [1e-7] } }
        );
        expect(tinyAbsolute.mismatchCount).toBe(0);

        const lengthMismatch = compareSolveSnapshots(
            { currents, terminalVoltages: { R1: [1, 0] } },
            { currents, terminalVoltages: { R1: [1, 0, 0] } }
        );
        expect(lengthMismatch.mismatchCount).toBeGreaterThan(0);
        expect(lengthMismatch.mismatches.some((item) => item.path === 'terminalVoltages.R1.length')).toBe(true);
    });
});

describe('solver shadow harness (tests only)', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('keeps production loop and driver free of V2 solver identifiers and adapter calls', () => {
        const loopSource = readSource('src/core/services/CircuitSimulationLoopService.js');
        const driverSource = readSource('src/app/SimulationDriver.js');
        const runtimeSource = readSource('src/app/AppRuntimeV2.js');
        expect(loopSource).not.toMatch(/SolveCircuitV2|runSimulationStepV2|applyViewMapToComponents|snapshotCircuitModel|compareSolveSnapshots/);
        expect(driverSource).not.toMatch(/SolveCircuitV2|runSimulationStepV2|applyViewMapToComponents|compareSolveSnapshots|shadow/i);
        expect(runtimeSource).not.toMatch(/SolveCircuitV2|runSimulationStepV2/);
        const v2Usecase = readSource('src/v2/app/usecases/RunSimulationStepV2.js');
        const projector = readSource('src/v2/app/ResultProjector.js');
        expect(v2Usecase).not.toContain('applyViewMapToComponents');
        expect(v2Usecase).not.toContain('ComponentViewAdapter');
        expect(projector).not.toContain('applyViewMapToComponents');
        expect(SAMPLE_EVERY_N).toBe(5);
    });

    it('dual-runs aligned extension cases at substep 0 with mismatch 0 and no adapter on the V2 leg', () => {
        const adapterSpy = vi.spyOn(ComponentViewAdapter, 'applyViewMapToComponents');

        for (const entry of CANONICAL_SOLVER_CASES) {
            const runtime = buildRuntimeCircuit(getCanonicalSolverCase(entry.id));
            const circuit = runtime.circuit;
            circuit.resetSimulationState();
            circuit.solver.setSimulationState(circuit.simulationState);
            circuit.lastResults = { sentinel: true };
            const lastResultsSentinel = circuit.lastResults;
            const simTimeBefore = circuit.simTime;
            const nodesBefore = snapshotNodes(circuit);

            const v1Result = solveCircuit(circuit, simTimeBefore);
            const v1Snapshot = collectSolveSnapshot(
                v1Result,
                Array.from(circuit.components.values())
            );

            const v2State = new SimulationStateV2();
            const v2 = runV2ShadowLeg({
                circuit,
                simulationState: v2State,
                dt: circuit.dt,
                simTime: simTimeBefore
            });
            const v2Snapshot = collectSolveSnapshot(v2.solveResult, v2.netlist.components);

            expect(circuit.simTime).toBe(simTimeBefore);
            expect(circuit.lastResults).toBe(lastResultsSentinel);
            expect(snapshotNodes(circuit)).toEqual(nodesBefore);
            expect(adapterSpy).not.toHaveBeenCalled();

            const comparison = compareSolveSnapshots(v1Snapshot, v2Snapshot);
            if (v1Result.valid && v2.solveResult.valid) {
                expect(comparison.mismatchCount, entry.id).toBe(0);
            } else {
                expect(entry.id).toBe('conflicting-ideal-sources');
            }
        }
    });

    it('samples every 5 wall-clock ticks at substep 0 only and does not run the adapter on the V2 leg', () => {
        const adapterSpy = vi.spyOn(ComponentViewAdapter, 'applyViewMapToComponents');
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

        expect(circuit.getComponent('VAC').frequency).toBe(50);
        expect(circuit.getComponent('VAC').phase).toBe(90);
        expect(circuit.getComponent('R1').resistance).toBe(10);
        expect(circuit.getAllWires().length).toBe(2);
        const substepCount = circuit.getSimulationSubstepCount(circuit.dt);
        expect(substepCount).toBeGreaterThan(1);

        circuit.resetSimulationState();
        circuit.ensureSolverPrepared();
        circuit.solver.setSimulationState(circuit.simulationState);
        circuit.simTime = 0;
        circuit.lastResults = { sentinel: true };
        const lastResultsSentinel = circuit.lastResults;

        const v2State = new SimulationStateV2();
        let v2SolveCount = 0;
        let comparedSubsteps = [];
        let mismatchCount = 0;
        const sampledAbsCurrent = [];
        const ticks = 10;

        for (let tick = 0; tick < ticks; tick += 1) {
            const stepSubsteps = circuit.getSimulationSubstepCount(circuit.dt);
            const substepDt = circuit.dt / stepSubsteps;
            for (let sub = 0; sub < stepSubsteps; sub += 1) {
                const startSimTime = circuit.simTime;
                const v1Result = circuit.solver.solve(substepDt, startSimTime);

                if (tick % SAMPLE_EVERY_N === 0 && sub === 0) {
                    const nodesBefore = snapshotNodes(circuit);
                    const v2 = runV2ShadowLeg({
                        circuit,
                        simulationState: v2State,
                        dt: substepDt,
                        simTime: startSimTime
                    });
                    v2SolveCount += 1;
                    comparedSubsteps.push({ tick, sub });
                    expect(circuit.simTime).toBe(startSimTime);
                    expect(circuit.lastResults).toBe(lastResultsSentinel);
                    expect(snapshotNodes(circuit)).toEqual(nodesBefore);
                    expect(adapterSpy).not.toHaveBeenCalled();

                    const v1Snapshot = collectSolveSnapshot(
                        v1Result,
                        Array.from(circuit.components.values())
                    );
                    const v2Snapshot = collectSolveSnapshot(v2.solveResult, v2.netlist.components);
                    expect(Object.prototype.hasOwnProperty.call(v1Snapshot.currents, 'R1')).toBe(true);
                    sampledAbsCurrent.push(Math.abs(v1Snapshot.currents.R1));
                    mismatchCount += compareSolveSnapshots(v1Snapshot, v2Snapshot).mismatchCount;
                }

                if (!v1Result.valid) break;
                circuit.simTime += substepDt;
                circuit.solver.updateDynamicComponents(v1Result.voltages, v1Result.currents);
            }
        }

        expect(v2SolveCount).toBe(2);
        expect(comparedSubsteps).toEqual([
            { tick: 0, sub: 0 },
            { tick: 5, sub: 0 }
        ]);
        expect(v2SolveCount).not.toBe(ticks * substepCount);
        expect(sampledAbsCurrent).toHaveLength(2);
        expect(sampledAbsCurrent[0]).toBeGreaterThan(1);
        expect(sampledAbsCurrent[1]).toBeGreaterThan(1);
        expect(sampledAbsCurrent[0]).toBeCloseTo(Math.SQRT2, 2);
        expect(sampledAbsCurrent[0]).not.toBe(0);
        expect(mismatchCount).toBe(0);
        expect(circuit.simTime).toBeCloseTo(ticks * circuit.dt, 12);
        expect(circuit.lastResults).toBe(lastResultsSentinel);
        expect(adapterSpy).not.toHaveBeenCalled();
    });
});
