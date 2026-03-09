#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const outputJsonRelPath = 'docs/reports/debt-dashboard.json';
const outputMarkdownRelPath = 'docs/reports/debt-dashboard.md';
const bundleReportRelPath = 'dist/bundle-size-report.json';

const SAFE_INVOKE_MAX = 15;
const V2_LOCAL_SAFE_INVOKE_MAX = 0;
const MAIN_BUNDLE_HARD_MAX_BYTES = 400 * 1024;
const MAIN_BUNDLE_TARGET_MAX_BYTES = 360 * 1024;
const TOTAL_BUNDLE_HARD_MAX_BYTES = 620 * 1024;
const TOTAL_BUNDLE_TARGET_MAX_BYTES = 580 * 1024;
const SHIM_INVENTORY_BASELINE = 0;

const CORE_FILE_BUDGETS = [
    { file: 'src/core/runtime/Circuit.js', hardMaxLines: 1400, targetMaxLines: 1300 },
    { file: 'src/components/Component.js', hardMaxLines: 1200, targetMaxLines: 1100 },
    { file: 'src/ui/charts/ChartWindowController.js', hardMaxLines: 450, targetMaxLines: 360 },
    { file: 'src/app/interaction/InteractionOrchestrator.js', hardMaxLines: 300, targetMaxLines: 240 },
    { file: 'src/core/simulation/MNASolver.js', hardMaxLines: 650, targetMaxLines: 550 },
    { file: 'src/app/AppRuntimeV2.js', hardMaxLines: 575, targetMaxLines: 500 }
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

function toRelPath(absPath) {
    return path.relative(root, absPath).replaceAll('\\', '/');
}

function countByStatus(statusEntries = []) {
    return statusEntries.reduce((acc, status) => {
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {});
}

function summarizeStatus(statusEntries = []) {
    const summary = countByStatus(statusEntries);
    const fail = summary.fail || 0;
    const warn = summary.warn || 0;
    const ok = summary.ok || 0;
    return {
        fail,
        warn,
        ok,
        status: fail > 0 ? 'fail' : (warn > 0 ? 'warn' : 'ok')
    };
}

function runProcess(command, args) {
    const executable = process.platform === 'win32' && command === 'npx' ? 'npx.cmd' : command;
    return spawnSync(executable, args, {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 20 * 1024 * 1024
    });
}

async function listFilesRecursive(directory, extensions = new Set(['.js', '.mjs', '.cjs'])) {
    const absDirectory = path.resolve(root, directory);
    const directoryStat = await stat(absDirectory).catch(() => null);
    if (!directoryStat || !directoryStat.isDirectory()) {
        return [];
    }

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
            matches.push({ file: toRelPath(absPath), count: hitCount });
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
    const files = await listFilesRecursive('src/v2');
    if (files.length === 0) {
        return {
            status: 'ok',
            count: 0,
            max: V2_LOCAL_SAFE_INVOKE_MAX,
            files: [],
            note: 'src/v2 not present yet'
        };
    }

    const matches = [];
    let count = 0;
    for (const absPath of files) {
        const source = readFileSync(absPath, 'utf8');
        const hitCount = countPattern(source, /function safeInvokeMethod\(/gu);
        if (hitCount > 0) {
            matches.push({ file: toRelPath(absPath), count: hitCount });
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
                maxLines: budget.hardMaxLines,
                targetLines: budget.targetMaxLines,
                ratio: null,
                note: 'missing'
            };
        }

        const lines = lineCount(readFileSync(absPath, 'utf8'));
        const ratio = lines / budget.hardMaxLines;
        let status = 'ok';
        if (lines > budget.hardMaxLines) {
            status = 'fail';
        } else if (lines > budget.targetMaxLines) {
            status = 'warn';
        }

        return {
            file: budget.file,
            status,
            lines,
            maxLines: budget.hardMaxLines,
            targetLines: budget.targetMaxLines,
            ratio: Number((ratio * 100).toFixed(1))
        };
    });
}

function collectHotspots(coreFiles = []) {
    const files = coreFiles.map((entry) => ({
        file: entry.file,
        status: entry.status,
        currentLines: entry.lines,
        budgetLines: entry.maxLines,
        targetLines: entry.targetLines ?? null,
        utilizationPercent: entry.ratio,
        note: entry.note || null
    }));
    const summary = summarizeStatus(files.map((entry) => entry.status));
    return {
        status: summary.status,
        files,
        summary
    };
}

function collectBundleDebt() {
    const bundleAbsPath = path.resolve(root, bundleReportRelPath);
    if (!existsSync(bundleAbsPath)) {
        return {
            status: 'warn',
            mainBytes: null,
            totalBytes: null,
            mainKiB: null,
            totalKiB: null,
            maxMainBytes: MAIN_BUNDLE_HARD_MAX_BYTES,
            maxTotalBytes: TOTAL_BUNDLE_HARD_MAX_BYTES,
            targetMainBytes: MAIN_BUNDLE_TARGET_MAX_BYTES,
            targetTotalBytes: TOTAL_BUNDLE_TARGET_MAX_BYTES,
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
            mainKiB: null,
            totalKiB: null,
            maxMainBytes: MAIN_BUNDLE_HARD_MAX_BYTES,
            maxTotalBytes: TOTAL_BUNDLE_HARD_MAX_BYTES,
            targetMainBytes: MAIN_BUNDLE_TARGET_MAX_BYTES,
            targetTotalBytes: TOTAL_BUNDLE_TARGET_MAX_BYTES,
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
            mainKiB: null,
            totalKiB: null,
            maxMainBytes: MAIN_BUNDLE_HARD_MAX_BYTES,
            maxTotalBytes: TOTAL_BUNDLE_HARD_MAX_BYTES,
            targetMainBytes: MAIN_BUNDLE_TARGET_MAX_BYTES,
            targetTotalBytes: TOTAL_BUNDLE_TARGET_MAX_BYTES,
            note: 'invalid report shape'
        };
    }

    let status = 'ok';
    if (mainBytes > MAIN_BUNDLE_HARD_MAX_BYTES || totalBytes > TOTAL_BUNDLE_HARD_MAX_BYTES) {
        status = 'fail';
    } else if (mainBytes > MAIN_BUNDLE_TARGET_MAX_BYTES || totalBytes > TOTAL_BUNDLE_TARGET_MAX_BYTES) {
        status = 'warn';
    }

    return {
        status,
        mainBytes,
        totalBytes,
        mainKiB: Number((mainBytes / 1024).toFixed(1)),
        totalKiB: Number((totalBytes / 1024).toFixed(1)),
        maxMainBytes: MAIN_BUNDLE_HARD_MAX_BYTES,
        maxTotalBytes: TOTAL_BUNDLE_HARD_MAX_BYTES,
        targetMainBytes: MAIN_BUNDLE_TARGET_MAX_BYTES,
        targetTotalBytes: TOTAL_BUNDLE_TARGET_MAX_BYTES
    };
}

async function collectLegacyObservationDebt() {
    const targets = ['src', 'scripts/e2e'];
    let count = 0;
    const files = [];
    for (const target of targets) {
        const targetFiles = await listFilesRecursive(target);
        for (const absPath of targetFiles) {
            const source = readFileSync(absPath, 'utf8');
            const hitCount = countPattern(source, /observationPanel/gu);
            if (hitCount > 0) {
                count += hitCount;
                files.push({ file: toRelPath(absPath), count: hitCount });
            }
        }
    }

    return {
        status: count > 0 ? 'fail' : 'ok',
        count,
        files
    };
}

async function collectShimInventory() {
    const files = await listFilesRecursive('src');
    const matches = [];
    let count = 0;

    for (const absPath of files) {
        const source = readFileSync(absPath, 'utf8');
        const hitCount = countPattern(source, /@deprecated/giu);
        if (hitCount > 0) {
            matches.push({ file: toRelPath(absPath), count: hitCount });
            count += hitCount;
        }
    }

    const growth = Math.max(0, count - SHIM_INVENTORY_BASELINE);
    return {
        status: growth > 0 ? 'fail' : (count > 0 ? 'warn' : 'ok'),
        count,
        baseline: SHIM_INVENTORY_BASELINE,
        growth,
        files: matches
    };
}

function collectLintDebt() {
    const result = runProcess('npx', ['eslint', '.', '--ext', '.js,.mjs,.cjs', '-f', 'json']);
    const stdout = String(result.stdout || '').trim();
    const stderr = String(result.stderr || '').trim();

    if (!stdout) {
        return {
            status: 'fail',
            errorCount: 0,
            warningCount: 0,
            boundaryErrors: 0,
            protectedWarnings: 0,
            files: [],
            note: stderr || 'eslint returned no JSON output'
        };
    }

    let lintResults;
    try {
        lintResults = JSON.parse(stdout);
    } catch (error) {
        return {
            status: 'fail',
            errorCount: 0,
            warningCount: 0,
            boundaryErrors: 0,
            protectedWarnings: 0,
            files: [],
            note: `failed to parse eslint json: ${error?.message || String(error)}`
        };
    }

    let errorCount = 0;
    let warningCount = 0;
    let boundaryErrors = 0;
    const files = [];

    for (const entry of Array.isArray(lintResults) ? lintResults : []) {
        const relPath = entry?.filePath ? toRelPath(entry.filePath) : null;
        const messages = Array.isArray(entry?.messages) ? entry.messages : [];
        const fileBoundaryErrors = messages.filter((message) => String(message.ruleId || '').startsWith('boundaries/')).length;
        const fileErrors = Number(entry?.errorCount) || 0;
        const fileWarnings = Number(entry?.warningCount) || 0;
        errorCount += fileErrors;
        warningCount += fileWarnings;
        boundaryErrors += fileBoundaryErrors;
        if ((fileErrors + fileWarnings) > 0 && relPath) {
            files.push({
                file: relPath,
                errorCount: fileErrors,
                warningCount: fileWarnings,
                boundaryErrors: fileBoundaryErrors
            });
        }
    }

    return {
        status: errorCount > 0 ? 'fail' : (warningCount > 0 ? 'warn' : 'ok'),
        errorCount,
        warningCount,
        boundaryErrors,
        protectedWarnings: warningCount,
        files,
        note: result.status === 0 ? null : (stderr || 'eslint reported violations')
    };
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
        '## Lint Health',
        '',
        `- Lint status: ${report.lint.status}`,
        `- Error count: ${report.lint.errorCount}`,
        `- Boundary errors: ${report.lint.boundaryErrors}`,
        `- Protected warnings: ${report.lint.protectedWarnings}`
    ];

    if (report.lint.note) {
        lines.push(`- Note: ${report.lint.note}`);
    }
    if (report.lint.files.length > 0) {
        lines.push('- Files:');
        for (const item of report.lint.files.slice(0, 12)) {
            lines.push(`  - ${item.file}: errors=${item.errorCount}, warnings=${item.warningCount}, boundaryErrors=${item.boundaryErrors}`);
        }
    }

    lines.push(
        '',
        '## Runtime Safety Duplication',
        '',
        `- Local \`safeInvokeMethod\` count: ${report.runtimeSafety.count}/${report.runtimeSafety.max} (${report.runtimeSafety.status})`
    );
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

    lines.push('', '## Core File Budgets', '', '| File | Lines | Hard | Target | Status |', '|---|---:|---:|---:|---|');
    for (const item of report.coreFiles) {
        const linesValue = item.lines == null ? 'n/a' : String(item.lines);
        lines.push(`| ${item.file} | ${linesValue} | ${item.maxLines} | ${item.targetLines ?? 'n/a'} | ${item.status} |`);
    }

    lines.push('', '## Hotspots', '', `- Hotspot status: ${report.hotspots.status}`);
    lines.push(`- Hotspot counts: fail=${report.hotspots.summary.fail}, warn=${report.hotspots.summary.warn}, ok=${report.hotspots.summary.ok}`);

    lines.push('', '## Bundle Budget', '');
    if (report.bundle.mainBytes == null || report.bundle.totalBytes == null) {
        lines.push(`- Status: ${report.bundle.status}`);
        lines.push(`- Note: ${report.bundle.note}`);
    } else {
        lines.push(`- Main bundle: hard ${formatKiB(report.bundle.mainBytes)} / ${formatKiB(report.bundle.maxMainBytes)}, target ${formatKiB(report.bundle.targetMainBytes)} (${report.bundle.status})`);
        lines.push(`- Total JS output: hard ${formatKiB(report.bundle.totalBytes)} / ${formatKiB(report.bundle.maxTotalBytes)}, target ${formatKiB(report.bundle.targetTotalBytes)} (${report.bundle.status})`);
    }

    lines.push('', '## Shim Inventory', '', `- Deprecated shim markers in src: ${report.shimInventory.count} / baseline ${report.shimInventory.baseline} (growth=${report.shimInventory.growth}, ${report.shimInventory.status})`);
    if (report.shimInventory.files.length > 0) {
        lines.push('- Files:');
        for (const item of report.shimInventory.files.slice(0, 12)) {
            lines.push(`  - ${item.file}: ${item.count}`);
        }
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
    const lint = collectLintDebt();
    const runtimeSafety = await collectSafeInvokeDebt();
    const v2RuntimeSafety = await collectV2SafeInvokeDebt();
    const coreFiles = collectCoreFileDebt();
    const hotspots = collectHotspots(coreFiles);
    const bundle = collectBundleDebt();
    const shimInventory = await collectShimInventory();
    const legacyObservation = await collectLegacyObservationDebt();

    const statusSummary = countByStatus([
        lint.status,
        runtimeSafety.status,
        v2RuntimeSafety.status,
        hotspots.status,
        bundle.status,
        shimInventory.status,
        legacyObservation.status,
        ...coreFiles.map((entry) => entry.status)
    ]);

    const report = {
        generatedAt: new Date().toISOString(),
        lint,
        runtimeSafety,
        v2RuntimeSafety,
        coreFiles,
        hotspots,
        bundle,
        shimInventory,
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
