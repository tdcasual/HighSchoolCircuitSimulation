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
const packagePath = 'package.json';
const packageAbsPath = path.resolve(root, packagePath);
if (!existsSync(packageAbsPath)) {
    fail(`missing file: ${packagePath}`);
}
const pkg = JSON.parse(readFileSync(packageAbsPath, 'utf8'));
const packageScripts = pkg && typeof pkg === 'object' && pkg.scripts && typeof pkg.scripts === 'object'
    ? pkg.scripts
    : {};

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
    const headers = [];
    const headerRegex = /^\s{6}- name:\s*(.+)$/gm;
    let match = headerRegex.exec(jobBlock);
    while (match) {
        headers.push({
            name: match[1].trim(),
            index: match.index,
            bodyStart: match.index + match[0].length + 1
        });
        match = headerRegex.exec(jobBlock);
    }

    const steps = [];
    for (let i = 0; i < headers.length; i += 1) {
        const current = headers[i];
        const next = headers[i + 1];
        const bodyEnd = next ? next.index : jobBlock.length;
        steps.push({
            name: current.name,
            body: jobBlock.slice(current.bodyStart, bodyEnd)
        });
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

function assertStepContains(steps, jobName, stepName, requiredSnippets = []) {
    const step = steps.find((entry) => entry.name === stepName);
    if (!step) {
        fail(`missing required step in ${jobName}: ${stepName}`);
    }

    for (const snippet of requiredSnippets) {
        if (!step.body.includes(snippet)) {
            fail(`${jobName} -> ${stepName} missing snippet: ${snippet}`);
        }
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

function assertNpmScriptExists(scriptName) {
    if (!Object.prototype.hasOwnProperty.call(packageScripts, scriptName)) {
        fail(`package.json missing npm script required by workflow: ${scriptName}`);
    }
}

function assertWorkflowNpmRunCommandsExistInPackage(source) {
    const runRegex = /^\s*run:\s*npm run ([a-z0-9:._-]+)\s*$/gm;
    let match = runRegex.exec(source);
    while (match) {
        assertNpmScriptExists(match[1]);
        match = runRegex.exec(source);
    }
}

const qualityJob = getJobBlock(content, 'quality');
const wireE2EJob = getJobBlock(content, 'wire-e2e');
const responsiveE2EJob = getJobBlock(content, 'responsive-e2e');
const observationE2EJob = getJobBlock(content, 'observation-e2e');
const modeConflictMatrixE2EJob = getJobBlock(content, 'mode-conflict-matrix-e2e');

const qualitySteps = parseNamedSteps(qualityJob);
const wireSteps = parseNamedSteps(wireE2EJob);
const responsiveSteps = parseNamedSteps(responsiveE2EJob);
const observationSteps = parseNamedSteps(observationE2EJob);
const modeConflictMatrixSteps = parseNamedSteps(modeConflictMatrixE2EJob);

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
assertStepRun(
    responsiveSteps,
    'responsive-e2e',
    'Run responsive touch E2E',
    'npm run test:e2e:responsive'
);
assertStepRun(
    observationSteps,
    'observation-e2e',
    'Run observation touch E2E',
    'npm run test:e2e:observation'
);
assertStepRun(
    modeConflictMatrixSteps,
    'mode-conflict-matrix-e2e',
    'Run mode conflict matrix E2E',
    'npm run mode-conflict-matrix'
);
assertStepContains(
    responsiveSteps,
    'responsive-e2e',
    'Upload responsive E2E screenshots on failure',
    [
        'if: failure()',
        'uses: actions/upload-artifact@v4',
        'name: responsive-e2e-screenshots',
        'path: output/e2e/responsive-touch'
    ]
);
assertStepContains(
    wireSteps,
    'wire-e2e',
    'Upload wire E2E screenshots on failure',
    [
        'if: failure()',
        'uses: actions/upload-artifact@v4',
        'name: wire-e2e-screenshots',
        'path: output/e2e/wire-interaction'
    ]
);
assertStepContains(
    observationSteps,
    'observation-e2e',
    'Upload observation E2E screenshots on failure',
    [
        'if: failure()',
        'uses: actions/upload-artifact@v4',
        'name: observation-e2e-screenshots',
        'path: output/e2e/observation-touch'
    ]
);
assertStepContains(
    modeConflictMatrixSteps,
    'mode-conflict-matrix-e2e',
    'Upload mode conflict matrix artifacts on failure',
    [
        'if: failure()',
        'uses: actions/upload-artifact@v4',
        'name: mode-conflict-matrix-artifacts',
        'path: output/e2e/mode-conflict'
    ]
);

const requiredJobSnippets = [
    'quality:',
    'responsive-e2e:',
    'wire-e2e:',
    'observation-e2e:',
    'mode-conflict-matrix-e2e:',
    'responsive-e2e-screenshots',
    'wire-e2e-screenshots',
    'observation-e2e-screenshots',
    'mode-conflict-matrix-artifacts',
    'output/e2e/responsive-touch',
    'output/e2e/wire-interaction',
    'output/e2e/observation-touch',
    'output/e2e/mode-conflict'
];

for (const snippet of requiredJobSnippets) {
    if (!content.includes(snippet)) {
        fail(`missing required workflow snippet: ${snippet}`);
    }
}

assertWorkflowNpmRunCommandsExistInPackage(content);

console.log('[ci-workflow] ok');
