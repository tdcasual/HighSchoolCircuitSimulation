#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function fail(message) {
    console.error(`[ci-workflow] ${message}`);
    process.exit(1);
}

const workflowPath = '.github/workflows/ci.yml';
const workflowAbsPath = path.resolve(root, workflowPath);
if (!existsSync(workflowAbsPath)) {
    fail(`missing file: ${workflowPath}`);
}

const content = readFileSync(workflowAbsPath, 'utf8');

const requiredSnippets = [
    'quality:',
    'wire-e2e:',
    'Run reliability regression gate',
    'npm run test:reliability',
    'Run quality checks and regressions',
    'npm run check:full',
    'Check release docs integrity',
    'node scripts/ci/assert-release-doc-integrity.mjs',
    'Check interaction guide sync',
    'node scripts/ci/assert-interaction-guide-sync.mjs',
    'Check registry legacy fallback guard',
    'node scripts/ci/assert-registry-legacy-fallback-guard.mjs',
    'Check CI workflow coverage',
    'node scripts/ci/assert-ci-workflow-coverage.mjs',
    'Run wire interaction E2E',
    'npm run test:e2e:wire'
];

for (const snippet of requiredSnippets) {
    if (!content.includes(snippet)) {
        fail(`missing required snippet: ${snippet}`);
    }
}

console.log('[ci-workflow] ok');
