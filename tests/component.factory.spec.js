import { describe, expect, it } from 'vitest';
import {
    createComponent,
    generateId,
    resetIdCounter,
    updateIdCounterFromExisting
} from '../src/components/factory/ComponentFactory.js';

describe('ComponentFactory', () => {
    it('creates component with expected display defaults for special types', () => {
        resetIdCounter();

        const voltmeter = createComponent('Voltmeter', 0, 0);
        const sw = createComponent('Switch', 0, 0);
        const blackBox = createComponent('BlackBox', 0, 0);

        expect(voltmeter.display).toEqual({
            current: false,
            voltage: true,
            power: false
        });
        expect(sw.display).toEqual({
            current: false,
            voltage: false,
            power: false
        });
        expect(blackBox.display).toEqual({
            current: false,
            voltage: false,
            power: false
        });
    });

    it('maintains id counter semantics across reset and existing id sync', () => {
        resetIdCounter();
        expect(generateId('Resistor')).toBe('Resistor_1');
        expect(generateId('Resistor')).toBe('Resistor_2');

        updateIdCounterFromExisting(['Resistor_3', 'PowerSource_19', 'invalid']);
        expect(generateId('Resistor')).toBe('Resistor_20');

        resetIdCounter();
        expect(generateId('Resistor')).toBe('Resistor_1');
    });

    it('preserves numeric zero existingId when creating components', () => {
        resetIdCounter();
        const component = createComponent('Resistor', 0, 0, 0);

        expect(component.id).toBe('0');
    });
});
