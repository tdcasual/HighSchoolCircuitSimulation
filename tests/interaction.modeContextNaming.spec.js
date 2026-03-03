import { describe, expect, it } from 'vitest';
import { InteractionModeStore } from '../src/app/interaction/InteractionModeStore.js';
import { readInteractionModeContext } from '../src/app/interaction/InteractionModeBridge.js';

describe('Interaction mode context naming contract', () => {
    it('exposes canonical non-legacy wire-mode keys', () => {
        const store = new InteractionModeStore();
        const context = store.getState().context;

        expect(context).toMatchObject({
            pendingTool: null,
            mobileMode: 'select',
            wireModeSticky: false,
            wiringActive: false
        });

        expect('pendingToolType' in context).toBe(false);
        expect('mobileInteractionMode' in context).toBe(false);
        expect('stickyWireTool' in context).toBe(false);
        expect('isWiring' in context).toBe(false);
    });

    it('returns canonical keys from bridge fallback snapshot', () => {
        const context = readInteractionModeContext({});

        expect(context).toMatchObject({
            pendingTool: null,
            mobileMode: 'select',
            wireModeSticky: false,
            wiringActive: false
        });
    });
});
