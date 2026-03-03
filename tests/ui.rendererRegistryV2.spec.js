import { describe, expect, it } from 'vitest';
import {
    createRendererRegistryV2,
    getRendererV2,
    TODO_UNMIGRATED_RENDERERS_V2
} from '../src/v2/ui/renderers/RendererRegistryV2.js';

describe('RendererRegistryV2', () => {
    it('returns renderer by supported component type', () => {
        const registry = createRendererRegistryV2();
        const supported = ['PowerSource', 'Resistor', 'Switch', 'Capacitor', 'Inductor', 'Voltmeter'];

        for (const type of supported) {
            const renderer = registry.get(type);
            expect(typeof renderer).toBe('function');
            const shape = renderer({ id: `${type}_1`, type });
            expect(shape).toBeTypeOf('object');
            expect(shape.kind).toBe('group');
        }
    });

    it('throws explicit error for unregistered type', () => {
        expect(() => getRendererV2('Relay')).toThrow(/Renderer not registered/u);
    });

    it('keeps TODO backlog for remaining renderer migrations', () => {
        expect(Array.isArray(TODO_UNMIGRATED_RENDERERS_V2)).toBe(true);
        expect(TODO_UNMIGRATED_RENDERERS_V2).toContain('Relay');
        expect(TODO_UNMIGRATED_RENDERERS_V2).toContain('Rheostat');
    });
});
