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
});
