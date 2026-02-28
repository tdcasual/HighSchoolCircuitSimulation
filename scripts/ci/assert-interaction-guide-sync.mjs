#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function fail(message) {
    console.error(`[interaction-guide-sync] ${message}`);
    process.exit(1);
}

function readText(relPath) {
    const absPath = path.resolve(root, relPath);
    if (!existsSync(absPath)) {
        fail(`missing file: ${relPath}`);
    }
    return readFileSync(absPath, 'utf8');
}

const guidePath = 'docs/process/component-interaction-usage-guide.md';
const guide = readText(guidePath);

const requiredGuideItems = [
    'Alt + 拖动端子',
    'Ctrl/Cmd + 点击导线'
];

for (const item of requiredGuideItems) {
    if (!guide.includes(item)) {
        fail(`${guidePath} missing item: ${item}`);
    }
}

const orchestratorSpec = readText('tests/interaction.orchestrator.spec.js');
if (orchestratorSpec.includes('alt+terminal drag to extend terminal lead') && !guide.includes('Alt + 拖动端子')) {
    fail('guide missing terminal extension interaction while orchestrator test expects it');
}

const wireSnapSpec = readText('tests/interaction.wireSegmentSnap.spec.js');
if (wireSnapSpec.includes('splits wire on ctrl/cmd click instead of dragging') && !guide.includes('Ctrl/Cmd + 点击导线')) {
    fail('guide missing wire split interaction while wire snap test expects it');
}

console.log('[interaction-guide-sync] ok');
