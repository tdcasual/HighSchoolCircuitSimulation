import { describe, expect, it } from 'vitest';
import { ComponentRegistry, DefaultComponentRegistry } from '../src/core/simulation/ComponentRegistry.js';

describe('ComponentRegistry', () => {
    it('returns handlers for known types', () => {
        const registry = new ComponentRegistry();
        registry.register('Resistor', { stamp: () => 'ok' });
        expect(registry.get('Resistor').stamp()).toBe('ok');
        expect(registry.get('Unknown')).toBe(null);
    });

    it('stamps resistor via registry', () => {
        const handler = DefaultComponentRegistry.get('Resistor');
        const calls = [];
        const context = {
            stampResistor: (i1, i2, r) => calls.push({ i1, i2, r })
        };

        handler.stamp({ resistance: 100 }, context, { i1: 0, i2: 1 });
        expect(calls).toEqual([{ i1: 0, i2: 1, r: 100 }]);
    });
});
