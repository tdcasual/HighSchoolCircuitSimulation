import { afterEach, describe, expect, it, vi } from 'vitest';
import * as MeasurementReadoutController from '../src/ui/interaction/MeasurementReadoutController.js';
import { SVGRenderer } from '../src/components/Component.js';

function createFakeElement(tagName = 'div') {
    const listeners = new Map();
    return {
        tagName,
        id: '',
        className: '',
        textContent: '',
        value: '',
        style: {},
        attributes: {},
        children: [],
        classList: {
            toggle: vi.fn(),
            add: vi.fn(),
            remove: vi.fn(),
            contains: vi.fn(() => false)
        },
        appendChild(child) {
            this.children.push(child);
            return child;
        },
        removeChild(child) {
            const idx = this.children.indexOf(child);
            if (idx >= 0) this.children.splice(idx, 1);
            return child;
        },
        get firstChild() {
            return this.children.length > 0 ? this.children[0] : null;
        },
        setAttribute: vi.fn(function setAttribute(name, value) {
            this.attributes[name] = String(value);
        }),
        addEventListener: vi.fn((eventName, handler) => {
            listeners.set(eventName, handler);
        }),
        trigger(eventName, event = {}) {
            const handler = listeners.get(eventName);
            if (handler) handler(event);
        }
    };
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('MeasurementReadoutController.createMeterSelfReadingControl', () => {
    it('toggles self reading and opens observation tab', () => {
        vi.stubGlobal('document', {
            createElement: vi.fn((tag) => createFakeElement(tag)),
            createTextNode: vi.fn((text) => ({ textContent: text }))
        });

        const refreshDialGauges = vi.fn();
        const refreshComponentOptions = vi.fn();
        const requestRender = vi.fn();
        const updateStatus = vi.fn();
        const activateSidePanelTab = vi.fn();

        const comp = { type: 'Ammeter', selfReading: false };
        const ctx = {
            runWithHistory: vi.fn((_, action) => action()),
            activateSidePanelTab,
            app: {
                updateStatus,
                observationPanel: {
                    refreshDialGauges,
                    refreshComponentOptions,
                    requestRender
                }
            }
        };

        const group = MeasurementReadoutController.createMeterSelfReadingControl.call(ctx, comp);
        const row = group.children[1];
        const toggleButton = row.children[0];
        const openObservationButton = row.children[1];

        toggleButton.trigger('click');
        openObservationButton.trigger('click');

        expect(comp.selfReading).toBe(true);
        expect(ctx.runWithHistory).toHaveBeenCalledWith('切换自主读数', expect.any(Function));
        expect(refreshDialGauges).toHaveBeenCalled();
        expect(updateStatus).toHaveBeenCalledWith(expect.stringContaining('已开启自主读数'));
        expect(activateSidePanelTab).toHaveBeenCalledWith('observation');
        expect(refreshComponentOptions).toHaveBeenCalled();
        expect(requestRender).toHaveBeenCalledWith({ onlyIfActive: false });
    });
});

describe('MeasurementReadoutController.updateSelectedComponentReadouts', () => {
    it('updates common readouts and meter reading', () => {
        const currentEl = { textContent: '' };
        const voltageEl = { textContent: '' };
        const powerEl = { textContent: '' };
        const ammeterEl = { textContent: '' };
        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => ({
                'measure-current': currentEl,
                'measure-voltage': voltageEl,
                'measure-power': powerEl
            }[id] || null)),
            querySelector: vi.fn((selector) => (selector === '.ammeter-reading' ? ammeterEl : null))
        });

        const ctx = {
            updateRheostatPanelValues: vi.fn(),
            updateParallelPlateCapacitorPanelValues: vi.fn()
        };
        const comp = {
            type: 'Ammeter',
            currentValue: -0.12345,
            voltageValue: 5.4321,
            powerValue: 0.67001
        };

        MeasurementReadoutController.updateSelectedComponentReadouts.call(ctx, comp);

        expect(currentEl.textContent).toBe('-0.1235 A');
        expect(voltageEl.textContent).toBe('5.4321 V');
        expect(powerEl.textContent).toBe('0.6700 W');
        expect(ammeterEl.textContent).toBe('0.123 A');
        expect(ctx.updateRheostatPanelValues).not.toHaveBeenCalled();
        expect(ctx.updateParallelPlateCapacitorPanelValues).not.toHaveBeenCalled();
    });
});

