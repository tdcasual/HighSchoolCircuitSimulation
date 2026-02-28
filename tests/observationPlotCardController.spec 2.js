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
});
