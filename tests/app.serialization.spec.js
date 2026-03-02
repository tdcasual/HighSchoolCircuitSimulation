import { describe, expect, it, vi } from 'vitest';
import { buildAppSaveData, restoreAppMetaFromSaveData } from '../src/app/AppSerialization.js';

describe('AppSerialization', () => {
    it('buildAppSaveData writes exercise board and chart workspace meta via callable toJSON', () => {
        const circuit = {
            toJSON: vi.fn(() => ({
                components: [],
                wires: []
            }))
        };
        const exerciseBoard = {
            toJSON: vi.fn(() => ({ mode: 'quiz' }))
        };
        const chartWorkspace = {
            toJSON: vi.fn(() => ({ windows: ['w1'] }))
        };

        const result = buildAppSaveData({
            circuit,
            exerciseBoard,
            chartWorkspace
        });

        expect(result.meta?.exerciseBoard).toEqual({ mode: 'quiz' });
        expect(result.meta?.chartWorkspace).toEqual({ windows: ['w1'] });
        expect(result.meta?.observation).toBeUndefined();
        expect(exerciseBoard.toJSON).toHaveBeenCalledTimes(1);
        expect(chartWorkspace.toJSON).toHaveBeenCalledTimes(1);
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
            chartWorkspace: { toJSON: 'invalid' }
        })).not.toThrow();

        const result = buildAppSaveData({
            circuit,
            exerciseBoard: { toJSON: {} },
            chartWorkspace: { toJSON: 'invalid' }
        });

        expect(result.meta?.exerciseBoard).toBeUndefined();
        expect(result.meta?.chartWorkspace).toBeUndefined();
        expect(result.meta?.observation).toBeUndefined();
    });

    it('restoreAppMetaFromSaveData only calls callable fromJSON methods', () => {
        const exerciseBoard = {
            fromJSON: vi.fn()
        };
        const chartWorkspace = {
            fromJSON: vi.fn()
        };

        expect(() => restoreAppMetaFromSaveData({
            exerciseBoard,
            chartWorkspace,
            data: {
                meta: {
                    exerciseBoard: { chapter: 2 },
                    chartWorkspace: { windows: [] }
                }
            }
        })).not.toThrow();

        restoreAppMetaFromSaveData({
            exerciseBoard,
            chartWorkspace,
            data: {
                meta: {
                    exerciseBoard: { chapter: 2 },
                    chartWorkspace: { windows: [] }
                }
            }
        });

        expect(exerciseBoard.fromJSON).toHaveBeenCalledWith({ chapter: 2 });
        expect(chartWorkspace.fromJSON).toHaveBeenCalledWith({ windows: [] });
    });

    it('restoreAppMetaFromSaveData ignores non-callable fromJSON methods', () => {
        const exerciseBoard = {
            fromJSON: {}
        };
        const chartWorkspace = {
            fromJSON: null
        };

        expect(() => restoreAppMetaFromSaveData({
            exerciseBoard,
            chartWorkspace,
            data: {
                meta: {
                    exerciseBoard: { chapter: 1 },
                    chartWorkspace: { windows: ['x'] }
                }
            }
        })).not.toThrow();
    });
});
