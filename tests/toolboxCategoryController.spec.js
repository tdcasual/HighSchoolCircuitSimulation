import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToolboxCategoryController } from '../src/ui/ToolboxCategoryController.js';

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
            if (force) values.add(name);
            else values.delete(name);
            return !!force;
        }),
        contains: vi.fn((name) => values.has(name))
    };
}

function createHeadingMock() {
    const listeners = new Map();
    const attrs = {};
    return {
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
        removeAttribute: vi.fn((name) => {
            delete attrs[name];
        }),
        getAttribute: vi.fn((name) => attrs[name]),
        trigger(eventName, event = {}) {
            const handler = listeners.get(eventName);
            if (handler) handler(event);
        }
    };
}

function createCategoryMock(dataset = {}) {
    const heading = createHeadingMock();
    return {
        dataset,
        classList: createClassList(),
        querySelector: vi.fn((selector) => {
            if (selector === 'h3') return heading;
            return null;
        }),
        heading
    };
}

function setupFixture(options = {}) {
    const stored = options.stored || null;
    const power = createCategoryMock({ category: 'power' });
    const resistors = createCategoryMock({ category: 'resistors' });
    const actions = createCategoryMock({ category: 'actions', collapsible: 'false' });
    const categories = [power, resistors, actions];
    const toolbox = {
        querySelectorAll: vi.fn((selector) => {
            if (selector === '.tool-category[data-category]') return categories;
            return [];
        })
    };

    const values = new Map([
        ['ui.toolbox_category_collapsed_v1', stored]
    ]);
    const localStorageMock = {
        getItem: vi.fn((key) => values.get(key) ?? null),
        setItem: vi.fn((key, value) => values.set(key, String(value)))
    };

    vi.stubGlobal('document', {
        getElementById: vi.fn((id) => (id === 'toolbox' ? toolbox : null))
    });
    vi.stubGlobal('localStorage', localStorageMock);

    return { power, resistors, actions, localStorageMock };
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('ToolboxCategoryController', () => {
    it('restores collapsed state from storage and sets aria-expanded', () => {
        const stored = JSON.stringify({ resistors: true });
        const { power, resistors, actions } = setupFixture({ stored });

        new ToolboxCategoryController({});

        expect(power.classList.contains('collapsed')).toBe(false);
        expect(resistors.classList.contains('collapsed')).toBe(true);
        expect(resistors.heading.getAttribute('aria-expanded')).toBe('false');
        expect(power.heading.getAttribute('role')).toBe('button');
        expect(actions.heading.getAttribute('role')).toBe(undefined);
    });

    it('toggles a category by click and persists state', () => {
        const { resistors, localStorageMock } = setupFixture();
        new ToolboxCategoryController({});

        resistors.heading.trigger('click');

        expect(resistors.classList.contains('collapsed')).toBe(true);
        const storedValue = localStorageMock.setItem.mock.calls.at(-1)?.[1];
        expect(JSON.parse(storedValue)).toMatchObject({ resistors: true });
    });

    it('supports keyboard toggle with Enter and Space', () => {
        const { power } = setupFixture();
        new ToolboxCategoryController({});

        const enterEvent = { key: 'Enter', preventDefault: vi.fn() };
        power.heading.trigger('keydown', enterEvent);
        expect(enterEvent.preventDefault).toHaveBeenCalledTimes(1);
        expect(power.classList.contains('collapsed')).toBe(true);

        const spaceEvent = { key: ' ', preventDefault: vi.fn() };
        power.heading.trigger('keydown', spaceEvent);
        expect(spaceEvent.preventDefault).toHaveBeenCalledTimes(1);
        expect(power.classList.contains('collapsed')).toBe(false);
    });

    it('destroy does not throw when removeEventListener is non-callable', () => {
        const { power } = setupFixture();
        const controller = new ToolboxCategoryController({});
        power.heading.removeEventListener = {};

        expect(() => controller.destroy()).not.toThrow();
    });

    it('setupCategory does not throw when addEventListener is non-callable in fallback mode', () => {
        const heading = {
            setAttribute: vi.fn(),
            removeAttribute: vi.fn(),
            addEventListener: {}
        };
        const category = {
            dataset: { category: 'power' },
            querySelector: vi.fn((selector) => (selector === 'h3' ? heading : null))
        };
        const ctx = {
            ensureToggleButton: vi.fn(() => null),
            toggleCategory: vi.fn(),
            boundListeners: []
        };

        expect(() => ToolboxCategoryController.prototype.setupCategory.call(ctx, category)).not.toThrow();
        expect(ctx.boundListeners).toHaveLength(0);
    });

    it('applyState does not throw when classList.toggle and setAttribute are non-callable', () => {
        const heading = { setAttribute: {} };
        const button = { setAttribute: {}, textContent: '' };
        const category = {
            dataset: { category: 'power' },
            classList: { toggle: {} },
            querySelector: vi.fn((selector) => {
                if (selector === 'h3') return heading;
                if (selector === '.tool-category-toggle') return button;
                return null;
            })
        };
        const ctx = {
            categories: [category],
            state: { power: true },
            storageKey: 'ui.toolbox_category_collapsed_v1'
        };

        expect(() => ToolboxCategoryController.prototype.applyState.call(ctx)).not.toThrow();
    });
});
