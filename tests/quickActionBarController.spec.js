import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuickActionBarController } from '../src/ui/interaction/QuickActionBarController.js';

function createClassList(initial = []) {
    const set = new Set(initial);
    return {
        contains: vi.fn((name) => set.has(name))
    };
}

function createMockElement(tagName = 'div') {
    const listeners = new Map();
    return {
        tagName: String(tagName).toUpperCase(),
        id: '',
        className: '',
        hidden: false,
        textContent: '',
        dataset: {},
        children: [],
        appendChild(child) {
            this.children.push(child);
            return child;
        },
        addEventListener: vi.fn((eventName, handler) => {
            listeners.set(eventName, handler);
        }),
        trigger(eventName, event = {}) {
            const handler = listeners.get(eventName);
            if (handler) handler(event);
        },
        setAttribute: vi.fn(),
        innerHTML: ''
    };
}

function setupEnvironment() {
    const container = createMockElement('main');
    const body = { classList: createClassList(['layout-mode-compact']) };
    const doc = {
        body,
        getElementById: vi.fn((id) => {
            if (id === 'canvas-container') return container;
            return null;
        }),
        createElement: vi.fn((tag) => createMockElement(tag))
    };
    vi.stubGlobal('document', doc);
    vi.stubGlobal('window', {
        matchMedia: vi.fn(() => ({ matches: true }))
    });
    return { container };
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('QuickActionBarController', () => {
    it('renders component quick actions and dispatches rotate action', () => {
        setupEnvironment();
        const interaction = {
            selectedComponent: 'R1',
            selectedWire: null,
            circuit: {
                getComponent: vi.fn(() => ({ id: 'R1', label: '电阻R1' }))
            },
            showPropertyDialog: vi.fn(),
            rotateComponent: vi.fn(),
            duplicateComponent: vi.fn(),
            deleteComponent: vi.fn()
        };
        const controller = new QuickActionBarController(interaction);

        controller.update();

        expect(controller.root.hidden).toBe(false);
        expect(controller.label.textContent).toContain('电阻R1');
        expect(controller.actions.children).toHaveLength(4);

        controller.onActionClick({
            target: {
                closest: () => ({ dataset: { action: 'component-rotate' } })
            }
        });

        expect(interaction.rotateComponent).toHaveBeenCalledWith('R1');
    });

    it('dispatches wire midpoint split action', () => {
        setupEnvironment();
        const interaction = {
            selectedComponent: null,
            selectedWire: 'wire_1',
            circuit: {
                getWire: vi.fn(() => ({
                    id: 'wire_1',
                    a: { x: 10, y: 20 },
                    b: { x: 30, y: 60 }
                }))
            },
            splitWireAtPoint: vi.fn(),
            addObservationProbeForWire: vi.fn(),
            deleteWire: vi.fn()
        };
        const controller = new QuickActionBarController(interaction);

        controller.update();
        controller.onActionClick({
            target: {
                closest: () => ({ dataset: { action: 'wire-split-mid' } })
            }
        });

        expect(interaction.splitWireAtPoint).toHaveBeenCalledWith('wire_1', 20, 40);
    });
});
