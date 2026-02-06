import { describe, expect, it, vi } from 'vitest';
import { Circuit } from '../src/engine/Circuit.js';
import { InteractionManager } from '../src/ui/Interaction.js';

describe('Interaction wire segment snap/split helpers', () => {
    it('finds projected snap point on nearby wire segment', () => {
        const ctx = {
            circuit: {
                getAllWires() {
                    return [
                        { id: 'W1', a: { x: 0, y: 0 }, b: { x: 100, y: 0 } }
                    ];
                }
            }
        };

        const found = InteractionManager.prototype.findNearbyWireSegment.call(ctx, 47, 6, 15);
        expect(found).toEqual({ wireId: 'W1', x: 47, y: 0 });
    });

    it('ignores points too close to segment endpoints', () => {
        const ctx = {
            circuit: {
                getAllWires() {
                    return [
                        { id: 'W1', a: { x: 0, y: 0 }, b: { x: 100, y: 0 } }
                    ];
                }
            }
        };

        const nearStart = InteractionManager.prototype.findNearbyWireSegment.call(ctx, 1, 0, 15);
        expect(nearStart).toBeNull();
    });

    it('splits wire at projected point and preserves far-end terminal binding', () => {
        const circuit = new Circuit();
        circuit.addWire({
            id: 'W1',
            a: { x: 0, y: 0 },
            b: { x: 100, y: 0 },
            bRef: { componentId: 'R1', terminalIndex: 1 }
        });

        const ctx = {
            circuit,
            renderer: {
                refreshWire: vi.fn(),
                addWire: vi.fn()
            }
        };

        const result = InteractionManager.prototype.splitWireAtPointInternal.call(
            ctx,
            'W1',
            40,
            12,
            { ensureUniqueWireId: () => 'W2' }
        );

        expect(result?.created).toBe(true);
        expect(result?.point).toEqual({ x: 40, y: 0 });

        const oldWire = circuit.getWire('W1');
        const newWire = circuit.getWire('W2');
        expect(oldWire.b).toEqual({ x: 40, y: 0 });
        expect(oldWire.bRef).toBeUndefined();
        expect(newWire.a).toEqual({ x: 40, y: 0 });
        expect(newWire.b).toEqual({ x: 100, y: 0 });
        expect(newWire.bRef).toEqual({ componentId: 'R1', terminalIndex: 1 });
    });

    it('does not split when point is too close to endpoint', () => {
        const circuit = new Circuit();
        circuit.addWire({
            id: 'W1',
            a: { x: 0, y: 0 },
            b: { x: 100, y: 0 }
        });

        const ctx = {
            circuit,
            renderer: {
                refreshWire: vi.fn(),
                addWire: vi.fn()
            }
        };

        const result = InteractionManager.prototype.splitWireAtPointInternal.call(
            ctx,
            'W1',
            2,
            0,
            { ensureUniqueWireId: () => 'W2' }
        );

        expect(result?.created).toBe(false);
        expect(circuit.getWire('W2')).toBeUndefined();
        expect(circuit.getAllWires().length).toBe(1);
    });

    it('clears terminal highlight when endpoint drag ends on mouseup', () => {
        const clearTerminalHighlight = vi.fn();
        const rebuildNodes = vi.fn();
        const commitHistoryTransaction = vi.fn();
        const ctx = {
            isPanning: false,
            isDraggingWireEndpoint: true,
            wireEndpointDrag: { wireId: 'W1', end: 'a' },
            circuit: { rebuildNodes },
            renderer: { clearTerminalHighlight },
            commitHistoryTransaction
        };

        InteractionManager.prototype.onMouseUp.call(ctx, {
            target: { classList: { contains: () => false } }
        });

        expect(ctx.isDraggingWireEndpoint).toBe(false);
        expect(ctx.wireEndpointDrag).toBeNull();
        expect(clearTerminalHighlight).toHaveBeenCalledTimes(1);
        expect(rebuildNodes).toHaveBeenCalledTimes(1);
        expect(commitHistoryTransaction).toHaveBeenCalledTimes(1);
    });

    it('clears terminal highlight when endpoint drag ends on mouseleave', () => {
        const clearTerminalHighlight = vi.fn();
        const rebuildNodes = vi.fn();
        const commitHistoryTransaction = vi.fn();
        const ctx = {
            isPanning: false,
            isDraggingWireEndpoint: true,
            wireEndpointDrag: { wireId: 'W1', end: 'a' },
            isDraggingWire: false,
            isDragging: false,
            circuit: { rebuildNodes },
            renderer: { clearTerminalHighlight },
            commitHistoryTransaction
        };

        InteractionManager.prototype.onMouseLeave.call(ctx, {});

        expect(ctx.isDraggingWireEndpoint).toBe(false);
        expect(ctx.wireEndpointDrag).toBeNull();
        expect(clearTerminalHighlight).toHaveBeenCalledTimes(1);
        expect(rebuildNodes).toHaveBeenCalledTimes(1);
        expect(commitHistoryTransaction).toHaveBeenCalledTimes(1);
    });
});
