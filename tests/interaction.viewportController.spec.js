import { describe, expect, it, vi } from 'vitest';
import * as ViewportController from '../src/ui/interaction/ViewportController.js';

describe('ViewportController', () => {
    it('converts screen coordinates to canvas coordinates', () => {
        const context = {
            svg: {
                getBoundingClientRect: () => ({ left: 20, top: 30 })
            },
            viewOffset: { x: 100, y: 50 },
            scale: 2
        };

        const point = ViewportController.screenToCanvas.call(context, 220, 130);

        expect(point).toEqual({ x: 50, y: 25 });
    });

    it('applies transform to svg layers and updates zoom label', () => {
        const grid = { setAttribute: vi.fn(), parentElement: {} };
        const wires = { setAttribute: vi.fn() };
        const components = { setAttribute: vi.fn() };
        const ui = { setAttribute: vi.fn() };
        const guides = { setAttribute: vi.fn() };
        const zoomLevel = { textContent: '' };

        global.document = {
            getElementById: vi.fn((id) => (id === 'zoom-level' ? zoomLevel : null))
        };

        const context = {
            svg: {
                querySelector: vi.fn((selector) => {
                    if (selector === '#layer-grid') return grid;
                    if (selector === '#layer-wires') return wires;
                    if (selector === '#layer-components') return components;
                    if (selector === '#layer-ui') return ui;
                    if (selector === '#alignment-guides') return guides;
                    return null;
                })
            },
            viewOffset: { x: 12, y: 34 },
            scale: 1.5
        };

        ViewportController.updateViewTransform.call(context);

        const expected = 'translate(12, 34) scale(1.5)';
        expect(grid.setAttribute).toHaveBeenCalledWith('transform', expected);
        expect(wires.setAttribute).toHaveBeenCalledWith('transform', expected);
        expect(components.setAttribute).toHaveBeenCalledWith('transform', expected);
        expect(ui.setAttribute).toHaveBeenCalledWith('transform', expected);
        expect(guides.setAttribute).toHaveBeenCalledWith('transform', expected);
        expect(zoomLevel.textContent).toBe('150%');
    });

    it('resets scale and centers circuit bounds', () => {
        const context = {
            scale: 2.5,
            viewOffset: { x: 0, y: 0 },
            svg: {
                getBoundingClientRect: () => ({ width: 400, height: 300 })
            },
            getCircuitBounds: vi.fn(() => ({ minX: 20, minY: 40, maxX: 220, maxY: 140 })),
            updateViewTransform: vi.fn(),
            updateStatus: vi.fn()
        };

        ViewportController.resetView.call(context);

        expect(context.scale).toBe(1);
        expect(context.viewOffset).toEqual({ x: 80, y: 60 });
        expect(context.updateViewTransform).toHaveBeenCalledTimes(1);
        expect(context.updateStatus).toHaveBeenCalledWith('视图已重置');
    });
});
