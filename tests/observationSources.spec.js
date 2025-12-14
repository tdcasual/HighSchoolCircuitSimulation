import { describe, it, expect } from 'vitest';
import { evaluateSourceQuantity, getQuantitiesForSource, getSourceOptions, QuantityIds, TIME_SOURCE_ID } from '../src/ui/observation/ObservationSources.js';

describe('ObservationSources', () => {
    it('includes time and components in source options', () => {
        const circuit = {
            simTime: 1.23,
            components: new Map([
                ['R1', { id: 'R1', type: 'Resistor', label: 'R1', currentValue: 0, voltageValue: 0, powerValue: 0, resistance: 10 }]
            ])
        };
        const options = getSourceOptions(circuit);
        expect(options[0].id).toBe(TIME_SOURCE_ID);
        expect(options.some((o) => o.id === 'R1')).toBe(true);
    });

    it('evaluates time source', () => {
        const circuit = { simTime: 4.56, components: new Map() };
        expect(evaluateSourceQuantity(circuit, TIME_SOURCE_ID, QuantityIds.Time)).toBeCloseTo(4.56, 12);
    });

    it('evaluates basic I/U/P quantities', () => {
        const circuit = {
            simTime: 0,
            components: new Map([
                ['X', { id: 'X', type: 'Resistor', currentValue: -0.2, voltageValue: 3.3, powerValue: 0.66, resistance: 10 }]
            ])
        };
        expect(evaluateSourceQuantity(circuit, 'X', QuantityIds.Current)).toBeCloseTo(-0.2, 12);
        expect(evaluateSourceQuantity(circuit, 'X', QuantityIds.Voltage)).toBeCloseTo(3.3, 12);
        expect(evaluateSourceQuantity(circuit, 'X', QuantityIds.Power)).toBeCloseTo(0.66, 12);
    });

    it('returns capacitor extra quantities', () => {
        const circuit = {
            simTime: 0,
            components: new Map([
                ['C1', { id: 'C1', type: 'Capacitor', capacitance: 2e-6, prevCharge: 6e-6, currentValue: 0, voltageValue: 0, powerValue: 0 }]
            ])
        };
        const list = getQuantitiesForSource('C1', circuit).map((q) => q.id);
        expect(list).toContain(QuantityIds.Capacitance);
        expect(list).toContain(QuantityIds.Charge);
        expect(evaluateSourceQuantity(circuit, 'C1', QuantityIds.Capacitance)).toBeCloseTo(2e-6, 12);
        expect(evaluateSourceQuantity(circuit, 'C1', QuantityIds.Charge)).toBeCloseTo(6e-6, 12);
    });
});

