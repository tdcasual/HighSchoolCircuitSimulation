import { describe, expect, it, vi } from 'vitest';
import { buildAppSaveData, restoreAppMetaFromSaveData } from '../src/app/AppSerialization.js';

describe('AppSerialization', () => {
    it('buildAppSaveData writes exercise board and observation meta via callable toJSON', () => {
        const circuit = {
            toJSON: vi.fn(() => ({
                components: [],
                wires: []
            }))
        };
        const exerciseBoard = {
            toJSON: vi.fn(() => ({ mode: 'quiz' }))
        };
        const observationPanel = {
            toJSON: vi.fn(() => ({ probes: ['p1'] }))
        };

        const result = buildAppSaveData({
            circuit,
            exerciseBoard,
            observationPanel
        });

        expect(result.meta?.exerciseBoard).toEqual({ mode: 'quiz' });
        expect(result.meta?.observation).toEqual({ probes: ['p1'] });
        expect(exerciseBoard.toJSON).toHaveBeenCalledTimes(1);
        expect(observationPanel.toJSON).toHaveBeenCalledTimes(1);
    });

    it('buildAppSaveData ignores non-callable panel serializers', () => {
        const circuit = {
            toJSON: vi.fn(() => ({
                components: [],
                wires: [],
                meta: {}
            }))
        };

        expect(() => buildAppSaveData({
            circuit,
            exerciseBoard: { toJSON: {} },
            observationPanel: { toJSON: 'invalid' }
        })).not.toThrow();

        const result = buildAppSaveData({
            circuit,
            exerciseBoard: { toJSON: {} },
            observationPanel: { toJSON: 'invalid' }
        });

        expect(result.meta?.exerciseBoard).toBeUndefined();
        expect(result.meta?.observation).toBeUndefined();
    });

    it('restoreAppMetaFromSaveData only calls callable fromJSON methods', () => {
        const exerciseBoard = {
            fromJSON: vi.fn()
        };
        const observationPanel = {
            fromJSON: vi.fn()
        };

        expect(() => restoreAppMetaFromSaveData({
            exerciseBoard,
            observationPanel,
            data: {
                meta: {
                    exerciseBoard: { chapter: 2 },
                    observation: { plots: [] }
                }
            }
        })).not.toThrow();

        restoreAppMetaFromSaveData({
            exerciseBoard,
            observationPanel,
            data: {
                meta: {
                    exerciseBoard: { chapter: 2 },
                    observation: { plots: [] }
                }
            }
        });

        expect(exerciseBoard.fromJSON).toHaveBeenCalledWith({ chapter: 2 });
        expect(observationPanel.fromJSON).toHaveBeenCalledWith({ plots: [] });
    });

    it('restoreAppMetaFromSaveData ignores non-callable fromJSON methods', () => {
        const exerciseBoard = {
            fromJSON: {}
        };
        const observationPanel = {
            fromJSON: null
        };

        expect(() => restoreAppMetaFromSaveData({
            exerciseBoard,
            observationPanel,
            data: {
                meta: {
                    exerciseBoard: { chapter: 1 },
                    observation: { plots: ['x'] }
                }
            }
        })).not.toThrow();
    });
});
