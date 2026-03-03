#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const outputJsonRelPath = 'docs/reports/debt-dashboard.json';
const outputMarkdownRelPath = 'docs/reports/debt-dashboard.md';
const bundleReportRelPath = 'dist/bundle-size-report.json';

const SAFE_INVOKE_MAX = 15;
const V2_LOCAL_SAFE_INVOKE_MAX = 0;
const MAIN_BUNDLE_MAX_BYTES = 400 * 1024;
const TOTAL_BUNDLE_MAX_BYTES = 520 * 1024;

const CORE_FILE_BUDGETS = [
    { file: 'src/core/runtime/Circuit.js', maxLines: 2000 },
    { file: 'src/components/Component.js', maxLines: 1500 },
    { file: 'src/ui/charts/ChartWindowController.js', maxLines: 700 },
    { file: 'src/app/interaction/InteractionOrchestrator.js', maxLines: 400 },
    { file: 'src/app/AppRuntimeV2.js', maxLines: 800 }
];

function formatKiB(bytes) {
    return `${(Number(bytes || 0) / 1024).toFixed(1)} KiB`;
}

function lineCount(text) {
    return String(text).split(/\r?\n/u).length;
}

function countPattern(source, pattern) {
    return [...String(source).matchAll(pattern)].length;
}

async function listFilesRecursive(directory, extensions = new Set(['.js', '.mjs', '.cjs'])) {
    const absDirectory = path.resolve(root, directory);
    const queue = [absDirectory];
    const results = [];

    while (queue.length > 0) {
        const current = queue.pop();
        const entries = await readdir(current, { withFileTypes: true });
        for (const entry of entries) {
            const absPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                queue.push(absPath);
                continue;
            }
            if (!entry.isFile()) {
                continue;
            }
            const ext = path.extname(entry.name).toLowerCase();
            if (extensions.has(ext)) {
                results.push(absPath);
            }
        }
    }

    return results.sort();
}

