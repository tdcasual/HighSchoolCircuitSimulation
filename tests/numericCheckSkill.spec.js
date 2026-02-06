import { describe, it, expect } from 'vitest';
import { NumericCheckSkill } from '../src/ai/skills/NumericCheckSkill.js';

describe('NumericCheckSkill', () => {
    it('marks claims as verified, mismatch, or unmapped', () => {
        const circuit = {
            components: new Map([
                ['r1', {
                    id: 'Resistor_1',
                    label: 'R1',
                    type: 'Resistor',
                    currentValue: 0.3,
                    voltageValue: 2.4,
                    powerValue: 0.72
                }]
            ])
        };
        const claims = [
            {
                id: 'c1',
                quantity: 'current',
                value: 0.302,
                unit: 'A',
                component: { token: 'R1' }
            },
            {
                id: 'c2',
                quantity: 'voltage',
                value: 3.5,
                unit: 'V',
                component: { token: 'R1' }
            },
            {
                id: 'c3',
                quantity: 'power',
                value: 0.72,
                unit: 'W',
                component: { token: 'X9' }
            }
        ];

        const checks = NumericCheckSkill.run({ claims, circuit });

        expect(checks).toHaveLength(3);
        expect(checks[0].status).toBe('verified');
        expect(checks[1].status).toBe('mismatch');
        expect(checks[2].status).toBe('unmapped');
    });
});
