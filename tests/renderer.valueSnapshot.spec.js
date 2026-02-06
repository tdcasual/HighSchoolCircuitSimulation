import { afterEach, describe, expect, it, vi } from 'vitest';
import { Renderer } from '../src/ui/Renderer.js';
import { SVGRenderer } from '../src/components/Component.js';

function createRendererContext(component, element = {}) {
    const renderer = Object.create(Renderer.prototype);
    renderer.circuit = {
        getComponent: (id) => (id === component.id ? component : null)
    };
    renderer.defaultDisplay = {
        current: true,
        voltage: false,
        power: false
    };
    renderer.componentElements = new Map([[component.id, element]]);
    renderer.valueDisplaySnapshot = new Map();
    return renderer;
}

describe('Renderer value snapshot updates', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('skips value display writes when snapshot is unchanged', () => {
        const component = {
            id: 'R1',
            type: 'Resistor',
            currentValue: 0.2,
            voltageValue: 2,
            powerValue: 0.4,
            display: {}
        };
        const renderer = createRendererContext(component, {});
        const updateSpy = vi.spyOn(SVGRenderer, 'updateValueDisplay').mockImplementation(() => {});

        Renderer.prototype.updateValues.call(renderer);
        Renderer.prototype.updateValues.call(renderer);

        expect(updateSpy).toHaveBeenCalledTimes(1);

        component.currentValue = 0.25;
        Renderer.prototype.updateValues.call(renderer);
        expect(updateSpy).toHaveBeenCalledTimes(2);
    });

    it('forces updates when caller requests force refresh', () => {
        const component = {
            id: 'R2',
            type: 'Resistor',
            currentValue: 0.1,
            voltageValue: 1,
            powerValue: 0.1,
            display: {}
        };
        const renderer = createRendererContext(component, {});
        const updateSpy = vi.spyOn(SVGRenderer, 'updateValueDisplay').mockImplementation(() => {});

        Renderer.prototype.updateValues.call(renderer);
        Renderer.prototype.updateValues.call(renderer, true);

        expect(updateSpy).toHaveBeenCalledTimes(2);
    });

    it('removes stale snapshot entries when component disappears', () => {
        const component = {
            id: 'R3',
            type: 'Resistor',
            currentValue: 0,
            voltageValue: 0,
            powerValue: 0,
            display: {}
        };
        const renderer = createRendererContext(component, {});
        renderer.valueDisplaySnapshot.set(component.id, 'old');
        renderer.componentElements.clear();

        Renderer.prototype.updateValues.call(renderer);

        expect(renderer.valueDisplaySnapshot.has(component.id)).toBe(false);
    });
});
