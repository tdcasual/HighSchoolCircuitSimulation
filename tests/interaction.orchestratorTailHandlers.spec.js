import { describe, expect, it, vi } from 'vitest';
import { InteractionModeStore } from '../src/app/interaction/InteractionModeStore.js';
import {
    onContextMenu,
    onDoubleClick,
    onKeyDown
} from '../src/app/interaction/InteractionOrchestratorTailHandlers.js';

describe('InteractionOrchestratorTailHandlers.onContextMenu', () => {
    it('cancels wiring based on mode-store state when legacy runtime field is absent', () => {
        const preventDefault = vi.fn();
        const context = {
            interactionModeStore: {
                getState: vi.fn(() => ({
                    mode: 'wire',
                    context: {
                        wiringActive: true,
                        pendingTool: 'Wire'
                    }
                }))
            },
            touchActionController: { cancel: vi.fn() },
            resolveProbeMarkerTarget: vi.fn(() => null),
            cancelWiring: vi.fn(),
            endPrimaryInteractionForGesture: vi.fn(),
            hideContextMenu: vi.fn()
        };

        onContextMenu.call(context, { preventDefault, target: {} });

        expect(preventDefault).toHaveBeenCalledTimes(1);
        expect(context.cancelWiring).toHaveBeenCalledTimes(1);
    });

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
            interactionModeStore: new InteractionModeStore({
                mode: 'wire',
                context: {
                    pendingTool: 'Wire',
                    mobileMode: 'wire',
                    wireModeSticky: true,
                    wiringActive: false
                }
            }),
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
        const syncInteractionModeStore = vi.fn(() => ({
            mode: 'select',
            context: {
                pendingTool: null,
                mobileMode: 'select',
                wireModeSticky: false,
                wiringActive: false
            }
        }));
        const context = {
            pendingTool: 'Wire',
            mobileMode: 'wire',
            wireModeSticky: true,
            wiringActive: true,
            isDraggingWireEndpoint: false,
            isTerminalExtending: false,
            isRheostatDragging: false,
            cancelWiring: vi.fn(),
            clearPendingToolType: vi.fn(),
            clearSelection: vi.fn(),
            syncInteractionModeStore
        };

        onKeyDown.call(context, { key: 'Escape' });

        expect(context.cancelWiring).toHaveBeenCalledTimes(1);
        expect(context.clearPendingToolType).toHaveBeenCalledWith({ silent: true });
        expect(syncInteractionModeStore).toHaveBeenCalledWith({
            mode: 'select',
            source: 'onKeyDown:escape',
            context: {
                pendingTool: null,
                mobileMode: 'select',
                wireModeSticky: false,
                wiringActive: false
            }
        });
        expect(context.clearSelection).toHaveBeenCalledTimes(1);
    });
});
