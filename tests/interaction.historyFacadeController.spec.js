import { describe, expect, it, vi } from 'vitest';
import * as HistoryFacadeController from '../src/ui/interaction/HistoryFacadeController.js';

describe('HistoryFacadeController', () => {
    it('returns capture state and history key', () => {
        const ctx = {
            historyManager: {
                captureState: vi.fn(() => ({ token: 1 })),
                stateKey: vi.fn(() => 'k1')
            }
        };

        const state = HistoryFacadeController.captureHistoryState.call(ctx);
        const key = HistoryFacadeController.historyKey.call(ctx, state);

        expect(state).toEqual({ token: 1 });
        expect(key).toBe('k1');
        expect(ctx.historyManager.captureState).toHaveBeenCalledTimes(1);
        expect(ctx.historyManager.stateKey).toHaveBeenCalledWith({ token: 1 });
    });

    it('returns selection snapshot', () => {
        const ctx = {
            historyManager: {
                getSelectionSnapshot: vi.fn(() => ({ componentId: 'R1' }))
            }
        };

        const snapshot = HistoryFacadeController.getSelectionSnapshot.call(ctx);
        expect(snapshot).toEqual({ componentId: 'R1' });
        expect(ctx.historyManager.getSelectionSnapshot).toHaveBeenCalledTimes(1);
    });

    it('delegates transaction and restore actions', () => {
        const ctx = {
            historyManager: {
                restoreSelectionSnapshot: vi.fn(),
                pushEntry: vi.fn(),
                runWithHistory: vi.fn(),
                beginTransaction: vi.fn(),
                commitTransaction: vi.fn(),
                applyState: vi.fn(),
                undo: vi.fn(),
                redo: vi.fn()
            }
        };

        const action = vi.fn();
        HistoryFacadeController.restoreSelectionSnapshot.call(ctx, { id: 'R1' });
        HistoryFacadeController.pushHistoryEntry.call(ctx, { before: 1, after: 2 });
        HistoryFacadeController.runWithHistory.call(ctx, 'op', action);
        HistoryFacadeController.beginHistoryTransaction.call(ctx, 'tx');
        HistoryFacadeController.commitHistoryTransaction.call(ctx);
        HistoryFacadeController.applyHistoryState.call(ctx, { c: 1 }, { s: 2 });
        HistoryFacadeController.undo.call(ctx);
        HistoryFacadeController.redo.call(ctx);

        expect(ctx.historyManager.restoreSelectionSnapshot).toHaveBeenCalledWith({ id: 'R1' });
        expect(ctx.historyManager.pushEntry).toHaveBeenCalledWith({ before: 1, after: 2 });
        expect(ctx.historyManager.runWithHistory).toHaveBeenCalledWith('op', action);
        expect(ctx.historyManager.beginTransaction).toHaveBeenCalledWith('tx');
        expect(ctx.historyManager.commitTransaction).toHaveBeenCalledTimes(1);
        expect(ctx.historyManager.applyState).toHaveBeenCalledWith({ c: 1 }, { s: 2 });
        expect(ctx.historyManager.undo).toHaveBeenCalledTimes(1);
        expect(ctx.historyManager.redo).toHaveBeenCalledTimes(1);
    });

    it('stabilizes transient interactions before undo navigation', () => {
        const ctx = {
            historyManager: {
                undo: vi.fn(),
                commitTransaction: vi.fn(),
                transaction: { label: 'drag' }
            },
            isWiring: true,
            cancelWiring: vi.fn(),
            suspendedWiringSession: { wireStart: { x: 10, y: 20 } },
            wireModeGesture: { kind: 'wire-endpoint' },
            pointerDownInfo: { moved: true },
            isDraggingWireEndpoint: true,
            isTerminalExtending: true,
            isRheostatDragging: true,
            onMouseLeave: vi.fn(),
            commitHistoryTransaction: vi.fn()
        };

        HistoryFacadeController.undo.call(ctx);

        expect(ctx.cancelWiring).toHaveBeenCalledTimes(1);
        expect(ctx.onMouseLeave).toHaveBeenCalledTimes(1);
        expect(ctx.commitHistoryTransaction).toHaveBeenCalledTimes(1);
        expect(ctx.historyManager.undo).toHaveBeenCalledTimes(1);
        expect(ctx.suspendedWiringSession).toBeNull();
        expect(ctx.wireModeGesture).toBeNull();
        expect(ctx.pointerDownInfo).toBeNull();
        expect(ctx.isTerminalExtending).toBe(false);
        expect(ctx.isRheostatDragging).toBe(false);
    });

    it('commits open transaction via history manager before redo when facade delegate is absent', () => {
        const ctx = {
            historyManager: {
                redo: vi.fn(),
                commitTransaction: vi.fn(),
                transaction: { label: 'tx' }
            },
            isDragging: false,
            isDraggingWire: false,
            isDraggingWireEndpoint: false,
            isTerminalExtending: false,
            isRheostatDragging: false,
            isWiring: false,
            suspendedWiringSession: null,
            wireModeGesture: null,
            pointerDownInfo: null
        };

        HistoryFacadeController.redo.call(ctx);

        expect(ctx.historyManager.commitTransaction).toHaveBeenCalledTimes(1);
        expect(ctx.historyManager.redo).toHaveBeenCalledTimes(1);
    });
});
