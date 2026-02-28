#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function fail(message) {
    console.error(`[docs-integrity] ${message}`);
    process.exit(1);
}

function readText(relPath) {
    const absPath = path.resolve(root, relPath);
    if (!existsSync(absPath)) {
        fail(`missing file: ${relPath}`);
    }
    return readFileSync(absPath, 'utf8');
}

const reviewPath = 'docs/audits/mobile/2026-03-29-day28-release-readiness-review.md';
const review = readText(reviewPath);

if (!review.includes('Date: 2026-03-29')) {
    fail(`${reviewPath} must declare Date: 2026-03-29`);
}

const requiredDocRefs = [
    'docs/releases/v0.9-qa-checklist.md',
    'docs/releases/v0.9-rc1-release-notes.md',
    'docs/releases/v0.9-rollback-plan.md'
];

for (const relPath of requiredDocRefs) {
    if (!review.includes(relPath)) {
        fail(`${reviewPath} missing reference: ${relPath}`);
    }
    if (!existsSync(path.resolve(root, relPath))) {
        fail(`referenced doc does not exist: ${relPath}`);
    }
}

const requiredOutputRefs = [
    'output/baselines/p0-electrical-current.json',
    'output/baselines/circuitjs-golden-10-current.json',
    'output/baselines/ai-eval-current.json'
];

for (const relPath of requiredOutputRefs) {
    if (!review.includes(relPath)) {
        fail(`${reviewPath} missing output reference: ${relPath}`);
    }
}

console.log('[docs-integrity] ok');
