import { describe, expect, it, vi } from 'vitest';
import { SVGRenderer } from '../src/components/Component.js';
import { updateValueDisplayRuntime } from '../src/components/render/ComponentVisualUpdater.js';

function createAttrNode(initialAttrs = {}, options = {}) {
    const attrs = new Map(Object.entries(initialAttrs).map(([k, v]) => [k, String(v)]));
    const shouldThrowOnSet = !!options.throwOnSetAttribute;
    return {
        style: {},
        textContent: '',
        setAttribute: vi.fn((name, value) => {
            if (shouldThrowOnSet) {
                throw new Error('setAttribute failed');
            }
            attrs.set(name, String(value));
        }),
        getAttribute: vi.fn((name) => attrs.get(name))
    };
}

function createValueDisplayCache() {
    return {
        valueGroup: createAttrNode(),
        currentDisplay: createAttrNode({ 'font-size': '13' }),
        voltageDisplay: createAttrNode({ 'font-size': '13' }),
        powerDisplay: createAttrNode({ 'font-size': '13' })
    };
}

describe('SVGRenderer runtime safety', () => {
    it('runs visual updater without requiring full shape creation path', () => {
        const g = {
            __valueDisplayElements: createValueDisplayCache(),
            querySelector: vi.fn(() => null),
            classList: { toggle: vi.fn() }
        };
        const comp = {
            type: 'Resistor',
            currentValue: 0.12,
            voltageValue: 1.2,
            powerValue: 0.14
        };
        const helpers = {
            getValueDisplayElements: (node) => node.__valueDisplayElements,
            setDisplayTextAndStyle: (element, text) => {
                if (element) {
                    element.textContent = text || '';
                }
                return true;
            },
            layoutValueDisplay: vi.fn(),
            formatValue: (value, unit) => `${Number(value || 0).toFixed(3)} ${unit}`,
            setElementAttributeIfChanged: vi.fn(() => true)
        };

        expect(() => {
            updateValueDisplayRuntime({
                g,
                comp,
                showCurrent: true,
                showVoltage: true,
                showPower: true,
                helpers
            });
        }).not.toThrow();
        expect(helpers.layoutValueDisplay).toHaveBeenCalledTimes(1);
    });

    it('setElementAttributeIfChanged does not throw when setAttribute fails', () => {
        const element = createAttrNode({ y: '10' }, { throwOnSetAttribute: true });

        expect(() => SVGRenderer.setElementAttributeIfChanged(element, 'y', '12')).not.toThrow();
        expect(SVGRenderer.setElementAttributeIfChanged(element, 'y', '12')).toBe(false);
    });

    it('updateValueDisplay tolerates classList.toggle failures for bulb visuals', () => {
        const glow = createAttrNode({ fill: 'rgba(255, 235, 59, 0)' });
        const g = {
            __valueDisplayElements: createValueDisplayCache(),
            querySelector: vi.fn((selector) => (selector === '.glow' ? glow : null)),
            classList: {
                toggle: vi.fn(() => {
                    throw new Error('classList.toggle failed');
                })
            }
        };

        expect(() => {
            SVGRenderer.updateValueDisplay(g, {
                type: 'Bulb',
                currentValue: 0.1,
                voltageValue: 1.5,
                powerValue: 0.8,
                ratedPower: 2
            }, true, true, true);
        }).not.toThrow();
    });

    it('updateParallelPlateCapacitorVisual tolerates setAttribute failures', () => {
        const leftConn = createAttrNode({}, { throwOnSetAttribute: true });
        const rightConn = createAttrNode();
        const leftPlate = createAttrNode();
        const rightPlate = createAttrNode();
        const label = { textContent: '' };
        const g = {
            querySelector: vi.fn((selector) => {
                if (selector === '.ppc-connector-left') return leftConn;
                if (selector === '.ppc-connector-right') return rightConn;
                if (selector === '.ppc-plate-left') return leftPlate;
                if (selector === '.ppc-plate-right') return rightPlate;
                if (selector === '.ppc-label') return label;
                return null;
            })
        };

        expect(() => {
            SVGRenderer.updateParallelPlateCapacitorVisual(g, {
                type: 'ParallelPlateCapacitor',
                plateDistance: 0.001,
                plateOffsetYPx: 3,
                explorationMode: true,
                capacitance: 2.5e-9,
                label: ''
            });
        }).not.toThrow();
    });
});
