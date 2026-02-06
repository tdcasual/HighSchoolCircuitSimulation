import { describe, it, expect } from 'vitest';
import { QuestionPlanningSkill } from '../src/ai/skills/QuestionPlanningSkill.js';

describe('QuestionPlanningSkill', () => {
    it('builds compute-first plan for numeric questions', () => {
        const plan = QuestionPlanningSkill.run({
            question: 'R1 电流和电压分别是多少？'
        });

        expect(plan.mode).toBe('compute-first');
        expect(plan.requiresNumericVerification).toBe(true);
        expect(plan.steps).toContain('refresh-simulation');
        expect(plan.steps).toContain('post-verify-claims');
        expect(plan.focusQuantities).toEqual(expect.arrayContaining(['current', 'voltage']));
    });

    it('builds explain-first plan for conceptual questions', () => {
        const plan = QuestionPlanningSkill.run({
            question: '为什么这个开关闭合后灯泡会更亮？'
        });

        expect(plan.mode).toBe('explain-first');
        expect(plan.requiresNumericVerification).toBe(false);
        expect(plan.steps).toContain('validate-topology-assumptions');
    });
});
