import { describe, expect, it } from 'vitest';
import { InteractionModeStore } from '../src/app/interaction/InteractionModeStore.js';
import {
    initializeInteractionModeStore,
    syncInteractionModeStore
} from '../src/app/interaction/InteractionModeStateMachine.js';

describe('InteractionModeStateMachine.initializeInteractionModeStore', () => {
    it('initializes store state from canonical defaults and ignores legacy runtime wire flags', () => {
        const context = {
            pendingTool: 'Wire',
            mobileMode: 'wire',
            wireModeSticky: true,
            wiringActive: true,
            isDraggingWireEndpoint: false,
            isTerminalExtending: false,
            isRheostatDragging: false
        };

        const state = initializeInteractionModeStore(context);

        expect(state.mode).toBe('select');
        expect(context.interactionModeStore).toBeInstanceOf(InteractionModeStore);
        expect(context.interactionMode).toBe('select');
        expect(state.context).toMatchObject({
            pendingTool: null,
            mobileMode: 'select',
            wireModeSticky: false,
            wiringActive: false
        });
    });
});

describe('InteractionModeStateMachine.syncInteractionModeStore', () => {
    it('uses explicit mode/context overrides to resolve next state', () => {
        const context = {
            pendingTool: null,
            mobileMode: 'select',
            wireModeSticky: false,
            wiringActive: false,
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
