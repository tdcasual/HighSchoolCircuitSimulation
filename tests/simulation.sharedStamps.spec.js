import { describe, expect, it } from 'vitest';
import { DefaultComponentRegistry } from '../src/core/simulation/ComponentRegistry.js';
import { DefaultStampRegistryV2 } from '../src/v2/simulation/StampRegistryV2.js';
import { DefaultStampHandlers } from '../src/utils/registerDefaultStamps.js';
import { listComponentDefinitionTypes } from '../src/components/ComponentDefinitionRegistry.js';

describe('shared stamp table', () => {
    it('registers the same handler objects on V1 and V2 default registries', () => {
        const types = listComponentDefinitionTypes();
        expect(types.length).toBeGreaterThan(10);
        for (const type of types) {
            const v1 = DefaultComponentRegistry.get(type);
            const v2 = DefaultStampRegistryV2.get(type);
            const shared = DefaultStampHandlers.get(type);
            expect(v1).toBe(shared);
            expect(v2).toBe(shared);
            expect(typeof v1.stamp).toBe('function');
            expect(typeof v1.current).toBe('function');
        }
    });

    it('stamps a resistor through the shared handler both registries expose', () => {
        const handler = DefaultComponentRegistry.get('Resistor');
        expect(handler).toBe(DefaultStampRegistryV2.get('Resistor'));
        const calls = [];
        handler.stamp({ resistance: 8 }, {
            stampResistor: (i1, i2, r) => calls.push({ i1, i2, r })
        }, { i1: 0, i2: 1 });
        expect(calls).toEqual([{ i1: 0, i2: 1, r: 8 }]);
    });
});
