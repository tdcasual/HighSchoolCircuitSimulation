import { describe, it, expect } from 'vitest';
import { AnswerVerifySkill } from '../src/ai/skills/AnswerVerifySkill.js';

describe('AnswerVerifySkill', () => {
    it('appends verification summary for checks', () => {
        const answer = '## 结论\nR1 电流约 0.300A。';
        const checks = [
            {
                status: 'verified',
                quantity: 'current',
                unit: 'A',
                expectedValue: 0.3,
                actualValue: 0.301,
                delta: 0.001,
                component: { label: 'R1', id: 'Resistor_1' }
            },
            {
                status: 'mismatch',
                quantity: 'voltage',
                unit: 'V',
                expectedValue: 3.0,
                actualValue: 2.1,
                delta: 0.9,
                tolerance: 0.1,
                component: { label: 'R1', id: 'Resistor_1' }
            }
        ];

        const merged = AnswerVerifySkill.run({ answer, checks });

        expect(merged).toContain('### 数值核对');
        expect(merged).toContain('[通过]');
        expect(merged).toContain('[偏差]');
    });
});
