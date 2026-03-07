import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('mobile core learning e2e contract', () => {
    it('defines a dedicated task KPI script for place -> wire -> run -> observe flow', () => {
        const source = readFileSync(resolve(process.cwd(), 'scripts/e2e/mobile-core-learning-flow.mjs'), 'utf8');

        expect(source).toContain('createMobileFlowMetricsCollector');
        expect(source).toContain('summarizeMobileFlowMetrics');
        expect(source).toContain('place-power-source');
        expect(source).toContain('place-resistor');
        expect(source).toContain('wire-series-loop');
        expect(source).toContain('run-simulation');
        expect(source).toContain('observe-readout');
        expect(source).toContain('measure-current');
        expect(source).toContain('measure-voltage');
        expect(source).toContain('measure-power');
        expect(source).toContain('interactionCount');
    });

    it('keeps responsive touch baseline script alongside the new task KPI path', () => {
        const source = readFileSync(resolve(process.cwd(), 'scripts/e2e/responsive-touch-regression.mjs'), 'utf8');

        expect(source).toContain('mobile-flow-baseline.json');
        expect(source).toContain('createMobileFlowMetricsCollector');
        expect(source).toContain('summarizeMobileFlowMetrics');
    });
});
