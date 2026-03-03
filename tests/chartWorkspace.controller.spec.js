import { describe, expect, it, vi } from 'vitest';
import { ChartWorkspaceController } from '../src/ui/charts/ChartWorkspaceController.js';
import { TIME_SOURCE_ID } from '../src/ui/observation/ObservationSources.js';

describe('ChartWorkspaceController', () => {
    it('resolves phone default frame centered and above mobile controls reserve', () => {
        const controller = Object.create(ChartWorkspaceController.prototype);
        controller.layoutMode = 'phone';
        controller.windowLayer = {
            getBoundingClientRect: () => ({
                width: 390,
                height: 754
            })
        };
        controller.getPhoneBottomAvoidancePx = vi.fn(() => 120);

        const frame = ChartWorkspaceController.prototype.resolveDefaultFrame.call(controller, 1, {});
        const expectedCenterX = Math.round((390 - frame.width) / 2);
        const bottom = frame.y + frame.height;

        expect(Math.abs(frame.x - expectedCenterX)).toBeLessThanOrEqual(1);
        expect(bottom).toBeLessThanOrEqual(754 - 120);
    });

    it('injects legend-collapsed default when adding chart in phone mode', () => {
        const controller = Object.create(ChartWorkspaceController.prototype);
        controller.layoutMode = 'phone';
        controller.commandService = {
            addChart: vi.fn(() => 'chart_1')
        };
        controller.windowControllers = new Map([
            ['chart_1', { state: { id: 'chart_1' } }]
        ]);

        const chart = ChartWorkspaceController.prototype.addChart.call(controller, {});

        expect(controller.commandService.addChart).toHaveBeenCalledWith(expect.objectContaining({
            ui: expect.objectContaining({
                legendCollapsed: true
            })
        }));
        expect(chart).toEqual({ state: { id: 'chart_1' } });
    });

    it('resolves numeric zero source ids to existing component id strings', () => {
        const controller = Object.create(ChartWorkspaceController.prototype);
        controller.circuit = {
            components: new Map([
                ['0', { id: '0', type: 'Resistor' }]
            ]),
            getObservationProbe: vi.fn(() => null)
        };

        expect(ChartWorkspaceController.prototype.resolveSourceId.call(controller, 0)).toBe('0');
        expect(ChartWorkspaceController.prototype.resolveSourceId.call(controller, null)).toBe(TIME_SOURCE_ID);
    });
});