describe('MeasurementReadoutController.updateRheostatPanelValues', () => {
    it('recomputes active resistance and refreshes panel readout', () => {
        const currentREl = createFakeElement('span');
        currentREl.appendChild({ textContent: 'old' });
        const positionEl = { textContent: '' };
        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => ({
                'rheostat-current-r': currentREl,
                'rheostat-position': positionEl
            }[id] || null)),
            createElement: vi.fn((tag) => createFakeElement(tag)),
            createTextNode: vi.fn((text) => ({ textContent: text }))
        });

        const ctx = {
            circuit: {
                calculateRheostatActiveResistance: vi.fn()
            }
        };
        const comp = {
            type: 'Rheostat',
            position: 0.25,
            activeResistance: 12.34,
            resistanceDirection: 'slider-right-increase'
        };

        MeasurementReadoutController.updateRheostatPanelValues.call(ctx, comp);

        expect(ctx.circuit.calculateRheostatActiveResistance).toHaveBeenCalledWith(comp);
        expect(positionEl.textContent).toBe('25%');
        expect(currentREl.children.length).toBe(2);
        expect(currentREl.children[0].textContent).toContain('12.3');
    });
});

describe('MeasurementReadoutController.recomputeParallelPlateCapacitance', () => {
    it('updates capacitance and visual/panel hooks', () => {
        const visualSpy = vi.spyOn(SVGRenderer, 'updateParallelPlateCapacitorVisual').mockImplementation(() => {});
        const refreshComponent = vi.fn();
        const updateParallelPlateCapacitorPanelValues = vi.fn();

        const comp = {
            id: 'C1',
            type: 'ParallelPlateCapacitor',
            plateOffsetYPx: 3,
            plateArea: 0.02,
            plateDistance: 0.002,
            dielectricConstant: 2
        };

        const ctx = {
            renderer: {
                componentElements: new Map([['C1', { id: 'g-C1' }]]),
                refreshComponent
            },
            updateParallelPlateCapacitorPanelValues
        };

        MeasurementReadoutController.recomputeParallelPlateCapacitance.call(ctx, comp, {
            updateVisual: true,
            updatePanel: true
        });

        expect(comp.capacitance).toBeGreaterThan(0);
        expect(visualSpy).toHaveBeenCalledWith({ id: 'g-C1' }, comp);
        expect(refreshComponent).not.toHaveBeenCalled();
        expect(updateParallelPlateCapacitorPanelValues).toHaveBeenCalledWith(comp);
    });

    it('falls back to renderer.refreshComponent when component element is absent', () => {
        const visualSpy = vi.spyOn(SVGRenderer, 'updateParallelPlateCapacitorVisual').mockImplementation(() => {});
        const refreshComponent = vi.fn();

        const comp = {
            id: 'C2',
            type: 'ParallelPlateCapacitor',
            plateOffsetYPx: 0,
            plateArea: 0.01,
            plateDistance: 0.001,
            dielectricConstant: 1
        };

        const ctx = {
            renderer: {
                componentElements: new Map(),
                refreshComponent
            }
        };

        MeasurementReadoutController.recomputeParallelPlateCapacitance.call(ctx, comp, { updateVisual: true });

        expect(visualSpy).not.toHaveBeenCalled();
        expect(refreshComponent).toHaveBeenCalledWith(comp);
    });
});

describe('MeasurementReadoutController.updateParallelPlateCapacitorPanelValues', () => {
    it('writes formatted readout text and syncs distance input', () => {
        const nodes = {
            'ppc-readout-capacitance': { textContent: '' },
            'ppc-readout-distance': { textContent: '' },
            'ppc-readout-overlap': { textContent: '' },
            'ppc-readout-area': { textContent: '' },
            'ppc-readout-field': { textContent: '' },
            'ppc-readout-charge': { textContent: '' },
            'ppc-input-distance': { value: '' }
        };

        const doc = {
            activeElement: null,
            getElementById: vi.fn((id) => nodes[id] || null)
        };
        vi.stubGlobal('document', doc);

        const comp = {
            type: 'ParallelPlateCapacitor',
            plateOffsetYPx: 6,
            plateDistance: 0.002,
            plateArea: 0.01,
            dielectricConstant: 1,
            capacitance: 8.854e-11,
            voltageValue: -12,
            prevVoltage: -12,
            prevCharge: 1.2e-9
        };

        MeasurementReadoutController.updateParallelPlateCapacitorPanelValues(comp);

        expect(nodes['ppc-readout-capacitance'].textContent).toContain('pF');
        expect(nodes['ppc-readout-distance'].textContent).toBe('2.000 mm');
        expect(nodes['ppc-readout-overlap'].textContent).toContain('%');
        expect(nodes['ppc-readout-area'].textContent).toContain('cm²');
        expect(nodes['ppc-readout-field'].textContent).toContain('kV/m');
        expect(nodes['ppc-readout-charge'].textContent).toContain('nC');
        expect(nodes['ppc-input-distance'].value).toBe('2.000');
    });
});
