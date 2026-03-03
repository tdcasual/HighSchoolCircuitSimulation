import { describe, expect, it } from 'vitest';
import { Circuit } from '../src/core/runtime/Circuit.js';
import { createComponent } from '../src/components/Component.js';

describe('Circuit runtime id access', () => {
    it('supports numeric zero lookups/removals for string-keyed component and wire ids', () => {
        const circuit = new Circuit();
        const resistor = createComponent('Resistor', 0, 0, '0');
        circuit.addComponent(resistor);
        circuit.addWire({
            id: '0',
            a: { x: 0, y: 0 },
            b: { x: 20, y: 0 }
        });

        expect(circuit.getComponent(0)?.id).toBe('0');
        expect(circuit.getWire(0)?.id).toBe('0');

        circuit.removeWire(0);
        circuit.removeComponent(0);

        expect(circuit.getWire('0')).toBeUndefined();
        expect(circuit.getComponent('0')).toBeUndefined();
    });
});
