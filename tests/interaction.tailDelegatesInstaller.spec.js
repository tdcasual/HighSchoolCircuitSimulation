import { describe, expect, it } from 'vitest';
import { interactionMethodMaps } from '../src/ui/interaction/interactionMethodMaps.js';

describe('InteractionTailDelegates installer', () => {
    it('ships tail delegate methods on the composed instance map', () => {
        expect(typeof interactionMethodMaps.showPropertyDialog).toBe('function');
        expect(typeof interactionMethodMaps.hideDialog).toBe('function');
        expect(typeof interactionMethodMaps.applyDialogChanges).toBe('function');
        expect(typeof interactionMethodMaps.showContextMenu).toBe('function');
        expect(typeof interactionMethodMaps.addObservationProbeForWire).toBe('function');
        expect(typeof interactionMethodMaps.captureHistoryState).toBe('function');
        expect(typeof interactionMethodMaps.undo).toBe('function');
        expect(typeof interactionMethodMaps.updateStatus).toBe('function');
        expect(typeof interactionMethodMaps.detectAlignment).toBe('function');
    });
});
