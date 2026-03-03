#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const bundleReportPath = 'dist/bundle-size-report.json';
const MAIN_MAX_BYTES = 400 * 1024;
const TOTAL_MAX_BYTES = 520 * 1024;

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

if (mainBytes > MAIN_MAX_BYTES) {
    fail(`main bundle exceeds budget: ${formatKiB(mainBytes)} > ${formatKiB(MAIN_MAX_BYTES)}`);
}
if (totalBytes > TOTAL_MAX_BYTES) {
    fail(`total js output exceeds budget: ${formatKiB(totalBytes)} > ${formatKiB(TOTAL_MAX_BYTES)}`);
}

console.log(`[bundle-size] ok main: ${formatKiB(mainBytes)} / ${formatKiB(MAIN_MAX_BYTES)}`);
console.log(`[bundle-size] ok total: ${formatKiB(totalBytes)} / ${formatKiB(TOTAL_MAX_BYTES)}`);
