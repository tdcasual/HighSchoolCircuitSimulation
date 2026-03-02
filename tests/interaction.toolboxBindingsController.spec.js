import { afterEach, describe, expect, it, vi } from 'vitest';
import * as ToolboxBindingsController from '../src/ui/interaction/ToolboxBindingsController.js';

function createToolItem(type) {
    const handlers = new Map();
    return {
        dataset: { type },
        classList: {
            add: vi.fn(),
            remove: vi.fn()
        },
        addEventListener: vi.fn((eventName, handler) => {
            handlers.set(eventName, handler);
        }),
        trigger(eventName, event) {
            const handler = handlers.get(eventName);
            if (handler) handler(event);
        }
    };
}

function createSvgNode() {
    const handlers = new Map();
    return {
        addEventListener: vi.fn((eventName, handler) => {
            handlers.set(eventName, handler);
        }),
        trigger(eventName, event) {
            const handler = handlers.get(eventName);
            if (handler) handler(event);
        },
        getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0 }))
    };
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('ToolboxBindingsController.bindToolboxEvents', () => {
    it('handles tool dragstart/dragend and tool click placement', () => {
        const resistor = createToolItem('Resistor');
        const svg = createSvgNode();
        vi.stubGlobal('document', {
            querySelectorAll: vi.fn(() => [resistor])
        });

        const setPendingToolType = vi.fn();
        const ctx = {
            svg,
            setPendingToolType,
            viewOffset: { x: 0, y: 0 },
            scale: 1
        };

        ToolboxBindingsController.bindToolboxEvents.call(ctx);

        const dragEvent = {
            preventDefault: vi.fn(),
            dataTransfer: {
                setData: vi.fn(),
                effectAllowed: ''
            }
        };
        resistor.trigger('dragstart', dragEvent);
        resistor.trigger('dragend', {});
        resistor.trigger('click', {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn()
        });

        expect(dragEvent.dataTransfer.setData).toHaveBeenCalledWith('application/x-circuit-component', 'Resistor');
        expect(resistor.classList.add).toHaveBeenCalledWith('dragging');
        expect(resistor.classList.remove).toHaveBeenCalledWith('dragging');
        expect(setPendingToolType).toHaveBeenCalledWith('Resistor', resistor);
    });

    it('drops resistor onto snapped coordinates and clears pending state', () => {
        const resistor = createToolItem('Resistor');
        const svg = createSvgNode();
        vi.stubGlobal('document', {
            querySelectorAll: vi.fn(() => [resistor])
        });

        const addComponent = vi.fn();
        const clearPendingToolType = vi.fn();
        const ctx = {
            svg,
            viewOffset: { x: 0, y: 0 },
            scale: 1,
            isDraggingComponent: false,
            addComponent,
            clearPendingToolType
        };

        ToolboxBindingsController.bindToolboxEvents.call(ctx);

        const dropEvent = {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            clientX: 55,
            clientY: 78,
            dataTransfer: {
                getData: vi.fn(() => 'Resistor')
            }
        };

        svg.trigger('drop', dropEvent);

        expect(addComponent).toHaveBeenCalledWith('Resistor', 60, 80);
        expect(clearPendingToolType).toHaveBeenCalledWith({ silent: true });
    });

    it('drops wire via addWireAt and accepts dragover mime type', () => {
        const wire = createToolItem('Wire');
        const svg = createSvgNode();
        vi.stubGlobal('document', {
            querySelectorAll: vi.fn(() => [wire])
        });

        const addWireAt = vi.fn();
        const ctx = {
            svg,
            viewOffset: { x: 0, y: 0 },
            scale: 1,
            isDraggingComponent: false,
            addWireAt,
            clearPendingToolType: vi.fn()
        };

        ToolboxBindingsController.bindToolboxEvents.call(ctx);

        const dragOverEvent = {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            dataTransfer: {
                types: ['application/x-circuit-component'],
                dropEffect: 'none'
            }
        };
        svg.trigger('dragover', dragOverEvent);

        const dropEvent = {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            clientX: 21,
            clientY: 18,
            dataTransfer: {
                getData: vi.fn(() => 'Wire')
            }
        };
        svg.trigger('drop', dropEvent);

        expect(dragOverEvent.preventDefault).toHaveBeenCalled();
        expect(dragOverEvent.dataTransfer.dropEffect).toBe('copy');
        expect(addWireAt).toHaveBeenCalledWith(20, 20);
    });

    it('does not throw when item classList add/remove are non-callable', () => {
        const resistor = createToolItem('Resistor');
        resistor.classList.add = {};
        resistor.classList.remove = {};
        const svg = createSvgNode();
        vi.stubGlobal('document', {
            querySelectorAll: vi.fn(() => [resistor])
        });

        const ctx = {
            svg,
            setPendingToolType: vi.fn(),
            viewOffset: { x: 0, y: 0 },
            scale: 1
        };

        expect(() => ToolboxBindingsController.bindToolboxEvents.call(ctx)).not.toThrow();
        expect(() => resistor.trigger('dragstart', {
            preventDefault: vi.fn(),
            dataTransfer: {
                setData: vi.fn(),
                effectAllowed: ''
            }
        })).not.toThrow();
        expect(() => resistor.trigger('dragend', {})).not.toThrow();
    });

    it('does not throw when svg addEventListener is non-callable', () => {
        const resistor = createToolItem('Resistor');
        const svg = createSvgNode();
        svg.addEventListener = {};
        vi.stubGlobal('document', {
            querySelectorAll: vi.fn(() => [resistor])
        });

        const ctx = {
            svg,
            setPendingToolType: vi.fn(),
            viewOffset: { x: 0, y: 0 },
            scale: 1
        };

        expect(() => ToolboxBindingsController.bindToolboxEvents.call(ctx)).not.toThrow();
    });

    it('does not throw when svg getBoundingClientRect throws during drop', () => {
        const resistor = createToolItem('Resistor');
        const svg = createSvgNode();
        svg.getBoundingClientRect = vi.fn(() => {
            throw new TypeError('broken rect');
        });
        vi.stubGlobal('document', {
            querySelectorAll: vi.fn(() => [resistor])
        });

        const addComponent = vi.fn();
        const ctx = {
            svg,
            viewOffset: { x: 0, y: 0 },
            scale: 1,
            isDraggingComponent: false,
            addComponent,
            clearPendingToolType: vi.fn()
        };

        ToolboxBindingsController.bindToolboxEvents.call(ctx);
        expect(() => svg.trigger('drop', {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            clientX: 10,
            clientY: 10,
            dataTransfer: {
                getData: vi.fn(() => 'Resistor')
            }
        })).not.toThrow();
        expect(addComponent).toHaveBeenCalledTimes(1);
    });
});
