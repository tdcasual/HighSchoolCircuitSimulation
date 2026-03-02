import { afterEach, describe, expect, it, vi } from 'vitest';
import * as PropertyDialogController from '../src/ui/interaction/PropertyDialogController.js';

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('PropertyDialogController.showPropertyDialog', () => {
    it('returns early when component is missing', () => {
        const ctx = {
            circuit: {
                getComponent: vi.fn(() => null)
            }
        };

        PropertyDialogController.showPropertyDialog.call(ctx, 'missing');

        expect(ctx.circuit.getComponent).toHaveBeenCalledWith('missing');
        expect(ctx.editingComponent).toBeUndefined();
    });

    it('shows dialog and writes title for known component', () => {
        const comp = { id: 'G1', type: 'Ground' };
        const titleNode = { textContent: '' };
        const contentNode = { innerHTML: '', appendChild: vi.fn() };
        const dialogNode = {
            classList: { remove: vi.fn() }
        };
        const createElement = vi.fn(() => ({
            className: '',
            id: '',
            textContent: '',
            style: {},
            setAttribute: vi.fn(),
            appendChild: vi.fn(),
            addEventListener: vi.fn(),
            classList: {
                add: vi.fn(),
                remove: vi.fn(),
                contains: vi.fn(() => false),
                toggle: vi.fn()
            }
        }));

        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => {
                if (id === 'dialog-overlay') return dialogNode;
                if (id === 'dialog-title') return titleNode;
                if (id === 'dialog-content') return contentNode;
                return null;
            }),
            createElement
        });

        const ctx = {
            circuit: {
                getComponent: vi.fn(() => comp)
            }
        };

        PropertyDialogController.showPropertyDialog.call(ctx, 'G1');

        expect(ctx.editingComponent).toBe(comp);
        expect(titleNode.textContent).toContain('接地');
        expect(dialogNode.classList.remove).toHaveBeenCalledWith('hidden');
    });

    it('does not throw when dialog DOM nodes are partially missing', () => {
        const comp = { id: 'R1', type: 'Resistor', resistance: 100 };
        const updateStatus = vi.fn();

        vi.stubGlobal('document', {
            getElementById: vi.fn(() => null)
        });

        const ctx = {
            circuit: {
                getComponent: vi.fn(() => comp)
            },
            updateStatus
        };

        expect(() => PropertyDialogController.showPropertyDialog.call(ctx, 'R1')).not.toThrow();
        expect(ctx.editingComponent).toBe(null);
        expect(updateStatus).toHaveBeenCalledTimes(1);
    });

    it('does not throw when dialog classList.remove is non-callable', () => {
        const comp = { id: 'G1', type: 'Ground' };
        const titleNode = { textContent: '' };
        const contentNode = { innerHTML: '', appendChild: vi.fn() };
        const dialogNode = {
            classList: { remove: {} }
        };
        const createElement = vi.fn(() => ({
            className: '',
            id: '',
            textContent: '',
            style: {},
            setAttribute: vi.fn(),
            appendChild: vi.fn(),
            addEventListener: vi.fn(),
            classList: {
                add: vi.fn(),
                remove: vi.fn(),
                contains: vi.fn(() => false),
                toggle: vi.fn()
            }
        }));

        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => {
                if (id === 'dialog-overlay') return dialogNode;
                if (id === 'dialog-title') return titleNode;
                if (id === 'dialog-content') return contentNode;
                return null;
            }),
            createElement
        });

        const ctx = {
            circuit: {
                getComponent: vi.fn(() => comp)
            }
        };

        expect(() => PropertyDialogController.showPropertyDialog.call(ctx, 'G1')).not.toThrow();
    });

    it('switch toggle click does not throw when classList add/remove are non-callable', () => {
        const listenersOpen = new Map();
        const listenersClose = new Map();
        const switchOpen = {
            classList: { add: {}, remove: {} },
            addEventListener: vi.fn((eventName, handler) => {
                listenersOpen.set(eventName, handler);
            }),
            trigger(eventName) {
                const handler = listenersOpen.get(eventName);
                if (handler) handler();
            }
        };
        const switchClose = {
            classList: { add: {}, remove: {} },
            addEventListener: vi.fn((eventName, handler) => {
                listenersClose.set(eventName, handler);
            }),
            trigger(eventName) {
                const handler = listenersClose.get(eventName);
                if (handler) handler();
            }
        };
        const comp = { id: 'S1', type: 'Switch', closed: false };
        const titleNode = { textContent: '' };
        const contentNode = { innerHTML: '', appendChild: vi.fn() };
        const dialogNode = {
            classList: { remove: vi.fn() }
        };
        const createElement = vi.fn(() => ({
            className: '',
            id: '',
            textContent: '',
            style: {},
            setAttribute: vi.fn(),
            appendChild: vi.fn(),
            addEventListener: vi.fn(),
            classList: {
                add: vi.fn(),
                remove: vi.fn(),
                contains: vi.fn(() => false),
                toggle: vi.fn()
            }
        }));

        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => {
                if (id === 'dialog-overlay') return dialogNode;
                if (id === 'dialog-title') return titleNode;
                if (id === 'dialog-content') return contentNode;
                if (id === 'switch-open') return switchOpen;
                if (id === 'switch-close') return switchClose;
                return null;
            }),
            createElement
        });

        const ctx = {
            circuit: {
                getComponent: vi.fn(() => comp)
            }
        };

        PropertyDialogController.showPropertyDialog.call(ctx, 'S1');
        expect(() => switchOpen.trigger('click')).not.toThrow();
        expect(() => switchClose.trigger('click')).not.toThrow();
    });
});
