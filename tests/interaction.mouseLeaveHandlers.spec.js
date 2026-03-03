import { describe, expect, it, vi } from 'vitest';
import { handleMouseLeave } from '../src/app/interaction/InteractionOrchestratorMouseLeaveHandlers.js';

function createInteractionModeStore(modeContext = {}) {
    return {
        getState: vi.fn(() => ({
            mode: modeContext.pendingTool === 'Wire' || modeContext.wiringActive ? 'wire' : 'select',
            context: {
                pendingTool: null,
                mobileMode: 'select',
                wireModeSticky: false,
                wiringActive: false,
                ...modeContext
            }
        }))
    };
}

describe('InteractionOrchestratorMouseLeaveHandlers.handleMouseLeave', () => {
    it('stops panning and resets cursor', () => {
        const context = {
            quickActionBar: { notifyActivity: vi.fn() },
            isPanning: true,
            svg: { style: { cursor: 'grabbing' } },
            isDraggingWireEndpoint: false,
            isDraggingWire: false,
            isDragging: false,
            pointerDownInfo: { componentId: 'R1' },
            wireModeGesture: { kind: 'terminal-extend' }
        };

        handleMouseLeave.call(context, {});

        expect(context.isPanning).toBe(false);
        expect(context.svg.style.cursor).toBe('');
        expect(context.wireModeGesture).toBeNull();
        expect(context.pointerDownInfo).toBeNull();
    });

    it('finalizes endpoint drag and realigns active wire start after compaction', () => {
        const context = {
            quickActionBar: { notifyActivity: vi.fn() },
            isPanning: false,
            interactionModeStore: createInteractionModeStore({
                pendingTool: 'Wire',
                mobileMode: 'wire',
                wireModeSticky: true,
                wiringActive: true
            }),
            wireStart: {
                x: 12,
                y: 34,
                snap: { type: 'wire-endpoint', wireId: 'W1', end: 'a' }
            },
            isDraggingWireEndpoint: true,
            wireEndpointDrag: {
                wireId: 'W1',
                affected: [{ wireId: 'W1', end: 'a' }]
            },
            isDraggingWire: false,
            isDragging: false,
            renderer: { clearTerminalHighlight: vi.fn() },
            selectedWire: 'W1',
            resolveCompactedWireId: vi.fn((wireId, replacementByRemovedId) => replacementByRemovedId[wireId] || wireId),
            compactWiresAndRefresh: vi.fn(() => ({
                replacementByRemovedId: { W1: 'W9' }
            })),
            circuit: {
                getWire: vi.fn((wireId) => {
                    if (wireId !== 'W9') return null;
                    return {
                        id: 'W9',
                        a: { x: 76, y: 54 },
                        b: { x: 140, y: 54 }
                    };
                }),
                rebuildNodes: vi.fn()
            },
            commitHistoryTransaction: vi.fn()
        };

        handleMouseLeave.call(context, {});

        expect(context.isDraggingWireEndpoint).toBe(false);
        expect(context.wireEndpointDrag).toBeNull();
        expect(context.resolveCompactedWireId).toHaveBeenCalledWith('W1', { W1: 'W9' });
        expect(context.wireStart.snap.wireId).toBe('W9');
        expect(context.wireStart.x).toBe(76);
        expect(context.wireStart.y).toBe(54);
    });

    it('cancels component dragging and commits history', () => {
        const context = {
            quickActionBar: { notifyActivity: vi.fn() },
            isPanning: false,
            isDraggingWireEndpoint: false,
            isDraggingWire: false,
            isDragging: true,
            dragTarget: 'R3',
            dragGroup: { boxId: 'B1' },
            isDraggingComponent: true,
            hideAlignmentGuides: vi.fn(),
            circuit: { rebuildNodes: vi.fn() },
            commitHistoryTransaction: vi.fn()
        };

        handleMouseLeave.call(context, {});

        expect(context.isDragging).toBe(false);
        expect(context.dragTarget).toBeNull();
        expect(context.dragGroup).toBeNull();
        expect(context.isDraggingComponent).toBe(false);
        expect(context.hideAlignmentGuides).toHaveBeenCalledTimes(1);
        expect(context.circuit.rebuildNodes).toHaveBeenCalledTimes(1);
        expect(context.commitHistoryTransaction).toHaveBeenCalledTimes(1);
    });
});
