#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const budgets = [
    { file: 'src/core/runtime/Circuit.js', hardMaxLines: 1400, targetMaxLines: 1300, track: 'core runtime hotspot' },
    { file: 'src/components/Component.js', hardMaxLines: 1200, targetMaxLines: 1100, track: 'component hotspot' },
    { file: 'src/ui/charts/ChartWindowController.js', hardMaxLines: 450, targetMaxLines: 360, track: 'chart hotspot' },
    { file: 'src/app/interaction/InteractionOrchestrator.js', hardMaxLines: 300, targetMaxLines: 240, track: 'interaction hotspot' },
    { file: 'src/core/simulation/MNASolver.js', hardMaxLines: 650, targetMaxLines: 550, track: 'simulation hotspot' },
    { file: 'src/app/AppRuntimeV2.js', hardMaxLines: 575, targetMaxLines: 500, track: 'runtime hotspot', optional: true },
    { file: 'src/v2/domain/CircuitModel.js', hardMaxLines: 800, targetMaxLines: 650, track: 'v2 core', optional: true },
    { file: 'src/v2/simulation/CircuitSolverV2.js', hardMaxLines: 800, targetMaxLines: 650, track: 'v2 core', optional: true },
    { file: 'src/v2/infra/io/CircuitDeserializerV3.js', hardMaxLines: 800, targetMaxLines: 650, track: 'v2 core', optional: true }
];

function fail(message) {
    console.error(`[core-size] ${message}`);
    process.exit(1);
}

let hasWarning = false;
for (const budget of budgets) {
    const absolutePath = path.resolve(root, budget.file);
    if (!existsSync(absolutePath)) {
        if (budget.optional) {
            console.log(`[core-size] skip ${budget.file}: pending ${budget.track}`);
            continue;
        }
        fail(`missing file: ${budget.file}`);
    }

    const lineCount = readFileSync(absolutePath, 'utf8').split(/\r?\n/u).length;
    if (lineCount > budget.hardMaxLines) {
        fail(`${budget.file} exceeds hard budget: ${lineCount} > ${budget.hardMaxLines}`);
    }

    if (lineCount > budget.targetMaxLines) {
        hasWarning = true;
        console.warn(
            `[core-size] warning ${budget.file}: ${lineCount}/${budget.hardMaxLines} hard, `
            + `${budget.targetMaxLines} target (${budget.track})`
        );
        continue;
    }

    const percentage = Math.round((lineCount / budget.hardMaxLines) * 100);
    console.log(
        `[core-size] ok ${budget.file}: ${lineCount}/${budget.hardMaxLines} `
        + `(${percentage}%, ${budget.track})`
    );
}

if (hasWarning) {
    console.log('[core-size] within hard budget, but one or more files exceed target size');
    process.exit(0);
}

console.log('[core-size] all core files are within hard and target budgets');
