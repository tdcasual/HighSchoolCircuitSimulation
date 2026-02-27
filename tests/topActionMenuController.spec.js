import { afterEach, describe, expect, it, vi } from 'vitest';
import { TopActionMenuController } from '../src/ui/TopActionMenuController.js';

function createClassList() {
    const values = new Set();
    return {
        add: vi.fn((...classes) => classes.forEach((name) => values.add(name))),
        remove: vi.fn((...classes) => classes.forEach((name) => values.delete(name))),
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
        contains: vi.fn((name) => values.has(name))
    };
}

function createElementMock() {
    const listeners = new Map();
    const attrs = {};
    return {
        hidden: true,
        classList: createClassList(),
        addEventListener: vi.fn((eventName, handler) => {
            listeners.set(eventName, handler);
        }),
        setAttribute: vi.fn((name, value) => {
            attrs[name] = String(value);
        }),
        getAttribute: vi.fn((name) => attrs[name]),
        contains: vi.fn(() => false),
        trigger(eventName, event = {}) {
            const handler = listeners.get(eventName);
            if (handler) handler(event);
        }
    };
}

function setupFixture() {
    const button = createElementMock();
    const menu = createElementMock();
    const elements = {
        'btn-top-action-more': button,
        'top-action-more-menu': menu
    };
    const listeners = new Map();
    let phoneMode = true;
    const documentMock = {
        body: {
            classList: {
                contains: vi.fn((name) => name === 'layout-mode-phone' && phoneMode)
            }
        },
        getElementById: vi.fn((id) => elements[id] || null),
        addEventListener: vi.fn((eventName, handler) => {
            listeners.set(eventName, handler);
        }),
        trigger(eventName, event = {}) {
            const handler = listeners.get(eventName);
            if (handler) handler(event);
        },
        setPhoneMode(next) {
            phoneMode = !!next;
        }
    };

    vi.stubGlobal('document', documentMock);
    return { button, menu, documentMock };
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('TopActionMenuController', () => {
    it('toggles menu in phone mode and closes after selecting an item', () => {
        const { button, menu } = setupFixture();
        const controller = new TopActionMenuController({});

        expect(controller.isOpen).toBe(false);
        button.trigger('click', { preventDefault: vi.fn(), stopPropagation: vi.fn() });
        expect(controller.isOpen).toBe(true);
        expect(menu.hidden).toBe(false);
        expect(button.getAttribute('aria-expanded')).toBe('true');

        menu.trigger('click', { target: { closest: () => ({}) } });
        expect(controller.isOpen).toBe(false);
        expect(menu.hidden).toBe(true);
        expect(button.getAttribute('aria-expanded')).toBe('false');
    });

    it('closes menu on outside pointerdown and Escape', () => {
        const { button, menu, documentMock } = setupFixture();
        const controller = new TopActionMenuController({});

        button.trigger('click', { preventDefault: vi.fn(), stopPropagation: vi.fn() });
        expect(controller.isOpen).toBe(true);

        documentMock.trigger('pointerdown', { target: {} });
        expect(controller.isOpen).toBe(false);

        button.trigger('click', { preventDefault: vi.fn(), stopPropagation: vi.fn() });
        expect(controller.isOpen).toBe(true);

        documentMock.trigger('keydown', { key: 'Escape' });
        expect(controller.isOpen).toBe(false);
        expect(menu.hidden).toBe(true);
    });

    it('does not open outside phone mode and sync closes open menu', () => {
        const { button, menu, documentMock } = setupFixture();
        const controller = new TopActionMenuController({});

        documentMock.setPhoneMode(false);
        button.trigger('click', { preventDefault: vi.fn(), stopPropagation: vi.fn() });
        expect(controller.isOpen).toBe(false);
        expect(menu.hidden).toBe(true);

        documentMock.setPhoneMode(true);
        button.trigger('click', { preventDefault: vi.fn(), stopPropagation: vi.fn() });
        expect(controller.isOpen).toBe(true);

        documentMock.setPhoneMode(false);
        controller.sync();
        expect(controller.isOpen).toBe(false);
        expect(menu.hidden).toBe(true);
    });
});
