import { describe, expect, it, vi } from 'vitest';
import { ChartWindowController } from '../src/ui/charts/ChartWindowController.js';
import { TIME_SOURCE_ID } from '../src/ui/observation/ObservationSources.js';

function createCanvasAndContext() {
    const ctx = {
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        fillText: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        lineWidth: 1,
        strokeStyle: '#000',
        fillStyle: '#000',
        font: '12px sans-serif',
        lineJoin: 'round',
        lineCap: 'round',
        textAlign: 'left',
        textBaseline: 'alphabetic'
    };

    const canvas = {
        width: 300,
        height: 180,
        clientWidth: 300,
        clientHeight: 180,
        getBoundingClientRect: () => ({ width: 300, height: 180 }),
        getContext: vi.fn(() => ctx)
    };

    return { canvas, ctx };
}

describe('ChartWindowController.render', () => {
    it('renders axis meaning labels for X and Y', () => {
        const { canvas, ctx } = createCanvasAndContext();
        const buffer = {
            length: 2,
            forEachSampled: (_step, iteratee) => {
                iteratee(0, 0);
                iteratee(1, 1);
            },
            getPoint: (index) => (index >= 1 ? { x: 1, y: 1 } : { x: 0, y: 0 }),
            clear: vi.fn()
        };
        const frame = {
            padL: 48,
            padR: 12,
            padT: 12,
            padB: 30,
            innerW: 240,
            innerH: 120,
            xTicks: [0, 0.5, 1],
            yTicks: [0, 0.5, 1],
            xToPx: (x) => 48 + x * 240,
            yToPx: (y) => 12 + (1 - y) * 120,
            nextAutoRangeWindow: { x: { min: 0, max: 1 }, y: { min: 0, max: 1 } }
        };
        const workspace = {
            circuit: {
                components: new Map([
                    ['R1', { id: 'R1', type: 'Resistor', label: '电阻1' }]
                ])
            },
            projectionService: {
                computeFrame: vi.fn(() => frame)
            },
            getChartSeriesBuffers: vi.fn(() => new Map([['s1', buffer]])),
            resolveSourceId: (sourceId) => sourceId || TIME_SOURCE_ID
        };
        const state = {
            id: 'chart_1',
            axis: {
                xBinding: {
                    sourceId: TIME_SOURCE_ID,
                    quantityId: 't',
                    transformId: 'identity'
                }
            },
            series: [
                {
                    id: 's1',
                    name: '系列 1',
                    sourceId: 'R1',
                    quantityId: 'I',
                    transformId: 'identity',
                    color: '#1d4ed8',
                    visible: true
                }
            ]
        };

        const controller = new ChartWindowController(workspace, state);
        controller.elements.canvas = canvas;
        controller.elements.latest = { textContent: '' };
        controller._needsRedraw = true;

        controller.render();

        const textCalls = ctx.fillText.mock.calls.map((call) => String(call[0]));
        expect(textCalls.some((text) => text.startsWith('X:') && text.includes('时间'))).toBe(true);
        expect(textCalls.some((text) => text.startsWith('Y:') && text.includes('电流'))).toBe(true);
    });

    it('resets latest readout when frame becomes unavailable', () => {
        const { canvas } = createCanvasAndContext();
        const buffer = {
            length: 2,
            forEachSampled: (_step, iteratee) => {
                iteratee(0, 0);
                iteratee(1, 1);
            },
            getPoint: (index) => (index >= 1 ? { x: 1, y: 1 } : { x: 0, y: 0 }),
            clear: vi.fn()
        };
        const frame = {
            padL: 48,
            padR: 12,
            padT: 12,
            padB: 30,
            innerW: 240,
            innerH: 120,
            xTicks: [0, 0.5, 1],
            yTicks: [0, 0.5, 1],
            xToPx: (x) => 48 + x * 240,
            yToPx: (y) => 12 + (1 - y) * 120,
            nextAutoRangeWindow: { x: { min: 0, max: 1 }, y: { min: 0, max: 1 } }
        };
        const workspace = {
            circuit: {
                components: new Map([
                    ['R1', { id: 'R1', type: 'Resistor', label: '电阻1' }]
                ])
            },
            projectionService: {
                computeFrame: vi.fn(({ chart }) => (chart.series?.length ? frame : null))
            },
            getChartSeriesBuffers: vi.fn(() => new Map([['s1', buffer]])),
            resolveSourceId: (sourceId) => sourceId || TIME_SOURCE_ID
        };
        const state = {
            id: 'chart_1',
            axis: {
                xBinding: {
                    sourceId: TIME_SOURCE_ID,
                    quantityId: 't',
                    transformId: 'identity'
                }
            },
            series: [
                {
                    id: 's1',
                    name: '系列 1',
                    sourceId: 'R1',
                    quantityId: 'I',
                    transformId: 'identity',
                    color: '#1d4ed8',
                    visible: true
                }
            ]
        };

        const controller = new ChartWindowController(workspace, state);
        controller.elements.canvas = canvas;
        controller.elements.latest = { textContent: '' };
        controller._needsRedraw = true;

        controller.render();
        expect(controller.elements.latest.textContent).toContain('读数(系列 1)');

        controller.state = {
            ...controller.state,
            series: []
        };
        controller.markDirty();
        controller.render();

        expect(controller.elements.latest.textContent).toBe('读数: —');
    });

    it('resolves binding meaning for numeric zero source ids', () => {
        const workspace = {
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
            }
        };
        const state = {
            id: 'chart_1',
            axis: {
                xBinding: {
                    sourceId: TIME_SOURCE_ID,
                    quantityId: 't',
                    transformId: 'identity'
                }
            },
            series: []
        };

        const controller = new ChartWindowController(workspace, state);
        const meaning = controller.resolveBindingMeaning({
            sourceId: 0,
            quantityId: 'I'
        });

        expect(meaning).toContain('0');
        expect(meaning).toContain('电流');
    });
});

