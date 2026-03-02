import { afterEach, describe, expect, it, vi } from 'vitest';
import { updatePropertyPanel } from '../src/ui/interaction/PropertyPanelController.js';

function createClassList(initial = []) {
    const tokens = new Set(initial);
    return {
        add: vi.fn((...classes) => {
            classes.forEach((name) => tokens.add(name));
        }),
        remove: vi.fn((...classes) => {
            classes.forEach((name) => tokens.delete(name));
        }),
        toggle: vi.fn((name, force) => {
            if (force === undefined) {
                if (tokens.has(name)) {
                    tokens.delete(name);
                    return false;
                }
                tokens.add(name);
                return true;
            }
            if (force) {
                tokens.add(name);
            } else {
                tokens.delete(name);
            }
            return !!force;
        }),
        contains: vi.fn((name) => tokens.has(name)),
        _tokens: tokens
    };
}

function createElement(tagName = 'div') {
    const listeners = new Map();
    const element = {
        tagName: String(tagName).toUpperCase(),
        id: '',
        style: {},
        children: [],
        attributes: {},
        classList: createClassList(),
        _className: '',
        _textContent: '',
        addEventListener: vi.fn((eventName, handler) => {
            listeners.set(eventName, handler);
        }),
        trigger(eventName, event = {}) {
            const handler = listeners.get(eventName);
            if (handler) handler(event);
        },
        appendChild(child) {
            this.children.push(child);
            return child;
        },
        removeChild(child) {
            const index = this.children.indexOf(child);
            if (index >= 0) this.children.splice(index, 1);
            return child;
        },
        setAttribute(name, value) {
            this.attributes[name] = String(value);
            if (name === 'id') this.id = String(value);
        },
        querySelector(selector) {
            if (typeof selector !== 'string' || !selector) return null;
            const selectors = selector.split(',').map((part) => part.trim()).filter(Boolean);
            for (const singleSelector of selectors) {
                const found = findInTree(this, singleSelector);
                if (found) return found;
            }
            return null;
        },
        get firstChild() {
            return this.children.length > 0 ? this.children[0] : null;
        }
    };

    Object.defineProperty(element, 'className', {
        get() {
            return element._className;
        },
        set(value) {
            const next = String(value || '');
            element._className = next;
            const nextTokens = next.split(/\s+/).filter(Boolean);
            element.classList._tokens.clear();
            nextTokens.forEach((name) => element.classList._tokens.add(name));

            // Reproduce fragile DOM: contains exists but is non-callable.
            if (element.classList._tokens.has('prop-row')) {
                element.classList.contains = {};
            }
        }
    });

    Object.defineProperty(element, 'textContent', {
        get() {
            return element._textContent;
        },
        set(value) {
            element._textContent = String(value ?? '');
        }
    });

    return element;
}

function createTextNode(text) {
    return {
        nodeType: 3,
        textContent: String(text ?? '')
    };
}

function findInTree(root, selector) {
    for (const child of root.children || []) {
        if (!child || typeof child !== 'object') continue;
        if (selector.startsWith('#')) {
            const id = selector.slice(1);
            if (child.id === id) return child;
        } else if (selector.startsWith('.')) {
            const className = selector.slice(1);
            const tokens = child.className ? String(child.className).split(/\s+/).filter(Boolean) : [];
            if (tokens.includes(className)) return child;
        }
        const nested = findInTree(child, selector);
        if (nested) return nested;
    }
    return null;
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('PropertyPanelController.updatePropertyPanel', () => {
    it('does not throw when rebalance sees non-callable classList.contains', () => {
        const content = createElement('div');
        content.id = 'property-content';

        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => {
                if (id === 'property-content') return content;
                return null;
            }),
            createElement: vi.fn((tagName) => createElement(tagName)),
            createTextNode: vi.fn((text) => createTextNode(text))
        });

        const context = {
            renderer: {
                render: vi.fn(),
                updateValues: vi.fn()
            },
            app: {
                observationPanel: {
                    refreshComponentOptions: vi.fn(),
                    refreshDialGauges: vi.fn()
                },
                updateStatus: vi.fn()
            }
        };
        const comp = {
            id: 'GND1',
            type: 'Ground',
            label: '',
            display: {},
            currentValue: 0,
            voltageValue: 0,
            powerValue: 0
        };

        expect(() => updatePropertyPanel.call(context, comp)).not.toThrow();
    });

    it('display chip click does not throw when classList.toggle and setAttribute are non-callable', () => {
        const content = createElement('div');
        content.id = 'property-content';

        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => {
                if (id === 'property-content') return content;
                return null;
            }),
            createElement: vi.fn((tagName) => createElement(tagName)),
            createTextNode: vi.fn((text) => createTextNode(text))
        });

        const context = {
            renderer: {
                render: vi.fn(),
                updateValues: vi.fn()
            },
            app: {
                observationPanel: {
                    refreshComponentOptions: vi.fn(),
                    refreshDialGauges: vi.fn()
                },
                updateStatus: vi.fn()
            }
        };
        const comp = {
            id: 'R1',
            type: 'Resistor',
            label: '',
            resistance: 100,
            display: { current: true, voltage: false, power: false },
            currentValue: 0,
            voltageValue: 0,
            powerValue: 0
        };

        updatePropertyPanel.call(context, comp);
        const chip = findInTree(content, '.display-chip');
        expect(chip).toBeTruthy();
        chip.classList.toggle = {};
        chip.setAttribute = {};

        expect(() => chip.trigger('click')).not.toThrow();
        expect(context.renderer.updateValues).toHaveBeenCalledTimes(1);
    });

    it('does not throw when label input addEventListener throws', () => {
        const content = createElement('div');
        content.id = 'property-content';

        const createElementWithFragileLabelInput = (tagName) => {
            const node = createElement(tagName);
            if (String(tagName).toLowerCase() === 'input') {
                node.addEventListener = vi.fn(() => {
                    throw new TypeError('broken add');
                });
            }
            return node;
        };

        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => {
                if (id === 'property-content') return content;
                return null;
            }),
            createElement: vi.fn((tagName) => createElementWithFragileLabelInput(tagName)),
            createTextNode: vi.fn((text) => createTextNode(text))
        });

        const context = {
            renderer: {
                render: vi.fn(),
                updateValues: vi.fn()
            },
            app: {
                observationPanel: {
                    refreshComponentOptions: vi.fn(),
                    refreshDialGauges: vi.fn()
                },
                updateStatus: vi.fn()
            }
        };
        const comp = {
            id: 'GND1',
            type: 'Ground',
            label: '',
            display: {},
            currentValue: 0,
            voltageValue: 0,
            powerValue: 0
        };

        expect(() => updatePropertyPanel.call(context, comp)).not.toThrow();
    });
});
