import { describe, expect, it } from 'vitest';
import { Circuit } from '../src/core/runtime/Circuit.js';
import { getCircuitComponentProperties } from '../src/core/runtime/CircuitComponentProperties.js';

describe('Circuit component property delegation', () => {
    it('delegates serialization property shaping to the extracted helper', () => {
        const capacitor = {
            type: 'Capacitor',
            capacitance: 0.001,
            integrationMethod: 'trapezoidal'
        };
        const fuse = {
            type: 'Fuse',
            ratedCurrent: 3,
            i2tThreshold: 12,
            i2tAccum: 2,
            coldResistance: 0.05,
            blownResistance: 1e12,
            blown: true
        };
        const blackBox = {
            type: 'BlackBox',
            boxWidth: 180,
            boxHeight: 110,
            viewMode: 'opaque'
        };

        expect(Circuit.prototype.getComponentProperties(capacitor)).toEqual(getCircuitComponentProperties(capacitor));
        expect(Circuit.prototype.getComponentProperties(fuse)).toEqual(getCircuitComponentProperties(fuse));
        expect(Circuit.prototype.getComponentProperties(blackBox)).toEqual(getCircuitComponentProperties(blackBox));
    });
});
