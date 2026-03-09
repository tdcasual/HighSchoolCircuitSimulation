#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const mode = 'hard';
const generatorRelPath = 'scripts/ci/generate-debt-dashboard.mjs';
const dashboardRelPath = 'docs/reports/debt-dashboard.json';
const requiredHotspotFiles = [
    'src/core/runtime/Circuit.js',
    'src/components/Component.js',
    'src/ui/charts/ChartWindowController.js',
    'src/app/interaction/InteractionOrchestrator.js',
    'src/core/simulation/MNASolver.js',
    'src/app/AppRuntimeV2.js'
];

function fail(message) {
    console.error(`[maintainability] ${message}`);
    process.exit(1);
}

function runNode(scriptRelPath) {
    const result = spawnSync('node', [scriptRelPath], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 20 * 1024 * 1024
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.status !== 0) {
        fail(`dependency command failed: node ${scriptRelPath}`);
    }
}

function assertNumber(value, label) {
    if (!Number.isFinite(value)) {
        fail(`missing numeric metric: ${label}`);
    }
}

function assertStatus(value, label) {
    if (!/^(ok|warn|fail)$/u.test(String(value || ''))) {
        fail(`invalid status for ${label}`);
    }
}

function formatKiB(value) {
    return value == null || !Number.isFinite(value) ? 'n/a' : `${Number(value).toFixed(1)} KiB`;
}

runNode(generatorRelPath);

const dashboardAbsPath = path.resolve(root, dashboardRelPath);
if (!existsSync(dashboardAbsPath)) {
    fail(`missing report: ${dashboardRelPath}`);
}

let report;
try {
    report = JSON.parse(readFileSync(dashboardAbsPath, 'utf8'));
} catch (error) {
    fail(`cannot parse ${dashboardRelPath}: ${error?.message || String(error)}`);
}

if (typeof report?.generatedAt !== 'string' || !report.generatedAt.trim()) {
    fail('missing generatedAt');
}

assertStatus(report?.lint?.status, 'lint');
assertNumber(report?.lint?.errorCount, 'lint.errorCount');
assertNumber(report?.lint?.boundaryErrors, 'lint.boundaryErrors');
assertNumber(report?.lint?.protectedWarnings, 'lint.protectedWarnings');

assertStatus(report?.hotspots?.status, 'hotspots');
if (!Array.isArray(report?.hotspots?.files)) {
    fail('missing hotspots.files');
}
for (const requiredFile of requiredHotspotFiles) {
    if (!report.hotspots.files.some((entry) => entry?.file === requiredFile)) {
        fail(`missing hotspot entry: ${requiredFile}`);
    }
}

assertStatus(report?.bundle?.status, 'bundle');
if (!(report.bundle.mainKiB === null || Number.isFinite(report.bundle.mainKiB))) {
    fail('invalid bundle.mainKiB');
}
if (!(report.bundle.totalKiB === null || Number.isFinite(report.bundle.totalKiB))) {
    fail('invalid bundle.totalKiB');
}

assertStatus(report?.shimInventory?.status, 'shimInventory');
assertNumber(report?.shimInventory?.count, 'shimInventory.count');
assertNumber(Number(report?.shimInventory?.baseline || 0), 'shimInventory.baseline');
assertNumber(Number(report?.shimInventory?.growth || 0), 'shimInventory.growth');

const hotspotSummary = report.hotspots.summary || {};
assertNumber(Number(hotspotSummary.fail || 0), 'hotspots.summary.fail');
assertNumber(Number(hotspotSummary.warn || 0), 'hotspots.summary.warn');
assertNumber(Number(hotspotSummary.ok || 0), 'hotspots.summary.ok');

console.log(`[maintainability] mode=${mode}`);
console.log(
    `[maintainability] lint errors=${report.lint.errorCount}, `
    + `boundaryErrors=${report.lint.boundaryErrors}, `
    + `warnings=${report.lint.protectedWarnings} (${report.lint.status})`
);
console.log(
    `[maintainability] hotspots fail=${hotspotSummary.fail || 0}, `
    + `warn=${hotspotSummary.warn || 0}, ok=${hotspotSummary.ok || 0} (${report.hotspots.status})`
);
console.log(
    `[maintainability] bundle main=${formatKiB(report.bundle.mainKiB)}, `
    + `total=${formatKiB(report.bundle.totalKiB)} (${report.bundle.status})`
);
console.log(
    `[maintainability] shims=${report.shimInventory.count}, `
    + `baseline=${report.shimInventory.baseline}, growth=${report.shimInventory.growth} (${report.shimInventory.status})`
);

const failures = [];
if (report.lint.errorCount > 0) {
    failures.push('lint errors present');
}
if (report.lint.protectedWarnings > 0) {
    failures.push('protected warnings present');
}
if (Number(hotspotSummary.fail || 0) > 0) {
    failures.push('hotspot hard budget exceeded');
}
if (report.bundle.status === 'fail') {
    failures.push('bundle hard budget exceeded');
}
if (Number(report.shimInventory.growth || 0) > 0) {
    failures.push('shim inventory grew');
}

if (failures.length > 0) {
    fail(`hard gate failed: ${failures.join('; ')}`);
}

console.log('[maintainability] ok');
