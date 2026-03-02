import { describe, expect, it, vi } from 'vitest';
import { handleWireTargetMouseDown } from '../src/app/interaction/InteractionOrchestratorMouseDownHandlers.js';

function makeWireTarget({
    classes = [],
    wireId = null
} = {}) {
    const wireGroup = wireId ? { dataset: { id: wireId } } : null;
    return {
        dataset: wireId ? { id: wireId } : {},
        classList: {
            contains: (name) => classes.includes(name)
        },
        closest: (selector) => {
            if (selector === '.wire-group') return wireGroup;
            return null;
        }
    };
}

describe('InteractionOrchestratorMouseDownHandlers.handleWireTargetMouseDown', () => {
    it('returns false for non-wire targets', () => {
        const context = {
            startWireDrag: vi.fn()
        };
        const event = {
            button: 0,
            ctrlKey: false,
            metaKey: false,
            clientX: 10,
            clientY: 20,
            target: makeWireTarget({ classes: [] })
        };

        const handled = handleWireTargetMouseDown.call(context, event, {
            target: event.target
        });

        expect(handled).toBe(false);
        expect(context.startWireDrag).not.toHaveBeenCalled();
    });

    it('splits wire on ctrl-click', () => {
        const context = {
            resolvePointerType: vi.fn(() => 'mouse'),
            screenToCanvas: vi.fn(() => ({ x: 44, y: 33 })),
            selectWire: vi.fn(),
            splitWireAtPoint: vi.fn(),
            startWireDrag: vi.fn()
        };
        const event = {
            button: 0,
            ctrlKey: true,
            metaKey: false,
            clientX: 120,
            clientY: 70,
            target: makeWireTarget({ classes: ['wire'], wireId: 'W1' })
        };

        const handled = handleWireTargetMouseDown.call(context, event, {
            target: event.target
        });

        expect(handled).toBe(true);
        expect(context.selectWire).toHaveBeenCalledWith('W1');
        expect(context.splitWireAtPoint).toHaveBeenCalledWith('W1', 44, 33);
        expect(context.startWireDrag).not.toHaveBeenCalled();
    });

    it('starts endpoint drag when touch pointer is near an endpoint', () => {
        const context = {
            resolvePointerType: vi.fn(() => 'touch'),
            screenToCanvas: vi.fn(() => ({ x: 46, y: 52 })),
            getAdaptiveSnapThreshold: vi.fn(() => 24),
            circuit: {
                getWire: vi.fn(() => ({
                    id: 'W1',
                    a: { x: 40, y: 50 },
                    b: { x: 160, y: 50 }
                }))
            },
            startWireEndpointDrag: vi.fn(),
            startWireDrag: vi.fn()
        };
        const event = {
            button: 0,
            ctrlKey: false,
            metaKey: false,
            clientX: 120,
            clientY: 70,
            target: makeWireTarget({ classes: ['wire-hit-area'], wireId: 'W1' })
        };

        const handled = handleWireTargetMouseDown.call(context, event, {
            target: event.target
        });

        expect(handled).toBe(true);
        expect(context.startWireEndpointDrag).toHaveBeenCalledWith('W1', 'a', event);
        expect(context.startWireDrag).not.toHaveBeenCalled();
    });

    it('starts full wire drag when no split or endpoint hit path matches', () => {
        const context = {
            resolvePointerType: vi.fn(() => 'mouse'),
            startWireDrag: vi.fn()
        };
        const event = {
            button: 0,
            ctrlKey: false,
            metaKey: false,
            clientX: 30,
            clientY: 40,
            target: makeWireTarget({ classes: ['wire'], wireId: 'W9' })
        };

        const handled = handleWireTargetMouseDown.call(context, event, {
            target: event.target
        });

        expect(handled).toBe(true);
        expect(context.startWireDrag).toHaveBeenCalledWith('W9', event);
    });
});
