import { describe, expect, it } from 'vitest';
import { ChartSamplingService } from '../src/ui/charts/ChartSamplingService.js';
import { QuantityIds } from '../src/ui/observation/ObservationSources.js';

describe('ChartSamplingService', () => {
    it('accepts numeric zero source ids and reuses cache across numeric/string forms', () => {
        const service = new ChartSamplingService();
        const component = { id: '0', currentValue: 1.5 };
        const circuit = { components: new Map([['0', component]]) };
        const cache = new Map();

        const first = service.evaluateBinding(circuit, {
            sourceId: 0,
            quantityId: QuantityIds.Current
        }, cache);

        component.currentValue = 9;

        const second = service.evaluateBinding(circuit, {
            sourceId: '0',
            quantityId: QuantityIds.Current
        }, cache);

        expect(first).toBe(1.5);
        expect(second).toBe(1.5);
        expect(cache.size).toBe(1);
    });
});
