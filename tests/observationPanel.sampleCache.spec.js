import { describe, expect, it } from 'vitest';
import { ObservationPanel } from '../src/ui/ObservationPanel.js';
import { QuantityIds } from '../src/ui/observation/ObservationSources.js';

describe('ObservationPanel sample value cache', () => {
    it('reuses cached value for same source/quantity in one sampling batch', () => {
        const component = {
            id: 'R1',
            currentValue: 1.25
        };
        const ctx = {
            circuit: {
                components: new Map([[component.id, component]])
            }
        };
        const valueCache = new Map();

        const first = ObservationPanel.prototype.getSampleValue.call(
            ctx,
            'R1',
            QuantityIds.Current,
            valueCache
        );
        component.currentValue = 2.5;
        const second = ObservationPanel.prototype.getSampleValue.call(
            ctx,
            'R1',
            QuantityIds.Current,
            valueCache
        );
        const uncached = ObservationPanel.prototype.getSampleValue.call(
            ctx,
            'R1',
            QuantityIds.Current,
            null
        );

        expect(first).toBe(1.25);
        expect(second).toBe(1.25);
        expect(uncached).toBe(2.5);
    });

    it('keeps cache keys isolated across different quantities', () => {
        const component = {
            id: 'R2',
            currentValue: 0.75,
            voltageValue: 3.5
        };
        const ctx = {
            circuit: {
                components: new Map([[component.id, component]])
            }
        };
        const valueCache = new Map();

        const current = ObservationPanel.prototype.getSampleValue.call(
            ctx,
            'R2',
            QuantityIds.Current,
            valueCache
        );
        component.currentValue = 1.5;
        component.voltageValue = 4.2;
        const voltage = ObservationPanel.prototype.getSampleValue.call(
            ctx,
            'R2',
            QuantityIds.Voltage,
            valueCache
        );

        expect(current).toBe(0.75);
        expect(voltage).toBe(4.2);
        expect(valueCache.size).toBe(2);
    });
});
