import { describe, expect, it, vi } from 'vitest';
import {
    readInteractionModeContext,
    readInteractionModeState,
    setInteractionModeContext,
    setWireToolContext,
    setWiringActive
} from '../src/app/interaction/InteractionModeBridge.js';

describe('InteractionModeBridge', () => {
    it('returns safe defaults when store state is unavailable and ignores legacy runtime fields', () => {
        const context = {
            pendingTool: 'Wire',
            mobileMode: 'unknown-mode',
            wireModeSticky: 1,
            wiringActive: 'yes',
            isDraggingWireEndpoint: 0,
            isTerminalExtending: '1',
            isRheostatDragging: null
        };

        const modeContext = readInteractionModeContext(context);
        expect(modeContext).toEqual({
            pendingTool: null,
            mobileMode: 'select',
            wireModeSticky: false,
            wiringActive: false,
            isDraggingWireEndpoint: false,
            isTerminalExtending: false,
            isRheostatDragging: false
        });
    });

    it('reads shared app-owned mode store when local interaction context has not mirrored it yet', () => {
        const state = {
            mode: 'wire',
            context: {
                pendingTool: 'Wire',
                mobileMode: 'wire',
                wireModeSticky: true,
                wiringActive: true,
                isDraggingWireEndpoint: false,
                isTerminalExtending: false,
                isRheostatDragging: false
            },
            version: 3
        };
        const context = {
            app: {
                runtimeVersion: 2,
                interactionModeStore: {
                    getState: () => state
                }
            }
        };

        expect(readInteractionModeState(context)).toBe(state);
        expect(readInteractionModeContext(context)).toEqual(state.context);
    });

    it('writes normalized context to mode store without mutating legacy runtime flags', () => {
        const syncInteractionModeStore = vi.fn(() => ({ mode: 'wire', context: {}, version: 1 }));
        const context = {
            pendingTool: 'Wire',
            mobileMode: 'select',
            wireModeSticky: false,
            wiringActive: false,
            isDraggingWireEndpoint: false,
            syncInteractionModeStore
        };

        setInteractionModeContext(context, {
            pendingTool: '',
            mobileMode: 'wire',
            wireModeSticky: 1,
            wiringActive: 1,
            isDraggingWireEndpoint: 1
        }, {
            mode: 'wire',
            source: 'mode-bridge-spec'
        });

        expect(context.pendingTool).toBe('Wire');
        expect(context.mobileMode).toBe('select');
        expect(context.wireModeSticky).toBe(false);
        expect(context.wiringActive).toBe(false);
        expect(context.isDraggingWireEndpoint).toBe(false);
        expect(syncInteractionModeStore).toHaveBeenCalledWith({
            mode: 'wire',
            source: 'mode-bridge-spec',
            context: {
                pendingTool: null,
                mobileMode: 'wire',
                wireModeSticky: true,
                wiringActive: true,
                isDraggingWireEndpoint: true
            }
        });
    });

    it('supports wire-context and wiring-active helpers without mutating legacy runtime flags', () => {
        const syncInteractionModeStore = vi.fn(() => ({ mode: 'wire', context: {}, version: 1 }));
        const context = {
            pendingTool: null,
            mobileMode: 'select',
            wireModeSticky: false,
            wiringActive: false,
            syncInteractionModeStore
        };

        setWireToolContext(context, {
            pendingTool: 'Wire',
            mobileMode: 'wire',
            wireModeSticky: true
        }, {
            mode: 'wire',
            source: 'wire-context-spec'
        });
        setWiringActive(context, true, { mode: 'wire', source: 'set-wiring-active-spec' });

        expect(context.pendingTool).toBe(null);
        expect(context.mobileMode).toBe('select');
        expect(context.wireModeSticky).toBe(false);
        expect(context.wiringActive).toBe(false);
        expect(syncInteractionModeStore).toHaveBeenNthCalledWith(1, {
            mode: 'wire',
            source: 'wire-context-spec',
            context: {
                pendingTool: 'Wire',
                mobileMode: 'wire',
                wireModeSticky: true
            }
        });
        expect(syncInteractionModeStore).toHaveBeenNthCalledWith(2, {
            mode: 'wire',
            source: 'set-wiring-active-spec',
            context: {
                wiringActive: true
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
