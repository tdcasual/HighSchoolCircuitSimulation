import { afterEach, describe, expect, it, vi } from 'vitest';
import { Renderer } from '../src/ui/Renderer.js';
import { SVGRenderer } from '../src/components/Component.js';

function createRendererContext(component, element = {}) {
    const renderer = Object.create(Renderer.prototype);
    renderer.circuit = {
        getComponent: (id) => (id === component.id ? component : null)
    };
    renderer.defaultDisplay = {
        current: true,
        voltage: false,
        power: false
    };
    renderer.componentElements = new Map([[component.id, element]]);
    renderer.valueDisplaySnapshot = new Map();
    return renderer;
}

describe('Renderer value snapshot updates', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('skips value display writes when snapshot is unchanged', () => {
        const component = {
            id: 'R1',
            type: 'Resistor',
            currentValue: 0.2,
            voltageValue: 2,
            powerValue: 0.4,
            display: {}
        };
        const renderer = createRendererContext(component, {});
        const updateSpy = vi.spyOn(SVGRenderer, 'updateValueDisplay').mockImplementation(() => {});

        Renderer.prototype.updateValues.call(renderer);
        Renderer.prototype.updateValues.call(renderer);

        expect(updateSpy).toHaveBeenCalledTimes(1);

        component.currentValue = 0.25;
        Renderer.prototype.updateValues.call(renderer);
        expect(updateSpy).toHaveBeenCalledTimes(2);
    });

    it('forces updates when caller requests force refresh', () => {
        const component = {
            id: 'R2',
            type: 'Resistor',
            currentValue: 0.1,
            voltageValue: 1,
            powerValue: 0.1,
            display: {}
        };
        const renderer = createRendererContext(component, {});
        const updateSpy = vi.spyOn(SVGRenderer, 'updateValueDisplay').mockImplementation(() => {});

        Renderer.prototype.updateValues.call(renderer);
        Renderer.prototype.updateValues.call(renderer, true);

        expect(updateSpy).toHaveBeenCalledTimes(2);
    });

    it('removes stale snapshot entries when component disappears', () => {
        const component = {
            id: 'R3',
            type: 'Resistor',
            currentValue: 0,
            voltageValue: 0,
            powerValue: 0,
            display: {}
        };
        const renderer = createRendererContext(component, {});
        renderer.valueDisplaySnapshot.set(component.id, 'old');
        renderer.componentElements.clear();

        Renderer.prototype.updateValues.call(renderer);

        expect(renderer.valueDisplaySnapshot.has(component.id)).toBe(false);
    });

    it('refreshComponent does not throw when old element classList.contains is non-callable', () => {
        const component = {
            id: 'R4',
            type: 'Resistor',
            currentValue: 0.2,
            voltageValue: 2,
            powerValue: 0.4,
            display: {}
        };
        const oldElement = {
            classList: {
                contains: {}
            },
            replaceWith: vi.fn()
        };
        const newElement = {
            classList: {
                add: vi.fn()
            }
        };
        const renderer = createRendererContext(component, oldElement);

        vi.spyOn(SVGRenderer, 'createComponentGroup').mockReturnValue(newElement);
        vi.spyOn(SVGRenderer, 'updateValueDisplay').mockImplementation(() => {});

        expect(() => Renderer.prototype.refreshComponent.call(renderer, component)).not.toThrow();
        expect(oldElement.replaceWith).toHaveBeenCalledWith(newElement);
        expect(newElement.classList.add).not.toHaveBeenCalled();
    });

    it('setSelected does not throw when classList add/remove are non-callable', () => {
        const component = {
            id: 'R5',
            type: 'Resistor',
            currentValue: 0,
            voltageValue: 0,
            powerValue: 0,
            display: {}
        };
        const renderer = createRendererContext(component, {
            classList: {
                add: {},
                remove: {}
            }
        });

        expect(() => Renderer.prototype.setSelected.call(renderer, 'R5', true)).not.toThrow();
        expect(() => Renderer.prototype.setSelected.call(renderer, 'R5', false)).not.toThrow();
    });

    it('clearSelection does not throw when classList.remove is non-callable', () => {
        const component = {
            id: 'R6',
            type: 'Resistor',
            currentValue: 0,
            voltageValue: 0,
            powerValue: 0,
            display: {}
        };
        const renderer = createRendererContext(component, {
            classList: {
                remove: {}
            }
        });
        renderer.wireElements = new Map([['W1', { classList: { remove: {} } }]]);
        renderer.circuit.getWire = vi.fn(() => ({ id: 'W1' }));
        vi.spyOn(SVGRenderer, 'updateWirePath').mockImplementation(() => {});

        expect(() => Renderer.prototype.clearSelection.call(renderer)).not.toThrow();
    });

    it('setWireSelected does not throw when wire classList add/remove are non-callable', () => {
        const component = {
            id: 'R7',
            type: 'Resistor',
            currentValue: 0,
            voltageValue: 0,
            powerValue: 0,
            display: {}
        };
        const renderer = createRendererContext(component, {});
        renderer.wireElements = new Map([['W2', { classList: { add: {}, remove: {} } }]]);
        renderer.circuit.getWire = vi.fn(() => ({ id: 'W2', a: { x: 0, y: 0 }, b: { x: 10, y: 0 } }));
        renderer.getWireEndpointPosition = vi.fn((wire, end) => wire[end]);
        vi.spyOn(SVGRenderer, 'updateWirePath').mockImplementation(() => {});

        expect(() => Renderer.prototype.setWireSelected.call(renderer, 'W2', true)).not.toThrow();
        expect(() => Renderer.prototype.setWireSelected.call(renderer, 'W2', false)).not.toThrow();
    });

    it('updateWireAnimations does not throw when wirePath classList methods are non-callable', () => {
        const component = {
            id: 'R8',
            type: 'Resistor',
            currentValue: 0,
            voltageValue: 0,
            powerValue: 0,
            display: {}
        };
        const wirePath = {
            classList: {
                add: {},
                remove: {}
            }
        };
        const wireGroup = {
            querySelector: vi.fn(() => wirePath)
        };
        const wire = { id: 'W3', a: { x: 0, y: 0 }, b: { x: 10, y: 0 } };
        const renderer = createRendererContext(component, {});
        renderer.wireElements = new Map([['W3', wireGroup]]);
        renderer.circuit.getWire = vi.fn(() => wire);
        renderer.circuit.isWireInShortCircuit = vi.fn(() => false);
        renderer.circuit.getWireCurrentInfo = vi.fn(() => ({
            current: 0.2,
            isShorted: false,
            flowDirection: 1
        }));

        expect(() => Renderer.prototype.updateWireAnimations.call(renderer, true, { valid: true })).not.toThrow();
    });

    it('updateTempWire does not throw when setAttribute is non-callable', () => {
        const renderer = Object.create(Renderer.prototype);
        const line = {
            setAttribute: {}
        };

        expect(() => Renderer.prototype.updateTempWire.call(renderer, line, 1, 2, 3, 4)).not.toThrow();
    });

    it('highlightTerminal does not throw when marker setAttribute throws', () => {
        const renderer = Object.create(Renderer.prototype);
        renderer.clearTerminalHighlight = vi.fn();
        renderer.getTerminalPosition = vi.fn(() => ({ x: 10, y: 20 }));
        renderer.uiLayer = {
            appendChild: vi.fn()
        };

        const createSvgElement = vi.fn(() => ({
            setAttribute: vi.fn(() => {
                throw new TypeError('broken setAttribute');
            })
        }));
        vi.stubGlobal('document', {
            createElementNS: createSvgElement
        });

        expect(() => Renderer.prototype.highlightTerminal.call(renderer, 'R1', 0, { pointerType: 'touch' })).not.toThrow();
    });
});
