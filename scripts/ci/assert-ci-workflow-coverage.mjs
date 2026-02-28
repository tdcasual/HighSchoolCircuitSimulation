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

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getJobBlock(source, jobName) {
    const jobHeaderRegex = new RegExp(`^  ${escapeRegex(jobName)}:\\n`, 'm');
    const headerMatch = jobHeaderRegex.exec(source);
    if (!headerMatch) {
        fail(`missing required job: ${jobName}`);
    }

    const jobStart = headerMatch.index;
    const nextJobRegex = /^\s{2}[a-z0-9_-]+:\n/gm;
    nextJobRegex.lastIndex = jobStart + 1;
    const nextMatch = nextJobRegex.exec(source);
    const jobEnd = nextMatch ? nextMatch.index : source.length;

    return source.slice(jobStart, jobEnd);
}

function parseNamedSteps(jobBlock) {
    const steps = [];
    const stepRegex = /^\s{6}- name:\s*(.+)\n([\s\S]*?)(?=^\s{6}- name:\s*.+\n|\s*$)/gm;
    let match = stepRegex.exec(jobBlock);
    while (match) {
        steps.push({
            name: match[1].trim(),
            body: match[2]
        });
        match = stepRegex.exec(jobBlock);
    }
    return steps;
}

function assertStepRun(steps, jobName, stepName, runCommand) {
    const step = steps.find((entry) => entry.name === stepName);
    if (!step) {
        fail(`missing required step in ${jobName}: ${stepName}`);
    }

    const expectedRunLine = `run: ${runCommand}`;
    if (!step.body.includes(expectedRunLine)) {
        fail(`${jobName} -> ${stepName} missing run command: ${runCommand}`);
    }
}

function assertStepOrder(steps, jobName, stepNames) {
    const indices = stepNames.map((name) => {
        const idx = steps.findIndex((entry) => entry.name === name);
        if (idx < 0) {
            fail(`missing required step in ${jobName}: ${name}`);
        }
        return idx;
    });
    for (let i = 1; i < indices.length; i += 1) {
        if (indices[i] <= indices[i - 1]) {
            fail(`${jobName} steps out of order: ${stepNames[i - 1]} -> ${stepNames[i]}`);
        }
    }
}

const qualityJob = getJobBlock(content, 'quality');
const wireE2EJob = getJobBlock(content, 'wire-e2e');

const qualitySteps = parseNamedSteps(qualityJob);
const wireSteps = parseNamedSteps(wireE2EJob);

assertStepRun(
    qualitySteps,
    'quality',
    'Check release docs integrity',
    'node scripts/ci/assert-release-doc-integrity.mjs'
);
assertStepRun(
    qualitySteps,
    'quality',
    'Check interaction guide sync',
    'node scripts/ci/assert-interaction-guide-sync.mjs'
);
assertStepRun(
    qualitySteps,
    'quality',
    'Check registry legacy fallback guard',
    'node scripts/ci/assert-registry-legacy-fallback-guard.mjs'
);
assertStepRun(
    qualitySteps,
    'quality',
    'Check CI workflow coverage',
    'node scripts/ci/assert-ci-workflow-coverage.mjs'
);
assertStepRun(
    qualitySteps,
    'quality',
    'Run reliability regression gate',
    'npm run test:reliability'
);
assertStepRun(
    qualitySteps,
    'quality',
    'Run quality checks and regressions',
    'npm run check:full'
);

assertStepOrder(qualitySteps, 'quality', [
    'Check release docs integrity',
    'Check interaction guide sync',
    'Check registry legacy fallback guard',
    'Check CI workflow coverage',
    'Run reliability regression gate',
    'Run quality checks and regressions'
]);

assertStepRun(
    wireSteps,
    'wire-e2e',
    'Run wire interaction E2E',
    'npm run test:e2e:wire'
);

const requiredJobSnippets = [
    'quality:',
    'wire-e2e:',
    'wire-e2e-screenshots',
    'output/e2e/wire-interaction'
];

for (const snippet of requiredJobSnippets) {
    if (!content.includes(snippet)) {
        fail(`missing required workflow snippet: ${snippet}`);
    }
}

console.log('[ci-workflow] ok');
