import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResponsiveLayoutController } from '../src/ui/ResponsiveLayoutController.js';

function createClassList() {
    const values = new Set();
    return {
        add: vi.fn((...classes) => {
            classes.forEach((name) => values.add(name));
        }),
        remove: vi.fn((...classes) => {
            classes.forEach((name) => values.delete(name));
        }),
        toggle: vi.fn((name, force) => {
            if (force === undefined) {
                if (values.has(name)) {
                    values.delete(name);
                    return false;
                }
                values.add(name);
                return true;
            }
            if (force) {
                values.add(name);
            } else {
                values.delete(name);
            }
            return !!force;
        }),
        contains: vi.fn((name) => values.has(name)),
        _values: values
    };
}

function createElementMock() {
    const listeners = new Map();
    const attrs = {};
    return {
        hidden: false,
        classList: createClassList(),
        addEventListener: vi.fn((eventName, handler) => {
            listeners.set(eventName, handler);
        }),
        removeEventListener: vi.fn((eventName, handler) => {
            const current = listeners.get(eventName);
            if (current === handler) listeners.delete(eventName);
        }),
        setAttribute: vi.fn((name, value) => {
            attrs[name] = String(value);
        }),
        getAttribute: vi.fn((name) => attrs[name]),
        trigger(eventName, event = {}) {
            const handler = listeners.get(eventName);
            if (handler) handler(event);
        }
    };
}

function createWindowMock(width = 1366) {
    const listeners = new Map();
    return {
        innerWidth: width,
        addEventListener: vi.fn((eventName, handler) => {
            listeners.set(eventName, handler);
        }),
        removeEventListener: vi.fn((eventName, handler) => {
            const current = listeners.get(eventName);
            if (current === handler) listeners.delete(eventName);
        }),
        trigger(eventName, event = {}) {
            const handler = listeners.get(eventName);
            if (handler) handler(event);
        }
    };
}

function setupLayoutFixture(width = 1366) {
    const body = createElementMock();
    const toolbox = createElementMock();
    const sidePanel = createElementMock();
    const toolboxToggleBtn = createElementMock();
    const sidePanelToggleBtn = createElementMock();
    const backdrop = createElementMock();
    const elements = {
        toolbox,
        'side-panel': sidePanel,
        'btn-toggle-toolbox': toolboxToggleBtn,
        'btn-toggle-side-panel': sidePanelToggleBtn,
        'layout-backdrop': backdrop
    };
    const doc = {
        body,
        getElementById: vi.fn((id) => elements[id] || null)
    };
    const win = createWindowMock(width);
    vi.stubGlobal('document', doc);
    vi.stubGlobal('window', win);
    return { body, toolbox, sidePanel, toolboxToggleBtn, sidePanelToggleBtn, backdrop, win };
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('ResponsiveLayoutController', () => {
    it('applies desktop mode and hides drawer toggles on wide screens', () => {
        const { body, toolboxToggleBtn, sidePanelToggleBtn, backdrop } = setupLayoutFixture(1366);
        new ResponsiveLayoutController({});

        expect(body.classList.contains('layout-mode-desktop')).toBe(true);
        expect(toolboxToggleBtn.hidden).toBe(true);
        expect(sidePanelToggleBtn.hidden).toBe(true);
        expect(backdrop.hidden).toBe(true);
    });

    it('opens and closes compact drawers through toggle buttons and backdrop', () => {
        const {
            body,
            toolbox,
            sidePanel,
            toolboxToggleBtn,
            sidePanelToggleBtn,
            backdrop,
            win
        } = setupLayoutFixture(820);
        new ResponsiveLayoutController({});

        expect(body.classList.contains('layout-mode-compact')).toBe(true);
        expect(toolboxToggleBtn.hidden).toBe(false);
        expect(sidePanelToggleBtn.hidden).toBe(false);

        toolboxToggleBtn.trigger('click', { preventDefault: vi.fn() });
        expect(toolbox.classList.contains('layout-open')).toBe(true);
        expect(backdrop.classList.contains('active')).toBe(true);
        expect(backdrop.hidden).toBe(false);

        sidePanelToggleBtn.trigger('click', { preventDefault: vi.fn() });
        expect(toolbox.classList.contains('layout-open')).toBe(false);
        expect(sidePanel.classList.contains('layout-open')).toBe(true);

        backdrop.trigger('click');
        expect(sidePanel.classList.contains('layout-open')).toBe(false);
        expect(backdrop.hidden).toBe(true);

        toolboxToggleBtn.trigger('click', { preventDefault: vi.fn() });
        expect(toolbox.classList.contains('layout-open')).toBe(true);
        win.trigger('keydown', { key: 'Escape' });
        expect(toolbox.classList.contains('layout-open')).toBe(false);
        expect(backdrop.hidden).toBe(true);
    });

    it('switches to phone mode when viewport is narrow', () => {
        const { body, win, toolboxToggleBtn } = setupLayoutFixture(760);
        new ResponsiveLayoutController({});

        expect(body.classList.contains('layout-mode-compact')).toBe(true);
        win.innerWidth = 640;
        win.trigger('resize');

        expect(body.classList.contains('layout-mode-phone')).toBe(true);
        expect(toolboxToggleBtn.hidden).toBe(false);
    });
});
