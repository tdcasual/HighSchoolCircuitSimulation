import { describe, it, expect, vi } from 'vitest';
import { SimulationRefreshSkill } from '../src/ai/skills/SimulationRefreshSkill.js';

describe('SimulationRefreshSkill', () => {
    it('refreshes circuit values through one-shot solveFrame', () => {
        const solveFrame = vi.fn().mockReturnValue({
            valid: true,
            voltages: [0, 1],
            currents: new Map()
        });
        const circuit = {
            dt: 0.01,
            simTime: 1,
            solverBackend: {
                mode: 'v2',
                solveFrame
            },
            rebuildNodes: vi.fn(),
            ensureSolverPrepared: vi.fn(),
            lastResults: null
        };

        const result = SimulationRefreshSkill.run({ circuit });

        expect(result.ok).toBe(true);
        expect(result.valid).toBe(true);
        expect(solveFrame).toHaveBeenCalledTimes(1);
        expect(solveFrame).toHaveBeenCalledWith(expect.objectContaining({
            commitState: false
        }));
        expect(circuit.simTime).toBe(1);
    });

    it('returns graceful failure when solver is missing', () => {
        const result = SimulationRefreshSkill.run({
            circuit: {
                rebuildNodes: vi.fn(),
                ensureSolverPrepared: vi.fn()
            }
        });

        expect(result.ok).toBe(false);
        expect(result.reason).toContain('求解器不可用');
    });

    it('reuses lastResults when a classroom frame already exists', () => {
        const solveFrame = vi.fn();
        const rebuildNodes = vi.fn();
        const circuit = {
            isRunning: true,
            lastResults: { valid: true, voltages: [0, 1], currents: new Map() },
            solverBackend: { solveFrame },
            rebuildNodes,
            ensureSolverPrepared: vi.fn()
        };

        const result = SimulationRefreshSkill.run({ circuit });

        expect(result.ok).toBe(true);
        expect(result.refreshed).toBe(true);
        expect(solveFrame).not.toHaveBeenCalled();
        expect(rebuildNodes).not.toHaveBeenCalled();
        expect(circuit.lastResults.voltages).toEqual([0, 1]);
    });

    it('reuses lastResults after the classroom tick is stopped', () => {
        const solveFrame = vi.fn();
        const circuit = {
            isRunning: false,
            lastResults: { valid: true, voltages: [0, 0.45], currents: new Map() },
            solverBackend: { solveFrame },
            rebuildNodes: vi.fn(),
            ensureSolverPrepared: vi.fn()
        };

        const result = SimulationRefreshSkill.run({ circuit });

        expect(result.ok).toBe(true);
        expect(solveFrame).not.toHaveBeenCalled();
        expect(circuit.rebuildNodes).not.toHaveBeenCalled();
        expect(circuit.lastResults.voltages).toEqual([0, 0.45]);
    });

    it('does not reuse lastResults after a dirty edit', () => {
        const solveFrame = vi.fn().mockReturnValue({
            valid: true,
            voltages: [0, 0.006],
            currents: new Map([['R1', 0.006]])
        });
        const circuit = {
            isRunning: false,
            solverCircuitDirty: true,
            lastResults: { valid: true, voltages: [0, 2.857], currents: new Map([['R1', 0.286]]) },
            solverBackend: { solveFrame },
            rebuildNodes: vi.fn(),
            ensureSolverPrepared: vi.fn(),
            dt: 0.01,
            simTime: 0.01
        };

        const result = SimulationRefreshSkill.run({ circuit });

        expect(result.ok).toBe(true);
        expect(solveFrame).toHaveBeenCalledWith(expect.objectContaining({
            commitState: false
        }));
        expect(circuit.lastResults.currents.get('R1')).toBe(0.006);
        expect(circuit.simTime).toBe(0.01);
    });

    it('uses solveFrame for a non-v1 backend without setting isRunning', () => {
        const solveFrame = vi.fn().mockReturnValue({
            valid: true,
            voltages: [0, 2.4],
            currents: new Map([['R1', 0.3]]),
            backendUsed: 'v2'
        });
        const solve = vi.fn();
        const circuit = {
            dt: 0.01,
            simTime: 2,
            isRunning: false,
            solverBackend: {
                mode: 'v2',
                solveFrame
            },
            solver: {
                solve,
                updateDynamicComponents: vi.fn()
            },
            rebuildNodes: vi.fn(),
            ensureSolverPrepared: vi.fn(),
            lastResults: null
        };

        const result = SimulationRefreshSkill.run({ circuit });

        expect(result.ok).toBe(true);
        expect(solveFrame).toHaveBeenCalledTimes(1);
        expect(solve).not.toHaveBeenCalled();
        expect(circuit.solver.updateDynamicComponents).not.toHaveBeenCalled();
        expect(circuit.isRunning).toBe(false);
        expect(circuit.simTime).toBe(2);
    });

    it('attaches runtime diagnostics for invalid solve results', () => {
        const circuit = {
            dt: 0.01,
            simTime: 0,
            solverBackend: {
                mode: 'v2',
                solveFrame: vi.fn().mockReturnValue({
                    valid: false,
                    voltages: [0],
                    currents: new Map(),
                    meta: { invalidReason: 'solve_failed' }
                })
            },
            rebuildNodes: vi.fn(),
            ensureSolverPrepared: vi.fn(),
            attachRuntimeDiagnostics: vi.fn((results) => {
                results.runtimeDiagnostics = {
                    code: 'CONFLICTING_SOURCES',
                    hints: ['检查并联理想电压源是否对同一节点对设置了不同电压。']
                };
                return results.runtimeDiagnostics;
            }),
            lastResults: null
        };

        const result = SimulationRefreshSkill.run({ circuit });

        expect(result.valid).toBe(false);
        expect(circuit.attachRuntimeDiagnostics).toHaveBeenCalledTimes(1);
        expect(circuit.lastResults?.runtimeDiagnostics?.code).toBe('CONFLICTING_SOURCES');
        expect(Array.isArray(circuit.lastResults?.runtimeDiagnostics?.hints)).toBe(true);
    });
});