async function collectSafeInvokeDebt() {
    const files = await listFilesRecursive('src');
    const matches = [];
    let count = 0;

    for (const absPath of files) {
        const source = readFileSync(absPath, 'utf8');
        const hitCount = countPattern(source, /function safeInvokeMethod\(/gu);
        if (hitCount > 0) {
            const relPath = path.relative(root, absPath).replaceAll('\\', '/');
            matches.push({ file: relPath, count: hitCount });
            count += hitCount;
        }
    }

    return {
        status: count > SAFE_INVOKE_MAX ? 'fail' : 'ok',
        count,
        max: SAFE_INVOKE_MAX,
        files: matches
    };
}

async function collectV2SafeInvokeDebt() {
    const v2RootStat = await stat(path.resolve(root, 'src/v2')).catch(() => null);
    if (!v2RootStat || !v2RootStat.isDirectory()) {
        return {
            status: 'ok',
            count: 0,
            max: V2_LOCAL_SAFE_INVOKE_MAX,
            files: [],
            note: 'src/v2 not present yet'
        };
    }

    const files = await listFilesRecursive('src/v2');
    const matches = [];
    let count = 0;
    for (const absPath of files) {
        const source = readFileSync(absPath, 'utf8');
        const hitCount = countPattern(source, /function safeInvokeMethod\(/gu);
        if (hitCount > 0) {
            matches.push({
                file: path.relative(root, absPath).replaceAll('\\', '/'),
                count: hitCount
            });
            count += hitCount;
        }
    }

    return {
        status: count > V2_LOCAL_SAFE_INVOKE_MAX ? 'fail' : 'ok',
        count,
        max: V2_LOCAL_SAFE_INVOKE_MAX,
        files: matches
    };
}

function collectCoreFileDebt() {
    return CORE_FILE_BUDGETS.map((budget) => {
        const absPath = path.resolve(root, budget.file);
        if (!existsSync(absPath)) {
            return {
                file: budget.file,
                status: 'fail',
                lines: null,
                maxLines: budget.maxLines,
                ratio: null,
                note: 'missing'
            };
        }

        const lines = lineCount(readFileSync(absPath, 'utf8'));
        const ratio = lines / budget.maxLines;
        let status = 'ok';
        if (lines > budget.maxLines) {
            status = 'fail';
        } else if (ratio >= 0.95) {
            status = 'warn';
        }

        return {
            file: budget.file,
            status,
            lines,
            maxLines: budget.maxLines,
            ratio: Number((ratio * 100).toFixed(1))
        };
    });
}

function collectBundleDebt() {
    const bundleAbsPath = path.resolve(root, bundleReportRelPath);
    if (!existsSync(bundleAbsPath)) {
        return {
            status: 'warn',
            mainBytes: null,
            totalBytes: null,
            maxMainBytes: MAIN_BUNDLE_MAX_BYTES,
            maxTotalBytes: TOTAL_BUNDLE_MAX_BYTES,
            note: `missing ${bundleReportRelPath}, run npm run build:frontend`
        };
    }

    let report;
    try {
        report = JSON.parse(readFileSync(bundleAbsPath, 'utf8'));
    } catch (error) {
        return {
            status: 'fail',
            mainBytes: null,
            totalBytes: null,
            maxMainBytes: MAIN_BUNDLE_MAX_BYTES,
            maxTotalBytes: TOTAL_BUNDLE_MAX_BYTES,
            note: `invalid JSON: ${error?.message || String(error)}`
        };
    }

    const mainBytes = Number(report?.mainBundle?.bytes);
    const totalBytes = Number(report?.totals?.jsBytes);
    if (!Number.isFinite(mainBytes) || !Number.isFinite(totalBytes)) {
        return {
            status: 'fail',
            mainBytes: null,
            totalBytes: null,
            maxMainBytes: MAIN_BUNDLE_MAX_BYTES,
            maxTotalBytes: TOTAL_BUNDLE_MAX_BYTES,
            note: 'invalid report shape'
        };
    }

    const status = mainBytes > MAIN_BUNDLE_MAX_BYTES || totalBytes > TOTAL_BUNDLE_MAX_BYTES ? 'fail' : 'ok';
    return {
        status,
        mainBytes,
        totalBytes,
        maxMainBytes: MAIN_BUNDLE_MAX_BYTES,
        maxTotalBytes: TOTAL_BUNDLE_MAX_BYTES
    };
}

async function collectLegacyObservationDebt() {
    const targets = ['src', 'scripts/e2e'];
    let count = 0;
    const files = [];
    for (const target of targets) {
        const absTarget = path.resolve(root, target);
        const targetStat = await stat(absTarget).catch(() => null);
        if (!targetStat || !targetStat.isDirectory()) {
            continue;
        }
        const targetFiles = await listFilesRecursive(target);
        for (const absPath of targetFiles) {
            const source = readFileSync(absPath, 'utf8');
            const hitCount = countPattern(source, /observationPanel/gu);
            if (hitCount > 0) {
                count += hitCount;
                files.push({
                    file: path.relative(root, absPath).replaceAll('\\', '/'),
                    count: hitCount
                });
            }
        }
    }

    return {
        status: count > 0 ? 'fail' : 'ok',
        count,
        files
    };
}

function countByStatus(statusEntries = []) {
    return statusEntries.reduce((acc, status) => {
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {});
}

function buildMarkdown(report) {
    const lines = [
        '# Tech Debt Dashboard',
        '',
        `Generated at: ${report.generatedAt}`,
        '',
        '## Headline',
        '',
        `- Fail: ${report.summary.fail}`,
        `- Warn: ${report.summary.warn}`,
        `- OK: ${report.summary.ok}`,
        '',
        '## Runtime Safety Duplication',
        '',
        `- Local \`safeInvokeMethod\` count: ${report.runtimeSafety.count}/${report.runtimeSafety.max} (${report.runtimeSafety.status})`
    ];

    if (report.runtimeSafety.files.length > 0) {
        lines.push('- Files:');
        for (const item of report.runtimeSafety.files) {
            lines.push(`  - ${item.file}: ${item.count}`);
        }
    }

    lines.push(
        '',
        '## V2 Runtime Safety Dedupe',
        '',
        `- v2 local \`safeInvokeMethod\` count: ${report.v2RuntimeSafety.count}/${report.v2RuntimeSafety.max} (${report.v2RuntimeSafety.status})`
    );
    if (report.v2RuntimeSafety.note) {
        lines.push(`- Note: ${report.v2RuntimeSafety.note}`);
    }
    if (report.v2RuntimeSafety.files.length > 0) {
        lines.push('- Files:');
        for (const item of report.v2RuntimeSafety.files) {
            lines.push(`  - ${item.file}: ${item.count}`);
        }
    }

    lines.push('', '## Core File Budgets', '', '| File | Lines | Budget | Status |', '|---|---:|---:|---|');
    for (const item of report.coreFiles) {
        const linesValue = item.lines == null ? 'n/a' : String(item.lines);
        lines.push(`| ${item.file} | ${linesValue} | ${item.maxLines} | ${item.status} |`);
    }

    lines.push('', '## Bundle Budget', '');
    if (report.bundle.mainBytes == null || report.bundle.totalBytes == null) {
        lines.push(`- Status: ${report.bundle.status}`);
        lines.push(`- Note: ${report.bundle.note}`);
    } else {
        lines.push(`- Main bundle: ${formatKiB(report.bundle.mainBytes)} / ${formatKiB(report.bundle.maxMainBytes)} (${report.bundle.status})`);
        lines.push(`- Total JS output: ${formatKiB(report.bundle.totalBytes)} / ${formatKiB(report.bundle.maxTotalBytes)} (${report.bundle.status})`);
    }

    lines.push('', '## Legacy Observation Contract', '', `- observationPanel references in src + scripts/e2e: ${report.legacyObservation.count} (${report.legacyObservation.status})`);
    if (report.legacyObservation.files.length > 0) {
        lines.push('- Files:');
        for (const item of report.legacyObservation.files) {
            lines.push(`  - ${item.file}: ${item.count}`);
        }
    }

    lines.push('');
    return `${lines.join('\n')}\n`;
}

async function main() {
    const runtimeSafety = await collectSafeInvokeDebt();
    const v2RuntimeSafety = await collectV2SafeInvokeDebt();
    const coreFiles = collectCoreFileDebt();
    const bundle = collectBundleDebt();
    const legacyObservation = await collectLegacyObservationDebt();

    const statusSummary = countByStatus([
        runtimeSafety.status,
        v2RuntimeSafety.status,
        bundle.status,
        legacyObservation.status,
        ...coreFiles.map((entry) => entry.status)
    ]);

    const report = {
        generatedAt: new Date().toISOString(),
        runtimeSafety,
        v2RuntimeSafety,
        coreFiles,
        bundle,
        legacyObservation,
        summary: {
            fail: statusSummary.fail || 0,
            warn: statusSummary.warn || 0,
            ok: statusSummary.ok || 0
        }
    };

    const outputJsonPath = path.resolve(root, outputJsonRelPath);
    const outputMarkdownPath = path.resolve(root, outputMarkdownRelPath);
    await mkdir(path.dirname(outputJsonPath), { recursive: true });
    await writeFile(outputJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    await writeFile(outputMarkdownPath, buildMarkdown(report), 'utf8');

    console.log(`[debt-dashboard] wrote ${outputJsonRelPath}`);
    console.log(`[debt-dashboard] wrote ${outputMarkdownRelPath}`);
}

main().catch((error) => {
    console.error('[debt-dashboard] failed');
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = 1;
});
