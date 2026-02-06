import { describe, it, expect } from 'vitest';
import { ClaimExtractSkill } from '../src/ai/skills/ClaimExtractSkill.js';

describe('ClaimExtractSkill', () => {
    it('extracts numeric claims and maps component labels', () => {
        const circuit = {
            components: new Map([
                ['resistor_1', { id: 'Resistor_1', label: 'R1', type: 'Resistor' }],
                ['source_1', { id: 'PowerSource_1', label: 'E1', type: 'PowerSource' }]
            ])
        };
        const answer = '结论：R1 电流约 0.300A，R1 两端电压约 2.40V，R1 功率约 0.72W。';

        const claims = ClaimExtractSkill.run({ answer, circuit });

        expect(claims).toHaveLength(3);
        expect(claims[0].quantity).toBe('current');
        expect(claims[1].quantity).toBe('voltage');
        expect(claims[2].quantity).toBe('power');
        expect(claims[0].component?.label).toBe('R1');
        expect(claims[1].component?.id).toBe('Resistor_1');
    });
});
