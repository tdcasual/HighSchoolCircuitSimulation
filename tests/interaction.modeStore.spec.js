import { describe, expect, it, vi } from 'vitest';
import { InteractionModeStore } from '../src/app/interaction/InteractionModeStore.js';
import * as InteractionOrchestrator from '../src/app/interaction/InteractionOrchestrator.js';

describe('InteractionModeStore', () => {
    it('keeps exactly one active mode and emits transition events', () => {
        const store = new InteractionModeStore();
        const listener = vi.fn();
        const unsubscribe = store.subscribe(listener);

        const wireState = store.setMode('wire', {
            pendingToolType: 'Wire',
            mobileInteractionMode: 'wire',
            stickyWireTool: true,
            isWiring: true
        });
        expect(wireState.mode).toBe('wire');
        expect(listener).toHaveBeenCalledTimes(1);

        const duplicateState = store.setMode('wire', {
            pendingToolType: 'Wire',
            mobileInteractionMode: 'wire',
            stickyWireTool: true,
            isWiring: true
        });
        expect(duplicateState.mode).toBe('wire');
        expect(listener).toHaveBeenCalledTimes(1);

        const endpointState = store.setMode('endpoint-edit', {
            pendingToolType: 'Wire',
            mobileInteractionMode: 'wire',
            stickyWireTool: true,
            isWiring: false,
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
    it('initializes interaction mode store eagerly from current runtime flags', () => {
        const context = {
            pendingToolType: 'Wire',
            mobileInteractionMode: 'wire',
            stickyWireTool: true,
            isWiring: true,
            isDraggingWireEndpoint: false,
            isTerminalExtending: false,
            isRheostatDragging: false
        };

        const state = InteractionOrchestrator.initializeInteractionModeStore(context);

        expect(state.mode).toBe('wire');
        expect(context.interactionMode).toBe('wire');
        expect(context.interactionModeStore).toBeInstanceOf(InteractionModeStore);
        expect(context.interactionModeStore.getState().version).toBe(0);
    });

    it('syncs conflicting runtime flags into one authoritative mode', () => {
        const context = {
            pendingToolType: 'Wire',
            mobileInteractionMode: 'wire',
            stickyWireTool: true,
            isWiring: true,
            isDraggingWireEndpoint: true,
            isTerminalExtending: false,
            isRheostatDragging: false
        };

        const state = InteractionOrchestrator.syncInteractionModeStore(context, { source: 'spec' });

        expect(state.mode).toBe('endpoint-edit');
        expect(context.interactionMode).toBe('endpoint-edit');
        expect(context.interactionModeStore.getState().mode).toBe('endpoint-edit');
        expect(context.interactionModeStore.getState().context.pendingToolType).toBe('Wire');
    });

    it('does not mirror store context back into legacy runtime flags on initialize', () => {
        const context = {
            pendingToolType: null,
            mobileInteractionMode: 'select',
            stickyWireTool: false,
            isWiring: false,
            isDraggingWireEndpoint: false,
            isTerminalExtending: false,
            isRheostatDragging: false,
            interactionModeStore: new InteractionModeStore({
                mode: 'wire',
                context: {
                    pendingToolType: 'Wire',
                    mobileInteractionMode: 'wire',
                    stickyWireTool: true,
                    isWiring: true
                }
            })
        };

        const state = InteractionOrchestrator.initializeInteractionModeStore(context);

        expect(state.mode).toBe('wire');
        expect(context.interactionMode).toBe('wire');
        expect(context.pendingToolType).toBe(null);
        expect(context.mobileInteractionMode).toBe('select');
        expect(context.stickyWireTool).toBe(false);
        expect(context.isWiring).toBe(false);
    });

    it('does not mirror sync overrides into legacy runtime flags', () => {
        const context = {
            pendingToolType: null,
            mobileInteractionMode: 'select',
            stickyWireTool: false,
            isWiring: false,
            isDraggingWireEndpoint: false,
            isTerminalExtending: false,
            isRheostatDragging: false
        };

        const state = InteractionOrchestrator.syncInteractionModeStore(context, {
            mode: 'wire',
            source: 'spec',
            context: {
                pendingToolType: 'Wire',
                mobileInteractionMode: 'wire',
                stickyWireTool: true,
                isWiring: true
            }
        });

        expect(state.mode).toBe('wire');
        expect(context.interactionMode).toBe('wire');
        expect(context.interactionModeStore.getState().context.pendingToolType).toBe('Wire');
        expect(context.pendingToolType).toBe(null);
        expect(context.mobileInteractionMode).toBe('select');
        expect(context.stickyWireTool).toBe(false);
        expect(context.isWiring).toBe(false);
    });
});
