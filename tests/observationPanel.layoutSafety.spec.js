import { afterEach, describe, expect, it, vi } from 'vitest';
import { ObservationPanel } from '../src/ui/ObservationPanel.js';
import { ObservationUIModes } from '../src/ui/observation/ObservationPreferences.js';

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('ObservationPanel layout safety guards', () => {
    it('onLayoutModeChanged keeps API while delegating to layout controller when present', () => {
        const layoutController = {
            onLayoutModeChanged: vi.fn()
        };
        const ctx = {
            layoutController
        };

        expect(() => ObservationPanel.prototype.onLayoutModeChanged.call(ctx)).not.toThrow();
        expect(layoutController.onLayoutModeChanged).toHaveBeenCalledTimes(1);
    });

    it('isPhoneLayout does not throw when body classList contains is non-callable', () => {
        vi.stubGlobal('document', {
            body: {
                classList: {
                    contains: {}
                }
            }
        });
        const ctx = {
            app: {
                responsiveLayout: {
                    mode: 'phone'
                }
            }
        };

        expect(() => ObservationPanel.prototype.isPhoneLayout.call(ctx)).not.toThrow();
        expect(ObservationPanel.prototype.isPhoneLayout.call(ctx)).toBe(true);
    });

    it('applyMobileModeForPlotCard does not throw when classList toggle is non-callable', () => {
        const plot = {
            controlsOverride: 'collapsed',
            elements: {
                card: {
                    classList: {
                        toggle: {}
                    }
                },
                controls: {
                    classList: {
                        toggle: {}
                    }
                },
                collapseBtn: {
                    textContent: '',
                    setAttribute: vi.fn()
                }
            }
        };
        const ctx = {
            ui: { mode: ObservationUIModes.Basic },
            isPhoneLayout: () => true
        };

        expect(() => ObservationPanel.prototype.applyMobileModeForPlotCard.call(ctx, plot)).not.toThrow();
        expect(plot.elements.collapseBtn.textContent).toBe('展开设置');
    });

    it('constructor does not throw when window resize addEventListener is non-callable', () => {
        const initSpy = vi.spyOn(ObservationPanel.prototype, 'initializeUI').mockImplementation(() => {});
        const bindSpy = vi.spyOn(ObservationPanel.prototype, 'bindTabRefresh').mockImplementation(() => {});
        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => (id === 'observation-root' ? { id: 'observation-root' } : null))
        });
        vi.stubGlobal('window', {
            addEventListener: {}
        });

        expect(() => new ObservationPanel({
            circuit: {},
            scheduleSave: vi.fn()
        })).not.toThrow();
        expect(initSpy).toHaveBeenCalledTimes(1);
        expect(bindSpy).toHaveBeenCalledTimes(1);
    });

    it('bindTabRefresh does not throw when tab button addEventListener is non-callable', () => {
        vi.stubGlobal('document', {
            querySelector: vi.fn(() => ({
                addEventListener: {}
            }))
        });
        const ctx = {
            refreshComponentOptions: vi.fn(),
            refreshDialGauges: vi.fn(),
            updatePresetButtonHints: vi.fn(),
            requestRender: vi.fn()
        };

        expect(() => ObservationPanel.prototype.bindTabRefresh.call(ctx)).not.toThrow();
    });

    it('createRangeControls does not throw when range input addEventListener throws', () => {
        const createNode = (tagName = 'div') => ({
            tagName: String(tagName).toUpperCase(),
            className: '',
            id: '',
            style: {},
            children: [],
            value: '',
            checked: false,
            setAttribute(name, value) {
                if (name === 'id') this.id = String(value);
            },
            appendChild(child) {
                this.children.push(child);
                return child;
            },
            addEventListener: vi.fn()
        });

        vi.stubGlobal('document', {
            createElement: vi.fn((tagName) => {
                const node = createNode(tagName);
                if (String(tagName).toLowerCase() === 'input') {
                    node.addEventListener = vi.fn(() => {
                        throw new TypeError('broken add');
                    });
                }
                return node;
            }),
            createTextNode: vi.fn((text) => ({
                nodeType: 3,
                textContent: String(text ?? '')
            }))
        });

        const ctx = {
            requestRender: vi.fn(),
            schedulePersist: vi.fn()
        };
        const plot = {
            id: 'plot_1',
            buffer: { length: 0 },
            x: { autoRange: true, min: null, max: null },
            y: { autoRange: true, min: null, max: null }
        };

        expect(() => ObservationPanel.prototype.createRangeControls.call(ctx, plot, 'x', 'X 轴范围')).not.toThrow();
    });

    it('bindPlotCanvasInteraction does not throw when canvas addEventListener throws', () => {
        const plot = {
            elements: {
                canvas: {
                    addEventListener: vi.fn(() => {
                        throw new TypeError('broken add');
                    }),
                    getBoundingClientRect: vi.fn(() => ({
                        left: 0,
                        top: 0
                    }))
                }
            },
            chartInteraction: {
                onPointerDown: vi.fn(),
                onPointerMove: vi.fn(),
                onPointerUp: vi.fn(),
                onPointerLeave: vi.fn()
            }
        };
        const ctx = {
            syncLinkedCursorSnapshot: vi.fn(),
            requestRender: vi.fn()
        };

        expect(() => ObservationPanel.prototype.bindPlotCanvasInteraction.call(ctx, plot)).not.toThrow();
    });

    it('initializeUI does not throw when control addEventListener throws', () => {
        const createNode = (tagName = 'div') => {
            const node = {
                tagName: String(tagName).toUpperCase(),
                className: '',
                id: '',
                style: {},
                children: [],
                value: '',
                checked: false,
                hidden: false,
                textContent: '',
                setAttribute(name, value) {
                    if (name === 'id') this.id = String(value);
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
                addEventListener: vi.fn(() => {
                    throw new TypeError('broken add');
                }),
                querySelector: vi.fn(() => null)
            };
            Object.defineProperty(node, 'firstChild', {
                get() {
                    return this.children.length > 0 ? this.children[0] : null;
                }
            });
            return node;
        };

        vi.stubGlobal('document', {
            createElement: vi.fn((tagName) => createNode(tagName)),
            createTextNode: vi.fn((text) => ({
                nodeType: 3,
                textContent: String(text ?? '')
            }))
        });

        const ctx = {
            root: createNode('div'),
            sampleIntervalMs: 50,
            ui: { mode: 'basic' },
            modeButtons: {},
            presetButtons: {},
            templateControls: {},
            setUIMode: vi.fn(),
            updateModeToggleUI: vi.fn(),
            applyQuickPreset: vi.fn(),
            updatePresetButtonHints: vi.fn(),
            saveCurrentAsTemplate: vi.fn(),
            applySelectedTemplate: vi.fn(),
            deleteSelectedTemplate: vi.fn(),
            refreshTemplateControls: vi.fn(),
            schedulePersist: vi.fn(),
            addPlot: vi.fn(),
            refreshDialGauges: vi.fn(),
            clearAllPlots: vi.fn(),
            exportObservationSnapshot: vi.fn(),
            deleteAllPlots: vi.fn()
        };

        expect(() => ObservationPanel.prototype.initializeUI.call(ctx)).not.toThrow();
    });

    it('refreshDialGauges does not throw when close button addEventListener throws', () => {
        const createNode = (tagName = 'div') => {
            const node = {
                tagName: String(tagName).toUpperCase(),
                className: '',
                id: '',
                style: {},
                children: [],
                textContent: '',
                setAttribute(name, value) {
                    if (name === 'id') this.id = String(value);
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
                addEventListener: vi.fn(),
                querySelector: vi.fn(() => null)
            };
            Object.defineProperty(node, 'firstChild', {
                get() {
                    return this.children.length > 0 ? this.children[0] : null;
                }
            });
            return node;
        };

        let buttonCreateCount = 0;
        vi.stubGlobal('document', {
            createElement: vi.fn((tagName) => {
                const node = createNode(tagName);
                if (String(tagName).toLowerCase() === 'button') {
                    buttonCreateCount += 1;
                    if (buttonCreateCount === 1) {
                        node.addEventListener = vi.fn(() => {
                            throw new TypeError('broken add');
                        });
                    }
                }
                return node;
            }),
            createTextNode: vi.fn((text) => ({
                nodeType: 3,
                textContent: String(text ?? '')
            }))
        });

        const ctx = {
            circuit: {
                components: new Map([
                    ['A1', { id: 'A1', type: 'Ammeter', selfReading: true }]
                ])
            },
            gaugeListEl: createNode('div'),
            gaugeHintEl: { style: {} },
            gauges: new Map(),
            requestRender: vi.fn(),
            app: {
                updateStatus: vi.fn()
            },
            schedulePersist: vi.fn()
        };

        expect(() => ObservationPanel.prototype.refreshDialGauges.call(ctx)).not.toThrow();
    });

    it('resizeCanvasToDisplaySize does not throw when getBoundingClientRect throws', () => {
        vi.stubGlobal('window', {
            devicePixelRatio: 2
        });
        const canvas = {
            width: 0,
            height: 0,
            getBoundingClientRect: vi.fn(() => {
                throw new TypeError('broken rect');
            })
        };

        expect(() => ObservationPanel.prototype.resizeCanvasToDisplaySize.call({}, canvas)).not.toThrow();
        expect(canvas.width).toBeGreaterThanOrEqual(1);
        expect(canvas.height).toBeGreaterThanOrEqual(1);
    });
});
