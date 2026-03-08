import { describe, expect, it, vi } from 'vitest';
import { InteractionModeStore } from '../src/app/interaction/InteractionModeStore.js';
import * as InteractionOrchestrator from '../src/app/interaction/InteractionOrchestrator.js';

describe('InteractionModeStore', () => {
    it('keeps exactly one active mode and emits transition events', () => {
        const store = new InteractionModeStore();
        const listener = vi.fn();
        const unsubscribe = store.subscribe(listener);

        const wireState = store.setMode('wire', {
            pendingTool: 'Wire',
            mobileMode: 'wire',
            wireModeSticky: true,
            wiringActive: true
        });
        expect(wireState.mode).toBe('wire');
        expect(listener).toHaveBeenCalledTimes(1);

        const duplicateState = store.setMode('wire', {
            pendingTool: 'Wire',
            mobileMode: 'wire',
            wireModeSticky: true,
            wiringActive: true
        });
        expect(duplicateState.mode).toBe('wire');
        expect(listener).toHaveBeenCalledTimes(1);

        const endpointState = store.setMode('endpoint-edit', {
            pendingTool: 'Wire',
            mobileMode: 'wire',
            wireModeSticky: true,
            wiringActive: false,
            isDraggingWireEndpoint: true
        });
        expect(endpointState.mode).toBe('endpoint-edit');
        expect(listener).toHaveBeenCalledTimes(2);
        expect(store.getState().mode).toBe('endpoint-edit');

        unsubscribe();
    });

    it('rejects unsupported mode transitions', () => {
        const store = new InteractionModeStore();
        expect(() => store.setMode('unknown')).toThrow(/unsupported interaction mode/i);
    });
});

describe('InteractionOrchestrator mode-store integration', () => {
    it('initializes interaction mode store eagerly from canonical defaults', () => {
        const context = {
            pendingTool: 'Wire',
            mobileMode: 'wire',
            wireModeSticky: true,
            wiringActive: true,
            isDraggingWireEndpoint: false,
            isTerminalExtending: false,
            isRheostatDragging: false
        };

        const state = InteractionOrchestrator.initializeInteractionModeStore(context);

        expect(state.mode).toBe('select');
        expect(context.interactionMode).toBe('select');
        expect(context.interactionModeStore).toBeInstanceOf(InteractionModeStore);
        expect(context.interactionModeStore.getState().version).toBe(0);
        expect(state.context).toMatchObject({
            pendingTool: null,
            mobileMode: 'select',
            wireModeSticky: false,
            wiringActive: false
        });
    });

    it('reuses app-owned interaction mode store as the shared writable source', () => {
        const sharedStore = new InteractionModeStore({
            mode: 'wire',
            context: {
                pendingTool: 'Wire',
                mobileMode: 'wire',
                wireModeSticky: true,
                wiringActive: true,
                isDraggingWireEndpoint: false,
                isTerminalExtending: false,
                isRheostatDragging: false
            }
        });
        const context = {
            app: {
                runtimeVersion: 2,
                interactionModeStore: sharedStore
            },
            interactionModeStore: null,
            isDraggingWireEndpoint: false,
            isTerminalExtending: false,
            isRheostatDragging: false
        };

        const state = InteractionOrchestrator.initializeInteractionModeStore(context);

        expect(state.mode).toBe('wire');
        expect(context.interactionModeStore).toBe(sharedStore);
        expect(context.app.interactionModeStore).toBe(sharedStore);
        expect(context.app.interactionModeSnapshot).toBe(state);
    });

    it('syncs endpoint-edit runtime flags into one authoritative mode', () => {
        const context = {
            pendingTool: 'Wire',
            mobileMode: 'wire',
            wireModeSticky: true,
            wiringActive: true,
            isDraggingWireEndpoint: true,
            isTerminalExtending: false,
            isRheostatDragging: false
        };

        const state = InteractionOrchestrator.syncInteractionModeStore(context, { source: 'spec' });

        expect(state.mode).toBe('endpoint-edit');
        expect(context.interactionMode).toBe('endpoint-edit');
        expect(context.interactionModeStore.getState().mode).toBe('endpoint-edit');
        expect(context.interactionModeStore.getState().context.pendingTool).toBe(null);
    });

    it('does not mirror store context back into legacy runtime flags on initialize', () => {
        const context = {
            pendingTool: null,
            mobileMode: 'select',
            wireModeSticky: false,
            wiringActive: false,
            isDraggingWireEndpoint: false,
            isTerminalExtending: false,
            isRheostatDragging: false,
            interactionModeStore: new InteractionModeStore({
                mode: 'wire',
                context: {
                    pendingTool: 'Wire',
                    mobileMode: 'wire',
                    wireModeSticky: true,
                    wiringActive: true
                }
            })
        };

        const state = InteractionOrchestrator.initializeInteractionModeStore(context);

        expect(state.mode).toBe('wire');
        expect(context.interactionMode).toBe('wire');
        expect(context.pendingTool).toBe(null);
        expect(context.mobileMode).toBe('select');
        expect(context.wireModeSticky).toBe(false);
        expect(context.wiringActive).toBe(false);
    });

    it('does not mirror sync overrides into legacy runtime flags', () => {
        const context = {
            pendingTool: null,
            mobileMode: 'select',
            wireModeSticky: false,
            wiringActive: false,
            isDraggingWireEndpoint: false,
            isTerminalExtending: false,
            isRheostatDragging: false
        };

        const state = InteractionOrchestrator.syncInteractionModeStore(context, {
            mode: 'wire',
            source: 'spec',
            context: {
                pendingTool: 'Wire',
                mobileMode: 'wire',
                wireModeSticky: true,
                wiringActive: true
            }
        });

        expect(state.mode).toBe('wire');
        expect(context.interactionMode).toBe('wire');
        expect(context.interactionModeStore.getState().context.pendingTool).toBe('Wire');
        expect(context.pendingTool).toBe(null);
        expect(context.mobileMode).toBe('select');
        expect(context.wireModeSticky).toBe(false);
        expect(context.wiringActive).toBe(false);
    });
});
