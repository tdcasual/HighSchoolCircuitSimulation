#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RingBuffer2D } from '../../src/ui/observation/ObservationMath.js';
import { ObservationChartInteraction } from '../../src/ui/observation/ObservationChartInteraction.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const outputDir = path.join(projectRoot, 'output', 'benchmarks', 'observation-stress');
const jsonPath = path.join(outputDir, 'observation-stress-regression.json');
const reportPath = path.join(outputDir, 'observation-stress-regression.md');

function assertCondition(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function round(value, digits = 3) {
    const p = 10 ** digits;
    return Math.round(value * p) / p;
}

async function main() {
    const totalSamples = 200000;
    const queryCount = 200;
    const buffer = new RingBuffer2D(totalSamples);
    for (let i = 0; i < totalSamples; i += 1) {
        const x = i * 0.001;
        buffer.push(x, Math.sin(x));
    }

    const interaction = new ObservationChartInteraction();
    const t0 = Date.now();
    let maxSamplesVisited = 0;
    let totalSamplesVisited = 0;
    let maxError = 0;

    for (let i = 0; i < queryCount; i += 1) {
        const normalized = queryCount <= 1 ? 0 : i / (queryCount - 1);
        const targetX = normalized * (totalSamples - 1) * 0.001;
        const result = interaction.findNearestSampleByX(buffer, targetX);
        const nearestX = Number(result?.point?.x);
        const error = Number.isFinite(nearestX) ? Math.abs(nearestX - targetX) : Infinity;
        const visited = Number(result?.stats?.samplesVisited) || 0;

        maxSamplesVisited = Math.max(maxSamplesVisited, visited);
        totalSamplesVisited += visited;
        maxError = Math.max(maxError, error);
    }
    const elapsedMs = Date.now() - t0;
    const averageSamplesVisited = queryCount > 0 ? totalSamplesVisited / queryCount : 0;

    assertCondition(maxSamplesVisited <= 80, `lookup samples budget exceeded: ${maxSamplesVisited}`);
    assertCondition(maxError <= 0.002, `nearest lookup accuracy regression: ${maxError}`);

    const summary = {
        generatedAt: new Date().toISOString(),
        totalSamples,
        queryCount,
        elapsedMs,
        maxSamplesVisited,
        averageSamplesVisited: round(averageSamplesVisited, 3),
        maxError: round(maxError, 6)
    };

    await mkdir(outputDir, { recursive: true });
    await writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
    const lines = [
        '# Observation Stress Regression',
        '',
        `Generated at: ${summary.generatedAt}`,
        '',
        '## Workload',
        `- Samples: ${summary.totalSamples}`,
        `- Queries: ${summary.queryCount}`,
        '',
        '## Results',
        `- Elapsed: ${summary.elapsedMs} ms`,
        `- Max sampled points per lookup: ${summary.maxSamplesVisited}`,
        `- Average sampled points per lookup: ${summary.averageSamplesVisited}`,
        `- Max absolute x-error: ${summary.maxError}`,
        '',
        '## Gate',
        '- `maxSamplesVisited <= 80`',
        '- `maxError <= 0.002`'
    ];
    await writeFile(reportPath, `${lines.join('\n')}\n`, 'utf8');

    console.log('Observation stress regression passed.');
    console.log(`JSON: ${jsonPath}`);
    console.log(`Report: ${reportPath}`);
}

main().catch((error) => {
    console.error('[observation-stress] FAILED');
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = 1;
});
