import { describe, expect, it, vi } from 'vitest';
import {
    COMPONENT_RENDERER_METHODS,
    renderComponentByRegistry
} from '../src/components/render/RendererRegistry.js';

describe('RendererRegistry', () => {
    it('contains grouped renderer mappings for representative component types', () => {
        expect(COMPONENT_RENDERER_METHODS.PowerSource).toBe('renderPowerSource');
        expect(COMPONENT_RENDERER_METHODS.Resistor).toBe('renderResistor');
        expect(COMPONENT_RENDERER_METHODS.Switch).toBe('renderSwitch');
        expect(COMPONENT_RENDERER_METHODS.Ammeter).toBe('renderAmmeter');
        expect(COMPONENT_RENDERER_METHODS.BlackBox).toBe('renderBlackBox');
    });

    it('dispatches to renderer method when component type is registered', () => {
        const renderer = {
            renderResistor: vi.fn()
        };
        const g = {};
        const comp = { type: 'Resistor' };

        const handled = renderComponentByRegistry(renderer, g, comp);

        expect(handled).toBe(true);
        expect(renderer.renderResistor).toHaveBeenCalledTimes(1);
        expect(renderer.renderResistor).toHaveBeenCalledWith(g, comp);
    });

    it('returns false for unknown types without throwing', () => {
        const renderer = {};
        expect(renderComponentByRegistry(renderer, {}, { type: 'UnknownType' })).toBe(false);
    });
});
