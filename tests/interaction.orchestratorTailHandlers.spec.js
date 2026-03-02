import { describe, expect, it, vi } from 'vitest';
import {
    onContextMenu,
    onDoubleClick,
    onKeyDown
} from '../src/app/interaction/InteractionOrchestratorTailHandlers.js';

describe('InteractionOrchestratorTailHandlers.onContextMenu', () => {
    it('opens probe context menu when probe marker is resolved', () => {
        const preventDefault = vi.fn();
        const context = {
            touchActionController: { cancel: vi.fn() },
            resolveProbeMarkerTarget: vi.fn(() => ({
                dataset: { probeId: 'P1', wireId: 'W1' }
            })),
            selectWire: vi.fn(),
            showProbeContextMenu: vi.fn(),
            hideContextMenu: vi.fn()
        };

        onContextMenu.call(context, { preventDefault, target: {} });

        expect(preventDefault).toHaveBeenCalledTimes(1);
        expect(context.selectWire).toHaveBeenCalledWith('W1');
        expect(context.showProbeContextMenu).toHaveBeenCalledTimes(1);
        expect(context.hideContextMenu).not.toHaveBeenCalled();
    });
});

describe('InteractionOrchestratorTailHandlers.onDoubleClick', () => {
    it('keeps wire flow semantics and does not open property dialog in wire mode', () => {
        const context = {
            pendingToolType: 'Wire',
            mobileInteractionMode: 'wire',
            stickyWireTool: true,
            isWiring: false,
            isDraggingWireEndpoint: false,
            isTerminalExtending: false,
            isRheostatDragging: false,
            resolveProbeMarkerTarget: vi.fn(() => null),
            showPropertyDialog: vi.fn()
        };
        const target = { closest: vi.fn(() => ({ dataset: { id: 'R1' } })) };

        onDoubleClick.call(context, { target });

        expect(context.showPropertyDialog).not.toHaveBeenCalled();
    });
});

describe('InteractionOrchestratorTailHandlers.onKeyDown', () => {
    it('resets pending wire state on Escape', () => {
        const context = {
            pendingToolType: 'Wire',
            mobileInteractionMode: 'wire',
            stickyWireTool: true,
            isWiring: true,
            isDraggingWireEndpoint: false,
            isTerminalExtending: false,
            isRheostatDragging: false,
            cancelWiring: vi.fn(),
            clearPendingToolType: vi.fn(),
            clearSelection: vi.fn()
        };

        onKeyDown.call(context, { key: 'Escape' });

        expect(context.cancelWiring).toHaveBeenCalledTimes(1);
        expect(context.clearPendingToolType).toHaveBeenCalledWith({ silent: true });
        expect(context.pendingToolType).toBe(null);
        expect(context.mobileInteractionMode).toBe('select');
        expect(context.stickyWireTool).toBe(false);
        expect(context.isWiring).toBe(false);
        expect(context.clearSelection).toHaveBeenCalledTimes(1);
    });
});
