import { describe, expect, it } from 'vitest';
import {
    CHART_WORKSPACE_SCHEMA_VERSION,
    createDefaultChartWindowState,
    normalizeChartWorkspaceState,
    serializeChartWorkspaceState
} from '../src/ui/charts/ChartWorkspaceState.js';

describe('ChartWorkspaceState', () => {
    it('creates default floating chart window with independent axis fields', () => {
        const windowState = createDefaultChartWindowState({ index: 2 });

        expect(windowState.id).toMatch(/^chart_window_/);
        expect(windowState.title).toBe('图表 2');
        expect(windowState.rect).toEqual(expect.objectContaining({
            x: expect.any(Number),
            y: expect.any(Number),
            width: expect.any(Number),
            height: expect.any(Number)
        }));
        expect(windowState.series.x.sourceId).toBe('__time__');
        expect(windowState.series.y.sourceId).toBe('__time__');
    });

    it('normalizes workspace state and keeps multiple windows independent', () => {
        const normalized = normalizeChartWorkspaceState({
            sampleIntervalMs: 42.6,
            windows: [
                {
                    id: 'w1',
                    title: 'A',
                    rect: { x: 10, y: 20, width: 300, height: 200 },
                    zIndex: 5,
                    maxPoints: 1500,
                    series: {
                        x: { sourceId: '__time__', quantityId: 'time', autoRange: true },
                        y: { sourceId: 'R1', quantityId: 'current', autoRange: true }
                    }
                },
                {
                    id: 'w2',
                    title: 'B',
                    rect: { x: 30, y: 40, width: 280, height: 180 },
                    zIndex: 6,
                    maxPoints: 2200,
                    series: {
                        x: { sourceId: '__time__', quantityId: 'time', autoRange: true },
                        y: { sourceId: 'R2', quantityId: 'voltage', autoRange: true }
                    }
                }
            ]
        });

        expect(normalized.schemaVersion).toBe(CHART_WORKSPACE_SCHEMA_VERSION);
        expect(normalized.sampleIntervalMs).toBe(43);
        expect(normalized.windows).toHaveLength(2);
        expect(normalized.windows[0].series.y.sourceId).toBe('R1');
        expect(normalized.windows[1].series.y.sourceId).toBe('R2');
    });

    it('serializes normalized state without observation legacy keys', () => {
        const state = normalizeChartWorkspaceState({ windows: [] });
        const serialized = serializeChartWorkspaceState(state);

        expect(serialized.schemaVersion).toBe(CHART_WORKSPACE_SCHEMA_VERSION);
        expect(serialized).not.toHaveProperty('observation');
        expect(Array.isArray(serialized.windows)).toBe(true);
    });
});
