import { describe, expect, it } from 'vitest';
import { interactionMethodMaps } from '../src/ui/interaction/interactionMethodMaps.js';

describe('InteractionCoreDelegates installer', () => {
    it('ships core delegate methods on the composed instance map', () => {
        expect(typeof interactionMethodMaps.bindEvents).toBe('function');
        expect(typeof interactionMethodMaps.bindCanvasEvents).toBe('function');
        expect(typeof interactionMethodMaps.onMouseDown).toBe('function');
        expect(typeof interactionMethodMaps.startDragging).toBe('function');
        expect(typeof interactionMethodMaps.startWiringFromPoint).toBe('function');
        expect(typeof interactionMethodMaps.snapPoint).toBe('function');
        expect(typeof interactionMethodMaps.findNearbyWireEndpoint).toBe('function');
        expect(typeof interactionMethodMaps.updatePropertyPanel).toBe('function');
        expect(typeof interactionMethodMaps.updateSelectedComponentReadouts).toBe('function');
        expect(typeof interactionMethodMaps.updateParallelPlateCapacitorPanelValues).toBe('function');
    });
});
