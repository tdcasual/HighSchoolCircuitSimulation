import { describe, it, expect } from 'vitest';
import { applyTransform, computeNiceTicks, computeRangeFromBuffer, RingBuffer2D, TransformIds } from '../src/ui/observation/ObservationMath.js';

describe('ObservationMath', () => {
    it('applyTransform supports identity/abs/negate', () => {
        expect(applyTransform(2, TransformIds.Identity)).toBe(2);
        expect(applyTransform(-2, TransformIds.Abs)).toBe(2);
        expect(applyTransform(2, TransformIds.Negate)).toBe(-2);
    });

    it('applyTransform reciprocal returns null near zero', () => {
        expect(applyTransform(0, TransformIds.Reciprocal)).toBeNull();
        expect(applyTransform(1e-20, TransformIds.Reciprocal)).toBeNull();
        expect(applyTransform(2, TransformIds.Reciprocal)).toBeCloseTo(0.5, 12);
    });

    it('RingBuffer2D keeps newest points and overwrites oldest', () => {
        const buf = new RingBuffer2D(3);
        buf.push(1, 10);
        buf.push(2, 20);
        buf.push(3, 30);
        expect(buf.length).toBe(3);

        buf.push(4, 40);
        expect(buf.length).toBe(3);

        expect(buf.getPoint(0)).toEqual({ x: 2, y: 20 });
        expect(buf.getPoint(1)).toEqual({ x: 3, y: 30 });
        expect(buf.getPoint(2)).toEqual({ x: 4, y: 40 });
    });

    it('computeRangeFromBuffer returns min/max', () => {
        const buf = new RingBuffer2D(10);
        buf.push(3, 9);
        buf.push(-1, 5);
        buf.push(2, -4);
        const r = computeRangeFromBuffer(buf);
        expect(r).toEqual({ minX: -1, maxX: 3, minY: -4, maxY: 9 });
    });

    it('computeRangeFromBuffer stays correct after ring overwrite', () => {
        const buf = new RingBuffer2D(3);
        buf.push(1, 10);
        buf.push(2, 20);
        buf.push(3, 30);
        expect(computeRangeFromBuffer(buf)).toEqual({ minX: 1, maxX: 3, minY: 10, maxY: 30 });

        // 覆盖掉当前最小值点（1,10），范围应自动更新到剩余窗口
        buf.push(4, 15);
        expect(computeRangeFromBuffer(buf)).toEqual({ minX: 2, maxX: 4, minY: 15, maxY: 30 });
    });

    it('RingBuffer2D forEachSampled iterates by step', () => {
        const buf = new RingBuffer2D(8);
        for (let i = 0; i < 6; i++) {
            buf.push(i, i * 10);
        }

        const points = [];
        buf.forEachSampled(2, (x, y, index) => {
            points.push({ x, y, index });
        });

        expect(points).toEqual([
            { x: 0, y: 0, index: 0 },
            { x: 2, y: 20, index: 2 },
            { x: 4, y: 40, index: 4 }
        ]);
    });

    it('computeNiceTicks returns a reasonable sequence', () => {
        const ticks = computeNiceTicks(0.12, 9.87, 5);
        expect(ticks.length).toBeGreaterThanOrEqual(2);
        for (let i = 1; i < ticks.length; i++) {
            expect(ticks[i]).toBeGreaterThan(ticks[i - 1]);
        }
        expect(ticks[0]).toBeLessThanOrEqual(0.12);
        expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(9.87);
    });
});
