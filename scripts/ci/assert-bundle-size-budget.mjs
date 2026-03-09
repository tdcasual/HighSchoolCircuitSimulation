#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const bundleReportPath = 'dist/bundle-size-report.json';
const MAIN_HARD_MAX_BYTES = 400 * 1024;
const MAIN_TARGET_MAX_BYTES = 360 * 1024;
const TOTAL_HARD_MAX_BYTES = 620 * 1024;
const TOTAL_TARGET_MAX_BYTES = 580 * 1024;

function fail(message) {
    console.error(`[bundle-size] ${message}`);
    process.exit(1);
}

function formatKiB(bytes) {
    return `${(Number(bytes || 0) / 1024).toFixed(1)} KiB`;
}

const reportAbsPath = path.resolve(root, bundleReportPath);
if (!existsSync(reportAbsPath)) {
    fail(`missing report: ${bundleReportPath}; run "npm run build:frontend" first`);
}

let report;
try {
    report = JSON.parse(readFileSync(reportAbsPath, 'utf8'));
} catch (error) {
    fail(`cannot parse ${bundleReportPath}: ${error?.message || error}`);
}

const mainBytes = Number(report?.mainBundle?.bytes);
const totalBytes = Number(report?.totals?.jsBytes);
if (!Number.isFinite(mainBytes) || !Number.isFinite(totalBytes)) {
    fail(`invalid report shape in ${bundleReportPath}`);
}

if (mainBytes > MAIN_HARD_MAX_BYTES) {
    fail(`main bundle exceeds hard budget: ${formatKiB(mainBytes)} > ${formatKiB(MAIN_HARD_MAX_BYTES)}`);
}
if (totalBytes > TOTAL_HARD_MAX_BYTES) {
    fail(`total js output exceeds hard budget: ${formatKiB(totalBytes)} > ${formatKiB(TOTAL_HARD_MAX_BYTES)}`);
}

const mainWarn = mainBytes > MAIN_TARGET_MAX_BYTES;
const totalWarn = totalBytes > TOTAL_TARGET_MAX_BYTES;
if (mainWarn) {
    console.warn(`[bundle-size] warning main target exceeded: ${formatKiB(mainBytes)} > ${formatKiB(MAIN_TARGET_MAX_BYTES)}`);
} else {
    console.log(`[bundle-size] ok main: ${formatKiB(mainBytes)} / ${formatKiB(MAIN_TARGET_MAX_BYTES)} target`);
}
if (totalWarn) {
    console.warn(`[bundle-size] warning total target exceeded: ${formatKiB(totalBytes)} > ${formatKiB(TOTAL_TARGET_MAX_BYTES)}`);
} else {
    console.log(`[bundle-size] ok total: ${formatKiB(totalBytes)} / ${formatKiB(TOTAL_TARGET_MAX_BYTES)} target`);
}

console.log(`[bundle-size] hard main budget: ${formatKiB(mainBytes)} / ${formatKiB(MAIN_HARD_MAX_BYTES)}`);
console.log(`[bundle-size] hard total budget: ${formatKiB(totalBytes)} / ${formatKiB(TOTAL_HARD_MAX_BYTES)}`);
