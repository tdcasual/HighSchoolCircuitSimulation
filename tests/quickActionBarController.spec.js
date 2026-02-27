import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuickActionBarController } from '../src/ui/interaction/QuickActionBarController.js';

function createClassList(initial = []) {
    const set = new Set(initial);
    return {
        add: vi.fn((...classes) => classes.forEach((name) => set.add(name))),
        remove: vi.fn((...classes) => classes.forEach((name) => set.delete(name))),
        toggle: vi.fn((name, force) => {
            if (force === undefined) {
                if (set.has(name)) {
                    set.delete(name);
                    return false;
                }
                set.add(name);
                return true;
            }
            if (force) {
                set.add(name);
            } else {
                set.delete(name);
            }
            return !!force;
        }),
        contains: vi.fn((name) => set.has(name)),
        _set: set
    };
}

function createStyleMock() {
    const values = new Map();
    return {
        setProperty: vi.fn((name, value) => {
            values.set(name, String(value));
        }),
        getPropertyValue: vi.fn((name) => values.get(name) || '')
    };
}

function createMockElement(tagName = 'div', options = {}) {
    const listeners = new Map();
    const {
        rectHeight = 0,
        classes = []
    } = options;
    const element = {
        tagName: String(tagName).toUpperCase(),
        id: '',
        className: '',
        hidden: false,
        textContent: '',
        dataset: {},
        classList: createClassList(classes),
        style: createStyleMock(),
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
        getBoundingClientRect() {
            return {
                x: 0,
                y: 0,
                width: 0,
                height: rectHeight,
                top: 0,
                right: 0,
                bottom: rectHeight,
                left: 0
            };
        },
        setAttribute: vi.fn(),
    };
    Object.defineProperty(element, 'innerHTML', {
        get() {
            return '';
        },
        set(value) {
            if (value === '') {
                this.children = [];
            }
        }
    });
    return element;
}

function setupEnvironment(options = {}) {
    const {
        bodyClasses = ['layout-mode-compact'],
        statusBarHeight = 0
    } = options;
    const container = createMockElement('main');
    const statusBar = createMockElement('div', { rectHeight: statusBarHeight });
    const toolbox = createMockElement('aside');
    const sidePanel = createMockElement('aside');
    const body = { classList: createClassList(bodyClasses) };
    const doc = {
        body,
        getElementById: vi.fn((id) => {
            if (id === 'canvas-container') return container;
            if (id === 'status-bar') return statusBar;
            if (id === 'toolbox') return toolbox;
            if (id === 'side-panel') return sidePanel;
            return null;
        }),
        createElement: vi.fn((tag) => createMockElement(tag))
    };
    vi.stubGlobal('document', doc);
    vi.stubGlobal('window', {
        matchMedia: vi.fn(() => ({ matches: true }))
    });
    return { container, statusBar, toolbox, sidePanel };
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
            app: {
                responsiveLayout: {
                    isOverlayMode: () => false
                }
            },
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
            app: {
                responsiveLayout: {
                    isOverlayMode: () => false
                }
            },
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

    it('hides quick action bar when overlay drawer is open', () => {
        setupEnvironment();
        const interaction = {
            selectedComponent: 'R1',
            selectedWire: null,
            app: {
                responsiveLayout: {
                    isOverlayMode: () => true,
                    toolboxOpen: false,
                    sidePanelOpen: true
                }
            },
            circuit: {
                getComponent: vi.fn(() => ({ id: 'R1', label: '电阻R1' }))
            }
        };
        const controller = new QuickActionBarController(interaction);

        controller.update();

        expect(controller.root.hidden).toBe(true);
    });

    it('applies status-bar-aware bottom offset to avoid overlap', () => {
        setupEnvironment({ statusBarHeight: 58 });
        const interaction = {
            selectedComponent: 'R1',
            selectedWire: null,
            app: {
                responsiveLayout: {
                    isOverlayMode: () => false
                }
            },
            circuit: {
                getComponent: vi.fn(() => ({ id: 'R1', label: '电阻R1' }))
            }
        };
        const controller = new QuickActionBarController(interaction);

        controller.update();

        expect(controller.root.hidden).toBe(false);
        expect(controller.root.style.setProperty).toHaveBeenCalledWith('--quick-action-bottom-offset', '66px');
    });
});
