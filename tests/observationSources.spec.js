import { describe, it, expect } from 'vitest';
import { evaluateSourceQuantity, getQuantitiesForSource, getSourceOptions, PROBE_SOURCE_PREFIX, QuantityIds, TIME_SOURCE_ID } from '../src/ui/observation/ObservationSources.js';

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

    it('includes probe sources with prefixed ids', () => {
        const circuit = {
            components: new Map([
                ['R1', { id: 'R1', type: 'Resistor', currentValue: 0, voltageValue: 0, powerValue: 0, resistance: 10 }]
            ]),
            getAllObservationProbes: () => ([
                { id: 'P1', type: 'NodeVoltageProbe', wireId: 'W1', label: '节点1' },
                { id: 'P2', type: 'WireCurrentProbe', wireId: 'W2' }
            ]),
            getWire: (wireId) => (wireId === 'W1' ? { id: 'W1' } : null)
        };

        const options = getSourceOptions(circuit);
        expect(options.some((opt) => opt.id === `${PROBE_SOURCE_PREFIX}P1`)).toBe(true);
        expect(options.some((opt) => opt.id === `${PROBE_SOURCE_PREFIX}P2`)).toBe(true);
    });

    it('returns dedicated quantities for probe sources', () => {
        const circuit = {
            components: new Map(),
            getObservationProbe: (probeId) => {
                if (probeId === 'P1') return { id: 'P1', type: 'NodeVoltageProbe', wireId: 'W1' };
                if (probeId === 'P2') return { id: 'P2', type: 'WireCurrentProbe', wireId: 'W2' };
                return null;
            }
        };

        const nodeProbeQuantities = getQuantitiesForSource(`${PROBE_SOURCE_PREFIX}P1`, circuit).map((q) => q.id);
        const wireProbeQuantities = getQuantitiesForSource(`${PROBE_SOURCE_PREFIX}P2`, circuit).map((q) => q.id);
        expect(nodeProbeQuantities).toEqual([QuantityIds.Voltage]);
        expect(wireProbeQuantities).toEqual([QuantityIds.Current]);
    });

    it('evaluates node voltage probe from wire node voltage', () => {
        const wire = { id: 'W1', nodeIndex: 2 };
        const circuit = {
            components: new Map(),
            getObservationProbe: (probeId) => (probeId === 'P1'
                ? { id: 'P1', type: 'NodeVoltageProbe', wireId: 'W1' }
                : null),
            getWire: (wireId) => (wireId === 'W1' ? wire : null),
            lastResults: {
                valid: true,
                voltages: [0, 1.2, 3.4]
            }
        };

        const value = evaluateSourceQuantity(circuit, `${PROBE_SOURCE_PREFIX}P1`, QuantityIds.Voltage);
        expect(value).toBeCloseTo(3.4, 12);
    });

    it('evaluates wire current probe with flow direction sign', () => {
        const wire = { id: 'W2', nodeIndex: 1 };
        const circuit = {
            components: new Map(),
            getObservationProbe: (probeId) => (probeId === 'P2'
                ? { id: 'P2', type: 'WireCurrentProbe', wireId: 'W2' }
                : null),
            getWire: (wireId) => (wireId === 'W2' ? wire : null),
            getWireCurrentInfo: () => ({
                current: 0.0597,
                flowDirection: -1
            }),
            lastResults: {
                valid: true,
                voltages: [0, 5]
            }
        };

        const value = evaluateSourceQuantity(circuit, `${PROBE_SOURCE_PREFIX}P2`, QuantityIds.Current);
        expect(value).toBeCloseTo(-0.0597, 12);
    });
});
