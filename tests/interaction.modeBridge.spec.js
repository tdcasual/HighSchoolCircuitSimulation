import { describe, expect, it, vi } from 'vitest';
import {
    readInteractionModeContext,
    readInteractionModeState,
    setInteractionModeContext,
    setWireToolContext,
    setWiringActive
} from '../src/app/interaction/InteractionModeBridge.js';

describe('InteractionModeBridge', () => {
    it('reads normalized runtime context when store state is unavailable', () => {
        const context = {
            pendingToolType: 'Wire',
            mobileInteractionMode: 'unknown-mode',
            stickyWireTool: 1,
            isWiring: 'yes',
            isDraggingWireEndpoint: 0,
            isTerminalExtending: '1',
            isRheostatDragging: null
        };

        const modeContext = readInteractionModeContext(context);
        expect(modeContext).toEqual({
            pendingToolType: 'Wire',
            mobileInteractionMode: 'select',
            stickyWireTool: true,
            isWiring: true,
            isDraggingWireEndpoint: false,
            isTerminalExtending: true,
            isRheostatDragging: false
        });
    });

    it('writes normalized context to runtime flags and mode store in one call', () => {
        const syncInteractionModeStore = vi.fn(() => ({ mode: 'wire', context: {}, version: 1 }));
        const context = {
            pendingToolType: 'Wire',
            mobileInteractionMode: 'select',
            stickyWireTool: false,
            isWiring: false,
            isDraggingWireEndpoint: false,
            syncInteractionModeStore
        };

        setInteractionModeContext(context, {
            pendingToolType: '',
            mobileInteractionMode: 'wire',
            stickyWireTool: 1,
            isWiring: 1,
            isDraggingWireEndpoint: 1
        }, {
            mode: 'wire',
            source: 'mode-bridge-spec'
        });

        expect(context.pendingToolType).toBe(null);
        expect(context.mobileInteractionMode).toBe('wire');
        expect(context.stickyWireTool).toBe(true);
        expect(context.isWiring).toBe(true);
        expect(context.isDraggingWireEndpoint).toBe(true);
        expect(syncInteractionModeStore).toHaveBeenCalledWith({
            mode: 'wire',
            source: 'mode-bridge-spec',
            context: {
                pendingToolType: null,
                mobileInteractionMode: 'wire',
                stickyWireTool: true,
                isWiring: true,
                isDraggingWireEndpoint: true
            }
        });
    });

    it('supports wire-context and wiring-active convenience helpers', () => {
        const syncInteractionModeStore = vi.fn(() => ({ mode: 'wire', context: {}, version: 1 }));
        const context = {
            pendingToolType: null,
            mobileInteractionMode: 'select',
            stickyWireTool: false,
            isWiring: false,
            syncInteractionModeStore
        };

        setWireToolContext(context, {
            pendingToolType: 'Wire',
            mobileInteractionMode: 'wire',
            stickyWireTool: true
        }, {
            mode: 'wire',
            source: 'wire-context-spec'
        });
        setWiringActive(context, true, { mode: 'wire', source: 'set-wiring-active-spec' });

        expect(context.pendingToolType).toBe('Wire');
        expect(context.mobileInteractionMode).toBe('wire');
        expect(context.stickyWireTool).toBe(true);
        expect(context.isWiring).toBe(true);
        expect(syncInteractionModeStore).toHaveBeenNthCalledWith(1, {
            mode: 'wire',
            source: 'wire-context-spec',
            context: {
                pendingToolType: 'Wire',
                mobileInteractionMode: 'wire',
                stickyWireTool: true
            }
        });
        expect(syncInteractionModeStore).toHaveBeenNthCalledWith(2, {
            mode: 'wire',
            source: 'set-wiring-active-spec',
            context: {
                isWiring: true
            }
        });
    });

    it('reads state safely when mode-store getter throws', () => {
        const context = {
            interactionModeStore: {
                getState: () => {
                    throw new Error('read failed');
                }
            }
        };

        expect(readInteractionModeState(context)).toBe(null);
    });
});
