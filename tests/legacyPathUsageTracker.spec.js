import { describe, expect, it } from 'vitest';
import {
    clearLegacyPathUsage,
    getLegacyPathUsageSnapshot,
    recordLegacyPathUsage
} from '../src/app/legacy/LegacyPathUsageTracker.js';

describe('LegacyPathUsageTracker', () => {
    it('records and aggregates usage per key on target object', () => {
        const target = {};

        const first = recordLegacyPathUsage(target, 'interaction.mode.legacy-fallback', {
            reason: 'store-missing'
        });
        const second = recordLegacyPathUsage(target, 'interaction.mode.legacy-fallback', {
            reason: 'store-read-error'
        });

        expect(first).toBeTruthy();
        expect(second).toBeTruthy();

        const snapshot = getLegacyPathUsageSnapshot(target);
        expect(snapshot).toHaveLength(1);
        expect(snapshot[0].key).toBe('interaction.mode.legacy-fallback');
        expect(snapshot[0].count).toBe(2);
        expect(snapshot[0].lastDetails?.reason).toBe('store-read-error');
    });

    it('returns empty snapshot for invalid target and ignores invalid key', () => {
        expect(getLegacyPathUsageSnapshot(null)).toEqual([]);
        expect(recordLegacyPathUsage(null, 'x')).toBe(null);

        const target = {};
        expect(recordLegacyPathUsage(target, '')).toBe(null);
        expect(getLegacyPathUsageSnapshot(target)).toEqual([]);
    });

    it('clears tracked usage entries', () => {
        const target = {};
        recordLegacyPathUsage(target, 'classroom.mode.legacy-bool-read');
        expect(getLegacyPathUsageSnapshot(target)).toHaveLength(1);

        const removed = clearLegacyPathUsage(target);
        expect(removed).toBe(1);
        expect(getLegacyPathUsageSnapshot(target)).toEqual([]);
    });
});
