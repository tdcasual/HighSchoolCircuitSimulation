import { describe, expect, it } from 'vitest';
import { initializeInteractionState } from '../src/ui/interaction/InteractionStateInitializer.js';

class FakeHistoryManager {
    constructor(interaction, options) {
        this.interaction = interaction;
        this.options = options;
    }
}

describe('InteractionStateInitializer.initializeInteractionState', () => {
    it('initializes core state fields and history manager', () => {
        const app = {
            circuit: { id: 'c' },
            renderer: { id: 'r' },
            svg: { id: 's' }
        };
        const ctx = {};

        initializeInteractionState(ctx, app, { HistoryManagerClass: FakeHistoryManager });

        expect(ctx.app).toBe(app);
        expect(ctx.circuit).toBe(app.circuit);
        expect(ctx.renderer).toBe(app.renderer);
        expect(ctx.svg).toBe(app.svg);

        expect(ctx.isDragging).toBe(false);
        expect(ctx.isWiring).toBe(false);
        expect(ctx.isDraggingComponent).toBe(false);
        expect(ctx.dragTarget).toBe(null);
        expect(ctx.dragGroup).toBe(null);
        expect(ctx.dragOffset).toEqual({ x: 0, y: 0 });
        expect(ctx.selectedComponent).toBe(null);
        expect(ctx.selectedWire).toBe(null);

        expect(ctx.historyManager).toBeInstanceOf(FakeHistoryManager);
        expect(ctx.historyManager.interaction).toBe(ctx);
        expect(ctx.historyManager.options).toEqual({ maxEntries: 100 });

        expect(ctx.wireStart).toBe(null);
        expect(ctx.tempWire).toBe(null);
        expect(ctx.ignoreNextWireMouseUp).toBe(false);
        expect(ctx.isDraggingWireEndpoint).toBe(false);
        expect(ctx.wireEndpointDrag).toBe(null);
        expect(ctx.isDraggingWire).toBe(false);
        expect(ctx.wireDrag).toBe(null);

        expect(ctx.isPanning).toBe(false);
        expect(ctx.panStart).toEqual({ x: 0, y: 0 });
        expect(ctx.viewOffset).toEqual({ x: 0, y: 0 });
        expect(ctx.scale).toBe(1);

        expect(ctx.activePointers).toBeInstanceOf(Map);
        expect(ctx.primaryPointerId).toBe(null);
        expect(ctx.pinchGesture).toBe(null);
        expect(ctx.blockSinglePointerInteraction).toBe(false);
        expect(ctx.lastPrimaryPointerType).toBe('mouse');

        expect(ctx.pendingToolType).toBe(null);
        expect(ctx.pendingToolItem).toBe(null);
        expect(ctx.alignmentGuides).toBe(null);
        expect(ctx.snapThreshold).toBe(10);
    });
});
