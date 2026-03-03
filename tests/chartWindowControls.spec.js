import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rebuildSeriesControls } from '../src/ui/charts/ChartWindowControls.js';
import { QuantityIds, TIME_SOURCE_ID } from '../src/ui/observation/ObservationSources.js';

function createClassList(initial = []) {
    const classes = new Set(initial);
    return {
        add: (...names) => names.forEach((name) => classes.add(name)),
        remove: (...names) => names.forEach((name) => classes.delete(name)),
        toggle: (name, force) => {
            if (force === undefined) {
                if (classes.has(name)) {
                    classes.delete(name);
                    return false;
                }
                classes.add(name);
                return true;
            }
            if (force) classes.add(name);
            else classes.delete(name);
            return !!force;
        },
        contains: (name) => classes.has(name)
    };
}

function createMockElement(tagName = 'div') {
    const listeners = new Map();
    const children = [];
    const element = {
        tagName: String(tagName || 'div').toUpperCase(),
        className: '',
        textContent: '',
        style: {},
        dataset: {},
        classList: createClassList(),
        checked: false,
        _value: '',
        appendChild(child) {
            children.push(child);
            return child;
        },
        removeChild(child) {
            const index = children.indexOf(child);
            if (index >= 0) children.splice(index, 1);
            return child;
        },
        addEventListener(eventName, handler) {
            if (!listeners.has(eventName)) listeners.set(eventName, []);
            listeners.get(eventName).push(handler);
        },
        removeEventListener(eventName, handler) {
            const handlers = listeners.get(eventName);
            if (!handlers) return;
            const index = handlers.indexOf(handler);
            if (index >= 0) handlers.splice(index, 1);
        },
        dispatchEvent(event) {
            const type = String(event?.type || '');
            const handlers = listeners.get(type) || [];
            handlers.forEach((handler) => handler.call(element, event));
            return true;
        },
        setAttribute(name, value) {
            if (name === 'value') {
                this.value = String(value);
                return;
            }
            this[name] = String(value);
        }
    };

    Object.defineProperty(element, 'children', {
        get() {
            return children;
        }
    });
    Object.defineProperty(element, 'firstChild', {
        get() {
            return children[0] || null;
        }
    });
    Object.defineProperty(element, 'value', {
        get() {
            if (this._value) return this._value;
            return children[0]?.value || '';
        },
        set(nextValue) {
            this._value = String(nextValue);
        }
    });
    return element;
}

beforeEach(() => {
    vi.stubGlobal('document', {
        createElement: (tag) => createMockElement(tag),
        createTextNode: (text) => ({ nodeType: 3, textContent: String(text) })
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

function createControlGroup(labelText, fieldEl) {
    const group = document.createElement('label');
    const label = document.createElement('span');
    label.textContent = labelText;
    group.appendChild(label);
    group.appendChild(fieldEl);
    return group;
}

describe('ChartWindowControls', () => {
    it('normalizes scatter quantity when scatter source changes', () => {
        const updateSeries = vi.fn();
        const controller = {
            workspace: {
                circuit: {
                    components: new Map([
                        ['R1', { id: 'R1', type: 'Resistor' }]
                    ])
                },
                resolveSourceId: (sourceId) => (sourceId ? String(sourceId) : TIME_SOURCE_ID),
                commandService: {
                    updateSeries,
                    removeSeries: vi.fn()
                }
            },
            state: {
                id: 'chart_1',
                axis: {
                    xBinding: {
                        sourceId: TIME_SOURCE_ID,
                        quantityId: QuantityIds.Time,
                        transformId: 'identity'
                    }
                },
                series: [
                    {
                        id: 's1',
                        name: '系列 1',
                        sourceId: 'R1',
                        quantityId: QuantityIds.Current,
                        transformId: 'identity',
                        visible: true,
                        color: '#1d4ed8',
                        xMode: 'scatter-override',
                        scatterXBinding: {
                            sourceId: TIME_SOURCE_ID,
                            quantityId: QuantityIds.Time,
                            transformId: 'identity'
                        }
                    }
                ]
            },
            elements: {
                legendBody: document.createElement('div'),
                xSource: document.createElement('select'),
                xQuantity: document.createElement('select')
            },
            seriesElements: new Map(),
            createControlGroup
        };

        rebuildSeriesControls(controller);

        const seriesEls = controller.seriesElements.get('s1');
        expect(seriesEls.scatterQuantitySelect.value).toBe(QuantityIds.Time);

        seriesEls.scatterSourceSelect.value = 'R1';
        seriesEls.scatterSourceSelect.dispatchEvent({ type: 'change' });

        expect(updateSeries).toHaveBeenCalledTimes(1);
        expect(updateSeries).toHaveBeenCalledWith('chart_1', 's1', {
            xMode: 'scatter-override',
            scatterXBinding: {
                sourceId: 'R1',
                quantityId: QuantityIds.Current,
                transformId: 'identity'
            }
        });
    });

    it('keeps numeric zero source ids when rebuilding controls', () => {
        const controller = {
            workspace: {
                circuit: {
                    components: new Map([
                        ['0', { id: '0', type: 'Resistor' }]
                    ])
                },
                resolveSourceId: (sourceId) => {
                    if (sourceId === undefined || sourceId === null || String(sourceId).trim() === '') {
                        return TIME_SOURCE_ID;
                    }
                    return String(sourceId).trim();
                },
                commandService: {
                    updateSeries: vi.fn(),
                    removeSeries: vi.fn()
                }
            },
            state: {
                id: 'chart_1',
                axis: {
                    xBinding: {
                        sourceId: 0,
                        quantityId: QuantityIds.Current,
                        transformId: 'identity'
                    }
                },
                series: [
                    {
                        id: 's1',
                        name: '系列 1',
                        sourceId: 0,
                        quantityId: QuantityIds.Current,
                        transformId: 'identity',
                        visible: true,
                        color: '#1d4ed8',
                        xMode: 'shared-x'
                    }
                ]
            },
            elements: {
                legendBody: document.createElement('div'),
                xSource: document.createElement('select'),
                xQuantity: document.createElement('select')
            },
            seriesElements: new Map(),
            createControlGroup
        };

        rebuildSeriesControls(controller);
        const seriesEls = controller.seriesElements.get('s1');

        expect(controller.elements.xSource.value).toBe('0');
        expect(seriesEls.sourceSelect.value).toBe('0');
    });
});
