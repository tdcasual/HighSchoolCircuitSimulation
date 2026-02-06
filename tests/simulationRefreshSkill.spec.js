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
});
