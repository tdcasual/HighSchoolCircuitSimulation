import { describe, expect, it } from 'vitest';
import { InteractionManager } from '../src/ui/Interaction.js';

describe('InteractionCoreDelegates installer', () => {
    it('installs core delegate methods on InteractionManager prototype', () => {
        expect(typeof InteractionManager.prototype.bindEvents).toBe('function');
        expect(typeof InteractionManager.prototype.bindCanvasEvents).toBe('function');
        expect(typeof InteractionManager.prototype.onMouseDown).toBe('function');
        expect(typeof InteractionManager.prototype.startDragging).toBe('function');
        expect(typeof InteractionManager.prototype.startWiringFromPoint).toBe('function');
        expect(typeof InteractionManager.prototype.snapPoint).toBe('function');
        expect(typeof InteractionManager.prototype.findNearbyWireEndpoint).toBe('function');
        expect(typeof InteractionManager.prototype.updatePropertyPanel).toBe('function');
        expect(typeof InteractionManager.prototype.updateSelectedComponentReadouts).toBe('function');
        expect(typeof InteractionManager.prototype.updateParallelPlateCapacitorPanelValues).toBe('function');
    });
});
