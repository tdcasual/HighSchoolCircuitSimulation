import { describe, expect, it } from 'vitest';
import { InteractionModeStore } from '../src/app/interaction/InteractionModeStore.js';
import {
    initializeInteractionModeStore,
    syncInteractionModeStore
} from '../src/app/interaction/InteractionModeStateMachine.js';

describe('InteractionModeStateMachine.initializeInteractionModeStore', () => {
    it('initializes store state from runtime flags', () => {
        const context = {
            pendingToolType: 'Wire',
            mobileInteractionMode: 'wire',
            stickyWireTool: true,
            isWiring: true,
            isDraggingWireEndpoint: false,
            isTerminalExtending: false,
            isRheostatDragging: false
        };

        const state = initializeInteractionModeStore(context);

        expect(state.mode).toBe('wire');
        expect(context.interactionModeStore).toBeInstanceOf(InteractionModeStore);
        expect(context.interactionMode).toBe('wire');
    });
});

describe('InteractionModeStateMachine.syncInteractionModeStore', () => {
    it('uses explicit mode/context overrides to resolve next state', () => {
        const context = {
            pendingToolType: null,
            mobileInteractionMode: 'select',
            stickyWireTool: false,
            isWiring: false,
            isDraggingWireEndpoint: false,
            isTerminalExtending: false,
            isRheostatDragging: false
        };

        const state = syncInteractionModeStore(context, {
            mode: 'endpoint-edit',
            source: 'mode-state-machine-spec',
            context: {
                isDraggingWireEndpoint: true
            }
        });

        expect(state.mode).toBe('endpoint-edit');
        expect(context.interactionModeStore.getState().mode).toBe('endpoint-edit');
        expect(context.interactionMode).toBe('endpoint-edit');
    });
});
