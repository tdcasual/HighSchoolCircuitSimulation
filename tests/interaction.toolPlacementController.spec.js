import { afterEach, describe, expect, it, vi } from 'vitest';
import * as ToolPlacementController from '../src/ui/interaction/ToolPlacementController.js';

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('ToolPlacementController.setPendingToolType', () => {
    it('sets pending tool and marks selected item', () => {
        const previous = { classList: { remove: vi.fn() } };
        vi.stubGlobal('document', {
            querySelectorAll: vi.fn(() => [previous])
        });

        const item = { classList: { add: vi.fn() } };
        const context = {
            pendingToolType: null,
            pendingToolItem: null,
            isWiring: false,
            clearPendingToolType: vi.fn(),
            cancelWiring: vi.fn(),
            updateStatus: vi.fn()
        };

        ToolPlacementController.setPendingToolType.call(context, 'Resistor', item);

        expect(context.pendingToolType).toBe('Resistor');
        expect(context.pendingToolItem).toBe(item);
        expect(previous.classList.remove).toHaveBeenCalledWith('tool-item-pending');
        expect(item.classList.add).toHaveBeenCalledWith('tool-item-pending');
        expect(context.updateStatus).toHaveBeenCalledWith(expect.stringContaining('已选择'));
    });

    it('toggles off same tool and cancels wiring for wire tool', () => {
        vi.stubGlobal('document', {
            querySelectorAll: vi.fn(() => [])
        });

        const context = {
            pendingToolType: 'Wire',
            pendingToolItem: null,
            isWiring: true,
            clearPendingToolType: vi.fn(),
            cancelWiring: vi.fn(),
            updateStatus: vi.fn()
        };

        ToolPlacementController.setPendingToolType.call(context, 'Wire', null);

        expect(context.cancelWiring).toHaveBeenCalledTimes(1);
        expect(context.clearPendingToolType).toHaveBeenCalledTimes(1);
        expect(context.updateStatus).toHaveBeenCalledWith('已取消工具放置模式');
    });

    it('auto closes overlay drawers after selecting a pending tool on mobile layout', () => {
        vi.stubGlobal('document', {
            querySelectorAll: vi.fn(() => [])
        });

        const closeDrawers = vi.fn();
        const context = {
            pendingToolType: null,
            pendingToolItem: null,
            isWiring: false,
            clearPendingToolType: vi.fn(),
            cancelWiring: vi.fn(),
            updateStatus: vi.fn(),
            app: {
                responsiveLayout: {
                    isOverlayMode: vi.fn(() => true),
                    toolboxOpen: true,
                    sidePanelOpen: false,
                    closeDrawers
                }
            }
        };

        ToolPlacementController.setPendingToolType.call(context, 'Resistor', null);

        expect(closeDrawers).toHaveBeenCalledTimes(1);
        expect(context.updateStatus).toHaveBeenCalledWith(expect.stringContaining('已选择'));
    });
});

describe('ToolPlacementController.clearPendingToolType', () => {
    it('clears pending state and removes pending class on item', () => {
        const remove = vi.fn();
        vi.stubGlobal('document', {
            querySelectorAll: vi.fn(() => [])
        });

        const context = {
            pendingToolType: 'Resistor',
            pendingToolItem: { classList: { remove } }
        };

        ToolPlacementController.clearPendingToolType.call(context);

        expect(context.pendingToolType).toBe(null);
        expect(context.pendingToolItem).toBe(null);
        expect(remove).toHaveBeenCalledWith('tool-item-pending');
    });
});

describe('ToolPlacementController.placePendingToolAt', () => {
    it('places component and clears pending tool', () => {
        const context = {
            pendingToolType: 'Resistor',
            screenToCanvas: vi.fn(() => ({ x: 10.2, y: 19.8 })),
            addWireAt: vi.fn(),
            addComponent: vi.fn(),
            clearPendingToolType: vi.fn()
        };

        const placed = ToolPlacementController.placePendingToolAt.call(context, 100, 120);

        expect(placed).toBe(true);
        expect(context.addComponent).toHaveBeenCalledWith('Resistor', 20, 20);
        expect(context.addWireAt).not.toHaveBeenCalled();
        expect(context.clearPendingToolType).toHaveBeenCalledWith({ silent: true });
    });

    it('places wire when pending type is wire', () => {
        const context = {
            pendingToolType: 'Wire',
            screenToCanvas: vi.fn(() => ({ x: 18.6, y: 21.4 })),
            addWireAt: vi.fn(),
            addComponent: vi.fn(),
            clearPendingToolType: vi.fn()
        };

        const placed = ToolPlacementController.placePendingToolAt.call(context, 100, 120);

        expect(placed).toBe(true);
        expect(context.addWireAt).toHaveBeenCalledWith(20, 20);
        expect(context.addComponent).not.toHaveBeenCalled();
        expect(context.clearPendingToolType).toHaveBeenCalledWith({ silent: true });
    });
});