describe('ChartWindowController delegation seams', () => {
    it('delegates pointer lifecycle methods to injected pointer controller', () => {
        const pointerController = {
            onHeaderPointerDown: vi.fn(),
            onHeaderDoubleClick: vi.fn(),
            onResizeHandlePointerDown: vi.fn(),
            onPointerMove: vi.fn(),
            onPointerUp: vi.fn(),
            attachGlobalPointerListeners: vi.fn(),
            cancelPointerSessions: vi.fn(),
            detachDragListeners: vi.fn()
        };
        const bindingController = {
            applyLegendState: vi.fn(),
            onAxisSourceChange: vi.fn(),
            onAxisQuantityChange: vi.fn(),
            refreshSourceOptions: vi.fn(),
            rebuildSeriesControls: vi.fn(),
            resolveBindingMeaning: vi.fn(() => 'binding'),
            resolveAxisMeaningLabels: vi.fn(() => ({ xLabel: 'x', yLabel: 'y' }))
        };
        const canvasView = {
            clearData: vi.fn(),
            markDirty: vi.fn(),
            resizeCanvasToDisplaySize: vi.fn(),
            render: vi.fn()
        };
        const controller = new ChartWindowController({ clampRect: (frame) => frame }, {
            id: 'chart_1',
            frame: { x: 0, y: 0, width: 320, height: 240 },
            series: [],
            axis: {}
        }, {
            pointerController,
            bindingController,
            canvasView
        });
        const event = { pointerId: 1 };

        controller.onHeaderPointerDown(event);
        controller.onHeaderDoubleClick(event);
        controller.onResizeHandlePointerDown(event, 'se');
        controller.onPointerMove(event);
        controller.onPointerUp(event);
        controller.attachGlobalPointerListeners();
        controller.cancelPointerSessions();
        controller.detachDragListeners();

        expect(pointerController.onHeaderPointerDown).toHaveBeenCalledWith(event);
        expect(pointerController.onHeaderDoubleClick).toHaveBeenCalledWith(event);
        expect(pointerController.onResizeHandlePointerDown).toHaveBeenCalledWith(event, 'se');
        expect(pointerController.onPointerMove).toHaveBeenCalledWith(event);
        expect(pointerController.onPointerUp).toHaveBeenCalledWith(event);
        expect(pointerController.attachGlobalPointerListeners).toHaveBeenCalledTimes(1);
        expect(pointerController.cancelPointerSessions).toHaveBeenCalledTimes(1);
        expect(pointerController.detachDragListeners).toHaveBeenCalledTimes(1);
    });

    it('delegates binding methods to injected binding controller', () => {
        const bindingController = {
            applyLegendState: vi.fn(),
            onAxisSourceChange: vi.fn(),
            onAxisQuantityChange: vi.fn(),
            refreshSourceOptions: vi.fn(),
            rebuildSeriesControls: vi.fn(),
            resolveBindingMeaning: vi.fn(() => 'binding'),
            resolveAxisMeaningLabels: vi.fn(() => ({ xLabel: 'time', yLabel: 'current' }))
        };
        const controller = new ChartWindowController({ clampRect: (frame) => frame }, {
            id: 'chart_1',
            frame: { x: 0, y: 0, width: 320, height: 240 },
            series: [],
            axis: {}
        }, {
            pointerController: {},
            bindingController,
            canvasView: {}
        });

        controller.applyLegendState();
        controller.onAxisSourceChange();
        controller.onAxisQuantityChange();
        controller.refreshSourceOptions();
        controller.rebuildSeriesControls();
        expect(controller.resolveBindingMeaning({ sourceId: TIME_SOURCE_ID, quantityId: 't' })).toBe('binding');
        expect(controller.resolveAxisMeaningLabels()).toEqual({ xLabel: 'time', yLabel: 'current' });

        expect(bindingController.applyLegendState).toHaveBeenCalledTimes(1);
        expect(bindingController.onAxisSourceChange).toHaveBeenCalledTimes(1);
        expect(bindingController.onAxisQuantityChange).toHaveBeenCalledTimes(1);
        expect(bindingController.refreshSourceOptions).toHaveBeenCalledTimes(1);
        expect(bindingController.rebuildSeriesControls).toHaveBeenCalledTimes(1);
        expect(bindingController.resolveBindingMeaning).toHaveBeenCalledTimes(1);
        expect(bindingController.resolveAxisMeaningLabels).toHaveBeenCalledTimes(1);
    });

    it('delegates canvas methods to injected canvas view', () => {
        const canvasView = {
            clearData: vi.fn(),
            markDirty: vi.fn(),
            resizeCanvasToDisplaySize: vi.fn(),
            render: vi.fn()
        };
        const controller = new ChartWindowController({ clampRect: (frame) => frame }, {
            id: 'chart_1',
            frame: { x: 0, y: 0, width: 320, height: 240 },
            series: [],
            axis: {}
        }, {
            pointerController: {},
            bindingController: {},
            canvasView
        });

        controller.clearData();
        controller.markDirty();
        controller.resizeCanvasToDisplaySize();
        controller.render();

        expect(canvasView.clearData).toHaveBeenCalledTimes(1);
        expect(canvasView.markDirty).toHaveBeenCalledTimes(1);
        expect(canvasView.resizeCanvasToDisplaySize).toHaveBeenCalledTimes(1);
        expect(canvasView.render).toHaveBeenCalledTimes(1);
    });
});
