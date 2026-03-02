import { afterEach, describe, expect, it, vi } from 'vitest';
import * as SelectionPanelController from '../src/ui/interaction/SelectionPanelController.js';

function createElementMock() {
    return {
        className: '',
        id: '',
        textContent: '',
        innerHTML: '',
        style: {},
        appendChild: vi.fn(),
        setAttribute: vi.fn()
    };
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('SelectionPanelController.selectWire safety', () => {
    it('does not throw when body classList contains is non-callable', () => {
        vi.stubGlobal('document', {
            body: {
                classList: {
                    contains: {}
                }
            },
            getElementById: vi.fn(() => null)
        });
        vi.stubGlobal('window', {
            matchMedia: vi.fn(() => ({ matches: false }))
        });

        const context = {
            clearSelection: vi.fn(),
            renderer: {
                setWireSelected: vi.fn()
            },
            circuit: {
                getWire: vi.fn(() => ({
                    a: { x: 0, y: 0 },
                    b: { x: 10, y: 10 }
                }))
            },
            quickActionBar: {
                notifyActivity: vi.fn(),
                maybeShowLongPressHint: vi.fn(),
                update: vi.fn()
            }
        };

        expect(() => SelectionPanelController.selectWire.call(context, 'W1')).not.toThrow();
    });

    it('does not throw when property content classList.remove is non-callable', () => {
        const content = {
            classList: {
                remove: {}
            },
            firstChild: null,
            removeChild: vi.fn(),
            appendChild: vi.fn()
        };
        vi.stubGlobal('document', {
            body: {
                classList: {
                    contains: vi.fn(() => false)
                }
            },
            getElementById: vi.fn((id) => (id === 'property-content' ? content : null)),
            createElement: vi.fn(() => createElementMock()),
            createTextNode: vi.fn((text) => ({ textContent: String(text) }))
        });
        vi.stubGlobal('window', {
            matchMedia: vi.fn(() => ({ matches: true }))
        });

        const context = {
            clearSelection: vi.fn(),
            renderer: {
                setWireSelected: vi.fn()
            },
            circuit: {
                getWire: vi.fn(() => ({
                    a: { x: 0, y: 0 },
                    b: { x: 30, y: 40 }
                }))
            },
            quickActionBar: {
                notifyActivity: vi.fn(),
                maybeShowLongPressHint: vi.fn(),
                update: vi.fn()
            }
        };

        expect(() => SelectionPanelController.selectWire.call(context, 'W1')).not.toThrow();
    });
});
