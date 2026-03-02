#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const budgets = [
    { file: 'src/engine/Circuit.js', maxLines: 2000 },
    { file: 'src/components/Component.js', maxLines: 1700 },
    { file: 'src/ui/ObservationPanel.js', maxLines: 1650 }
];

function fail(message) {
    console.error(`[core-size] ${message}`);
    process.exit(1);
}

let hasWarning = false;
for (const budget of budgets) {
    const absolutePath = path.resolve(root, budget.file);
    if (!existsSync(absolutePath)) {
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
        console.warn(`[core-size] warning ${budget.file}: ${lineCount}/${budget.maxLines} (${percentage}%)`);
    } else {
        console.log(`[core-size] ok ${budget.file}: ${lineCount}/${budget.maxLines} (${percentage}%)`);
    }
}

if (hasWarning) {
    console.log('[core-size] within budget, but one or more files are close to the limit');
    process.exit(0);
}

console.log('[core-size] all core files are within budget');
