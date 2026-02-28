import { describe, it, expect, vi } from 'vitest';
import { SimulationRefreshSkill } from '../src/ai/skills/SimulationRefreshSkill.js';

describe('SimulationRefreshSkill', () => {
    it('refreshes circuit values through one-shot solve', () => {
        const updateDynamicComponents = vi.fn();
        const solve = vi.fn().mockReturnValue({
            valid: true,
            voltages: [0, 1],
            currents: new Map()
        });
        const circuit = {
            dt: 0.01,
            simTime: 1,
            solver: {
                solve,
                updateDynamicComponents
            },
            rebuildNodes: vi.fn(),
            ensureSolverPrepared: vi.fn(),
            lastResults: null
        };

        const result = SimulationRefreshSkill.run({ circuit });

        expect(result.ok).toBe(true);
        expect(result.valid).toBe(true);
        expect(solve).toHaveBeenCalledTimes(1);
        expect(updateDynamicComponents).toHaveBeenCalledTimes(1);
        expect(circuit.simTime).toBeCloseTo(1.01, 8);
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

    it('attaches runtime diagnostics for invalid solve results', () => {
        const circuit = {
            dt: 0.01,
            simTime: 0,
            solver: {
                shortCircuitDetected: true,
                solve: vi.fn().mockReturnValue({
                    valid: false,
                    voltages: [0],
                    currents: new Map(),
                    meta: { invalidReason: 'solve_failed' }
                }),
                updateDynamicComponents: vi.fn()
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
