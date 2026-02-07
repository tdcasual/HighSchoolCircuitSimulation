import { describe, expect, it } from 'vitest';
import { createComponent } from '../src/components/Component.js';
import { ResultPostprocessor } from '../src/core/simulation/ResultPostprocessor.js';

describe('ResultPostprocessor', () => {
    it('computes branch currents after solve output', () => {
        const post = new ResultPostprocessor();
        const resistor = createComponent('Resistor', 0, 0, 'R1');
        resistor.nodes = [1, 0];
        resistor.resistance = 10;

        const out = post.apply({
            components: [resistor],
            voltages: [0, 10],
            x: [],
            nodeCount: 2
        });

        expect(out.currents).toBeDefined();
        expect(out.currents.get('R1')).toBeCloseTo(1, 6);
    });
});
