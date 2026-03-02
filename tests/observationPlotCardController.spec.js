import { describe, expect, it, vi } from 'vitest';
import { ObservationPlotCardController } from '../src/ui/observation/ObservationPlotCardController.js';

function createSelectStub(initialValue = '') {
    const handlers = new Map();
    return {
        value: initialValue,
        addEventListener: vi.fn((event, handler) => {
            handlers.set(event, handler);
        }),
        trigger(event) {
            const handler = handlers.get(event);
            if (handler) handler({ target: this });
        }
    };
}

describe('ObservationPlotCardController', () => {
    it('emits transform change payload for y axis', () => {
        const onChange = vi.fn();
        const controller = new ObservationPlotCardController({ onChange });
        const elements = {
            yTransformSelect: createSelectStub('identity')
        };

        controller.mount(elements);

        elements.yTransformSelect.value = 'abs';
        elements.yTransformSelect.trigger('change');

        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
            type: 'plot-transform-change',
            axis: 'y',
            value: 'abs'
        }));
    });

    it('dispose does not throw when removeEventListener throws', () => {
        const onChange = vi.fn();
        const controller = new ObservationPlotCardController({ onChange });
        const ySelect = {
            value: 'identity',
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(() => {
                throw new TypeError('broken remove');
            })
        };

        controller.mount({ yTransformSelect: ySelect });
        expect(() => controller.dispose()).not.toThrow();
    });

    it('mount does not throw when addEventListener throws', () => {
        const onChange = vi.fn();
        const controller = new ObservationPlotCardController({ onChange });
        const ySelect = {
            value: 'identity',
            addEventListener: vi.fn(() => {
                throw new TypeError('broken add');
            }),
            removeEventListener: vi.fn()
        };

        expect(() => controller.mount({ yTransformSelect: ySelect })).not.toThrow();
    });
});
