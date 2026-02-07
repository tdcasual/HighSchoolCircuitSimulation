import { describe, expect, it } from 'vitest';
import { InteractionManager } from '../src/ui/Interaction.js';

describe('InteractionTailDelegates installer', () => {
    it('installs tail delegate methods on InteractionManager prototype', () => {
        expect(typeof InteractionManager.prototype.showPropertyDialog).toBe('function');
        expect(typeof InteractionManager.prototype.hideDialog).toBe('function');
        expect(typeof InteractionManager.prototype.applyDialogChanges).toBe('function');
        expect(typeof InteractionManager.prototype.showContextMenu).toBe('function');
        expect(typeof InteractionManager.prototype.addObservationProbeForWire).toBe('function');
        expect(typeof InteractionManager.prototype.captureHistoryState).toBe('function');
        expect(typeof InteractionManager.prototype.undo).toBe('function');
        expect(typeof InteractionManager.prototype.updateStatus).toBe('function');
        expect(typeof InteractionManager.prototype.detectAlignment).toBe('function');
    });
});
