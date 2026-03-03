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
});
