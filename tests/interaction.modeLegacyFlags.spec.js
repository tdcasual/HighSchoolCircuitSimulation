import { describe, expect, it } from 'vitest';
import { InteractionModeStore } from '../src/app/interaction/InteractionModeStore.js';
import {
    initializeInteractionModeStore,
    syncInteractionModeStore
} from '../src/app/interaction/InteractionModeStateMachine.js';
import { readInteractionModeState } from '../src/app/interaction/InteractionModeBridge.js';

describe('interaction mode legacy-flag facade', () => {
    it('exposes frozen legacy compatibility flags derived from canonical store state', () => {
        const store = new InteractionModeStore();
        const state = store.setMode('wire', {
            pendingTool: 'Wire',
            mobileMode: 'wire',
            wireModeSticky: true,
            wiringActive: true
        });

        expect(state.legacyFlags).toEqual({
            pendingToolType: 'Wire',
            mobileInteractionMode: 'wire',
            stickyWireTool: true,
            isWiring: true
        });
        expect(Object.isFrozen(state)).toBe(true);
        expect(Object.isFrozen(state.context)).toBe(true);
        expect(Object.isFrozen(state.legacyFlags)).toBe(true);
    });

    it('publishes a store-backed interactionModeSnapshot instead of trusting stale legacy aliases', () => {
        const context = {
            pendingToolType: null,
            mobileInteractionMode: 'select',
            stickyWireTool: false,
            isWiring: false,
            pendingTool: null,
            mobileMode: 'select',
            wireModeSticky: false,
            wiringActive: false,
            isDraggingWireEndpoint: false,
            isTerminalExtending: false,
            isRheostatDragging: false
        };

        const initial = initializeInteractionModeStore(context);
        expect(context.interactionModeSnapshot).toBe(initial);

        const next = syncInteractionModeStore(context, {
            mode: 'wire',
            source: 'legacy-flags-spec',
            context: {
                pendingTool: 'Wire',
                mobileMode: 'wire',
                wireModeSticky: true,
                wiringActive: true
            }
        });

        expect(readInteractionModeState(context)).toBe(next);
        expect(context.interactionModeSnapshot).toBe(next);
        expect(context.interactionModeSnapshot.legacyFlags).toEqual({
            pendingToolType: 'Wire',
            mobileInteractionMode: 'wire',
            stickyWireTool: true,
            isWiring: true
        });
        expect(context.pendingToolType).toBe(null);
        expect(context.mobileInteractionMode).toBe('select');
        expect(context.stickyWireTool).toBe(false);
        expect(context.isWiring).toBe(false);
    });
});
