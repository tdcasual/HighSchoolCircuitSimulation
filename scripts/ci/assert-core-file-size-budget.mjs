#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const legacyTransitionalBudgets = [
    { file: 'src/engine/Circuit.js', maxLines: 2000, track: 'legacy transitional' },
    { file: 'src/components/Component.js', maxLines: 1500, track: 'legacy transitional' },
    { file: 'src/ui/charts/ChartWindowController.js', maxLines: 700, track: 'legacy transitional' },
    { file: 'src/app/interaction/InteractionOrchestrator.js', maxLines: 400, track: 'legacy transitional' }
];

const v2CoreBudgets = [
    { file: 'src/v2/app/AppRuntimeV2.js', maxLines: 800, track: 'v2 core', optional: true },
    { file: 'src/v2/domain/CircuitModel.js', maxLines: 800, track: 'v2 core', optional: true },
    { file: 'src/v2/simulation/CircuitSolverV2.js', maxLines: 800, track: 'v2 core', optional: true },
    { file: 'src/v2/infra/io/CircuitDeserializerV3.js', maxLines: 800, track: 'v2 core', optional: true }
];

const budgets = [...legacyTransitionalBudgets, ...v2CoreBudgets];

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
    const ratio = lineCount / budget.maxLines;
    const percentage = Math.round(ratio * 100);
    if (lineCount > budget.maxLines) {
        fail(`${budget.file} exceeds budget: ${lineCount} > ${budget.maxLines}`);
    }

    if (percentage >= 95) {
        hasWarning = true;
        console.warn(
            `[core-size] warning ${budget.file}: ${lineCount}/${budget.maxLines} `
            + `(${percentage}%, ${budget.track})`
        );
    } else {
        console.log(
            `[core-size] ok ${budget.file}: ${lineCount}/${budget.maxLines} `
            + `(${percentage}%, ${budget.track})`
        );
    }
}

if (hasWarning) {
    console.log('[core-size] within budget, but one or more files are close to the limit');
    process.exit(0);
}

console.log('[core-size] all core files are within budget');
