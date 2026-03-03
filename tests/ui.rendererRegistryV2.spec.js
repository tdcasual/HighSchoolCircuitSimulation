import { describe, expect, it } from 'vitest';
import {
    createRendererRegistryV2,
    getRendererV2,
    TODO_UNMIGRATED_RENDERERS_V2
} from '../src/v2/ui/renderers/RendererRegistryV2.js';

describe('RendererRegistryV2', () => {
    it('returns renderer for all manifest component types', () => {
        const registry = createRendererRegistryV2();
        const supported = [
            'Ground',
            'PowerSource',
            'ACVoltageSource',
            'Resistor',
            'Diode',
            'LED',
            'Thermistor',
            'Photoresistor',
            'Relay',
            'Rheostat',
            'Bulb',
            'Capacitor',
            'Inductor',
            'ParallelPlateCapacitor',
            'Motor',
            'Switch',
            'SPDTSwitch',
            'Fuse',
            'Ammeter',
            'Voltmeter',
            'BlackBox'
        ];

        for (const type of supported) {
            const renderer = registry.get(type);
            expect(typeof renderer).toBe('function');
            const shape = renderer({ id: `${type}_1`, type });
            expect(shape).toBeTypeOf('object');
            expect(shape.kind).toBe('group');
        }
    });

    it('throws explicit error for unregistered type', () => {
        expect(() => getRendererV2('__UNKNOWN_TYPE__')).toThrow(/Renderer not registered/u);
    });

    it('has empty TODO backlog after migration completion', () => {
        expect(Array.isArray(TODO_UNMIGRATED_RENDERERS_V2)).toBe(true);
        expect(TODO_UNMIGRATED_RENDERERS_V2).toHaveLength(0);
    });
});
