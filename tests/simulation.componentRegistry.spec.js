import { describe, expect, it } from 'vitest';
import { ComponentRegistry, DefaultComponentRegistry } from '../src/core/simulation/ComponentRegistry.js';
import { ComponentDefaults } from '../src/components/Component.js';
import { computeNtcThermistorResistance, computePhotoresistorResistance } from '../src/utils/Physics.js';

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

    it('covers day3 target component types with stamp/current handlers', () => {
        const targetTypes = ['Thermistor', 'Photoresistor', 'Ammeter', 'Voltmeter'];

        for (const type of targetTypes) {
            expect(ComponentDefaults[type]).toBeTruthy();
            const handler = DefaultComponentRegistry.get(type);
            expect(handler, `${type} should be registered`).toBeTruthy();
            expect(typeof handler.stamp, `${type} should provide stamp()`).toBe('function');
            expect(typeof handler.current, `${type} should provide current()`).toBe('function');
        }
    });

    it('stamps thermistor/photoresistor using computed resistance models', () => {
        const calls = [];
        const context = {
            stampResistor: (i1, i2, r) => calls.push({ i1, i2, r })
        };

        const thermistor = { ...ComponentDefaults.Thermistor, id: 'RT1' };
        const photoresistor = { ...ComponentDefaults.Photoresistor, id: 'LDR1' };

        DefaultComponentRegistry.get('Thermistor').stamp(thermistor, context, { i1: 2, i2: 3 });
        DefaultComponentRegistry.get('Photoresistor').stamp(photoresistor, context, { i1: 4, i2: 5 });

        expect(calls[0]).toEqual({
            i1: 2,
            i2: 3,
            r: computeNtcThermistorResistance(thermistor)
        });
        expect(calls[1]).toEqual({
            i1: 4,
            i2: 5,
            r: computePhotoresistorResistance(photoresistor)
        });
    });

    it('covers day9 target component types with stamp/current handlers', () => {
        const targetTypes = ['Switch', 'SPDTSwitch', 'Fuse'];

        for (const type of targetTypes) {
            expect(ComponentDefaults[type]).toBeTruthy();
            const handler = DefaultComponentRegistry.get(type);
            expect(handler, `${type} should be registered`).toBeTruthy();
            expect(typeof handler.stamp, `${type} should provide stamp()`).toBe('function');
            expect(typeof handler.current, `${type} should provide current()`).toBe('function');
        }
    });

    it('uses switch and fuse registry stamp/current behaviors equivalent to solver logic', () => {
        const calls = [];
        const context = {
            stampResistor: (i1, i2, r) => calls.push({ i1, i2, r }),
            voltage: (nodeIdx) => ({ 1: 5, 2: 1 }[nodeIdx] || 0)
        };

        const switchHandler = DefaultComponentRegistry.get('Switch');
        switchHandler.stamp({ closed: true }, context, { i1: 0, i2: 1 });
        switchHandler.stamp({ closed: false }, context, { i1: 0, i2: 1 });
        expect(calls[0]).toEqual({ i1: 0, i2: 1, r: 1e-9 });
        expect(calls[1]).toEqual({ i1: 0, i2: 1, r: 1e12 });
        expect(switchHandler.current({ closed: true }, context, { n1: 1, n2: 2 })).toBeCloseTo(4e9, 0);
        expect(switchHandler.current({ closed: false }, context, { n1: 1, n2: 2 })).toBe(0);

        const fuseHandler = DefaultComponentRegistry.get('Fuse');
        fuseHandler.stamp({ blown: false, coldResistance: 0.05 }, context, { i1: 2, i2: 3 });
        fuseHandler.stamp({ blown: true, blownResistance: 1e12 }, context, { i1: 2, i2: 3 });
        expect(calls[2]).toEqual({ i1: 2, i2: 3, r: 0.05 });
        expect(calls[3]).toEqual({ i1: 2, i2: 3, r: 1e12 });
        expect(fuseHandler.current({ blown: false, coldResistance: 2 }, context, { n1: 1, n2: 2 })).toBeCloseTo(2, 9);
    });

    it('routes spdt switch stamps and current through selected throw', () => {
        const calls = [];
        const context = {
            stampResistor: (i1, i2, r) => calls.push({ i1, i2, r }),
            voltage: (nodeIdx) => ({ 1: 10, 2: 6, 3: 2 }[nodeIdx] || 0)
        };
        const handler = DefaultComponentRegistry.get('SPDTSwitch');
        const comp = {
            nodes: [1, 2, 3],
            position: 'a',
            onResistance: 2,
            offResistance: 10
        };
        const nodes = {
            n1: 1,
            isValidNode: (nodeIdx) => nodeIdx !== undefined && nodeIdx !== null && nodeIdx >= 0
        };

        handler.stamp(comp, context, nodes);
        expect(calls).toEqual([
            { i1: 0, i2: 1, r: 2 },
            { i1: 0, i2: 2, r: 10 }
        ]);
        expect(handler.current(comp, context, nodes)).toBeCloseTo(2, 9);

        comp.position = 'b';
        expect(handler.current(comp, context, nodes)).toBeCloseTo(4, 9);
    });
});
