import { afterEach, describe, expect, it, vi } from 'vitest';
import * as EventBindingsController from '../src/ui/interaction/EventBindingsController.js';
import * as InteractionOrchestrator from '../src/app/interaction/InteractionOrchestrator.js';

function createEventTarget() {
    const handlers = new Map();
    return {
        addEventListener: vi.fn((eventName, handler) => {
            handlers.set(eventName, handler);
        }),
        trigger(eventName, event = {}) {
            const handler = handlers.get(eventName);
            if (handler) handler(event);
        },
        getHandler(eventName) {
            return handlers.get(eventName);
        }
    };
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('EventBindingsController.bindZoomEvents', () => {
    it('binds click on zoom label and resets view', () => {
        const zoomLevel = createEventTarget();
        zoomLevel.title = '';
        vi.stubGlobal('document', {
            getElementById: vi.fn(() => zoomLevel)
        });

        const ctx = { resetView: vi.fn() };

        EventBindingsController.bindZoomEvents.call(ctx);
        zoomLevel.trigger('click');

        expect(ctx.resetView).toHaveBeenCalledTimes(1);
        expect(zoomLevel.title).toContain('点击重置视图');
    });

    it('does not throw when zoom level addEventListener is non-callable', () => {
        vi.stubGlobal('document', {
            getElementById: vi.fn(() => ({
                addEventListener: {},
                title: ''
            }))
        });

        const ctx = { resetView: vi.fn() };
        expect(() => EventBindingsController.bindZoomEvents.call(ctx)).not.toThrow();
    });
});

describe('EventBindingsController.bindEvents', () => {
    it('binds toolbox/canvas/button/side-panel/keyboard/zoom in order', () => {
        const ctx = {
            bindToolboxEvents: vi.fn(),
            bindCanvasEvents: vi.fn(),
            bindButtonEvents: vi.fn(),
            bindSidePanelEvents: vi.fn(),
            bindKeyboardEvents: vi.fn(),
            bindZoomEvents: vi.fn()
        };

        EventBindingsController.bindEvents.call(ctx);

        expect(ctx.bindToolboxEvents).toHaveBeenCalledTimes(1);
        expect(ctx.bindCanvasEvents).toHaveBeenCalledTimes(1);
        expect(ctx.bindButtonEvents).toHaveBeenCalledTimes(1);
        expect(ctx.bindSidePanelEvents).toHaveBeenCalledTimes(1);
        expect(ctx.bindKeyboardEvents).toHaveBeenCalledTimes(1);
        expect(ctx.bindZoomEvents).toHaveBeenCalledTimes(1);
        expect(ctx.bindToolboxEvents.mock.invocationCallOrder[0]).toBeLessThan(ctx.bindCanvasEvents.mock.invocationCallOrder[0]);
        expect(ctx.bindCanvasEvents.mock.invocationCallOrder[0]).toBeLessThan(ctx.bindButtonEvents.mock.invocationCallOrder[0]);
    });
});

describe('EventBindingsController.bindKeyboardEvents', () => {
    it('forwards keydown event to orchestrator', () => {
        let keydownHandler = null;
        vi.stubGlobal('document', {
            addEventListener: vi.fn((eventName, handler) => {
                if (eventName === 'keydown') keydownHandler = handler;
            })
        });
        const orchestratorSpy = vi.spyOn(InteractionOrchestrator, 'onKeyDown').mockImplementation(() => {});
        const ctx = {};
        const event = { key: 'Delete' };

        EventBindingsController.bindKeyboardEvents.call(ctx);
        keydownHandler(event);

        expect(orchestratorSpy).toHaveBeenCalledWith(event);
    });

    it('does not throw when document addEventListener is non-callable', () => {
        vi.stubGlobal('document', {
            addEventListener: {}
        });
        const ctx = {};

        expect(() => EventBindingsController.bindKeyboardEvents.call(ctx)).not.toThrow();
    });
});

describe('EventBindingsController.bindCanvasEvents', () => {
    it('does not throw when svg root is missing', () => {
        vi.stubGlobal('window', { PointerEvent: function PointerEvent() {} });
        const context = {
            svg: null,
            onPointerDown: vi.fn(),
            onPointerMove: vi.fn(),
            onPointerUp: vi.fn(),
            onPointerCancel: vi.fn(),
            onPointerLeave: vi.fn(),
            onContextMenu: vi.fn(),
            onDoubleClick: vi.fn(),
            onWheel: vi.fn()
        };

        expect(() => EventBindingsController.bindCanvasEvents.call(context)).not.toThrow();
    });

    it('does not throw when svg addEventListener throws', () => {
        vi.stubGlobal('window', { PointerEvent: function PointerEvent() {} });
        const context = {
            svg: {
                addEventListener: vi.fn(() => {
                    throw new TypeError('broken add');
                })
            },
            onPointerDown: vi.fn(),
            onPointerMove: vi.fn(),
            onPointerUp: vi.fn(),
            onPointerCancel: vi.fn(),
            onPointerLeave: vi.fn(),
            onContextMenu: vi.fn(),
            onDoubleClick: vi.fn(),
            onWheel: vi.fn()
        };

        expect(() => EventBindingsController.bindCanvasEvents.call(context)).not.toThrow();
    });

    it('binds pointer listeners when PointerEvent is available', () => {
        vi.stubGlobal('window', { PointerEvent: function PointerEvent() {} });
        const svg = createEventTarget();
        const context = {
            svg,
            onPointerDown: vi.fn(),
            onPointerMove: vi.fn(),
            onPointerUp: vi.fn(),
            onPointerCancel: vi.fn(),
            onPointerLeave: vi.fn(),
            onContextMenu: vi.fn(),
            onDoubleClick: vi.fn(),
            onWheel: vi.fn()
        };

        EventBindingsController.bindCanvasEvents.call(context);

        const contextmenuEvent = { preventDefault: vi.fn() };
        svg.trigger('contextmenu', contextmenuEvent);
        svg.trigger('dblclick', { type: 'dblclick' });
        svg.trigger('wheel', { type: 'wheel' });

        expect(svg.addEventListener).toHaveBeenCalledWith('pointerdown', expect.any(Function), { passive: false });
        expect(svg.addEventListener).toHaveBeenCalledWith('pointermove', expect.any(Function), { passive: false });
        expect(svg.addEventListener).toHaveBeenCalledWith('pointerup', expect.any(Function));
        expect(svg.addEventListener).toHaveBeenCalledWith('pointercancel', expect.any(Function));
        expect(svg.addEventListener).toHaveBeenCalledWith('pointerleave', expect.any(Function));
        expect(contextmenuEvent.preventDefault).toHaveBeenCalledTimes(1);
        expect(context.onContextMenu).toHaveBeenCalledTimes(1);
        expect(context.onDoubleClick).toHaveBeenCalledTimes(1);
        expect(context.onWheel).toHaveBeenCalledTimes(1);
    });

    it('falls back to mouse listeners when PointerEvent is unavailable', () => {
        vi.stubGlobal('window', {});
        const svg = createEventTarget();
        const context = {
            svg,
            onMouseDown: vi.fn(),
            onMouseMove: vi.fn(),
            onMouseUp: vi.fn(),
            onMouseLeave: vi.fn(),
            onContextMenu: vi.fn(),
            onDoubleClick: vi.fn(),
            onWheel: vi.fn()
        };

        EventBindingsController.bindCanvasEvents.call(context);

        svg.trigger('mousedown', { type: 'mousedown' });
        svg.trigger('mousemove', { type: 'mousemove' });
        svg.trigger('mouseup', { type: 'mouseup' });
        svg.trigger('mouseleave', { type: 'mouseleave' });

        expect(svg.addEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function));
        expect(svg.addEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
        expect(svg.addEventListener).toHaveBeenCalledWith('mouseup', expect.any(Function));
        expect(svg.addEventListener).toHaveBeenCalledWith('mouseleave', expect.any(Function));
        expect(context.onMouseDown).toHaveBeenCalledTimes(1);
        expect(context.onMouseMove).toHaveBeenCalledTimes(1);
        expect(context.onMouseUp).toHaveBeenCalledTimes(1);
        expect(context.onMouseLeave).toHaveBeenCalledTimes(1);
    });
});
