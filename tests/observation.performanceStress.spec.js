import { describe, expect, it } from 'vitest';
import { RingBuffer2D } from '../src/ui/observation/ObservationMath.js';
import { ObservationChartInteraction } from '../src/ui/observation/ObservationChartInteraction.js';

describe('Observation linked-cursor stress performance', () => {
    it('keeps linked cursor lookup under defined budget for large sample set', () => {
        const totalSamples = 200000;
        const buffer = new RingBuffer2D(totalSamples);
        for (let i = 0; i < totalSamples; i += 1) {
            const x = i * 0.001;
            const y = Math.sin(x);
            buffer.push(x, y);
        }

        const interaction = new ObservationChartInteraction();
        const targetX = 123.456;
        const result = interaction.findNearestSampleByX(buffer, targetX);

        expect(result?.point).toBeTruthy();
        expect(Math.abs((result?.point?.x || 0) - targetX)).toBeLessThanOrEqual(0.0015);
        expect(result?.stats?.strategy).toBe('monotonic-binary');
        expect(result?.stats?.samplesVisited || 0).toBeLessThanOrEqual(80);
    });
});
