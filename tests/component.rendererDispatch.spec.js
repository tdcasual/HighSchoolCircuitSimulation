import { describe, expect, it, vi } from 'vitest';
import {
    LEGACY_RENDERER_METHODS,
    renderLegacyComponent
} from '../src/components/render/legacy/RendererRegistryLegacy.js';

describe('RendererRegistryLegacy', () => {
    it('contains grouped renderer mappings for representative component types', () => {
        expect(LEGACY_RENDERER_METHODS.PowerSource).toBe('renderPowerSource');
        expect(LEGACY_RENDERER_METHODS.Resistor).toBe('renderResistor');
        expect(LEGACY_RENDERER_METHODS.Switch).toBe('renderSwitch');
        expect(LEGACY_RENDERER_METHODS.Ammeter).toBe('renderAmmeter');
        expect(LEGACY_RENDERER_METHODS.BlackBox).toBe('renderBlackBox');
    });

    it('dispatches to renderer method when component type is registered', () => {
        const renderer = {
            renderResistor: vi.fn()
        };
        const g = {};
        const comp = { type: 'Resistor' };

        const handled = renderLegacyComponent(renderer, g, comp);

        expect(handled).toBe(true);
        expect(renderer.renderResistor).toHaveBeenCalledTimes(1);
        expect(renderer.renderResistor).toHaveBeenCalledWith(g, comp);
    });

    it('returns false for unknown types without throwing', () => {
        const renderer = {};
        expect(renderLegacyComponent(renderer, {}, { type: 'UnknownType' })).toBe(false);
    });
});
