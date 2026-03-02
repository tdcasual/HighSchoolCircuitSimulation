import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as esbuildBuild } from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const bundleOutDir = path.join(distDir, 'src');
const bundleReportJsonPath = path.join(distDir, 'bundle-size-report.json');
const bundleReportMdPath = path.join(distDir, 'bundle-size-report.md');

const FILE_COPIES = Object.freeze([
    ['index.html', 'index.html'],
    ['viewer.html', 'viewer.html'],
    ['embed.html', 'embed.html'],
    ['embed.js', 'embed.js'],
    ['deploycircuit.js', 'deploycircuit.js']
]);

const DIR_COPIES = Object.freeze([
    ['css', 'css', true],
    ['examples', 'examples', false]
]);

const MAIN_BUNDLE_WARN_BYTES = 220 * 1024;
const TOTAL_BUNDLE_WARN_BYTES = 700 * 1024;

async function ensureExists(absolutePath) {
    try {
        await stat(absolutePath);
        return true;
    } catch (_) {
        return false;
    }
}

function toPosixPath(value) {
    return String(value || '').replaceAll('\\', '/');
}

function formatKiB(bytes) {
    return `${(Number(bytes || 0) / 1024).toFixed(1)} KiB`;
}

function createBundleReport(metafile) {
    const outputEntries = Object.entries(metafile?.outputs || {});
    const jsOutputs = outputEntries
        .filter(([filePath]) => String(filePath).endsWith('.js'))
        .map(([filePath, outputMeta]) => ({
            filePath: toPosixPath(filePath),
            bytes: Number(outputMeta?.bytes) || 0
        }))
        .sort((a, b) => b.bytes - a.bytes);

    const mainBundle = jsOutputs.find((entry) => entry.filePath.endsWith('/dist/src/main.js')
        || entry.filePath === 'dist/src/main.js')
        || jsOutputs.find((entry) => entry.filePath.endsWith('/src/main.js'))
        || jsOutputs[0]
        || { filePath: 'dist/src/main.js', bytes: 0 };

    const totalJsBytes = jsOutputs.reduce((sum, entry) => sum + entry.bytes, 0);
    const report = {
        generatedAt: new Date().toISOString(),
        mainBundle: {
            filePath: mainBundle.filePath,
            bytes: mainBundle.bytes,
            kib: Number((mainBundle.bytes / 1024).toFixed(2))
        },
        totals: {
            jsOutputs: jsOutputs.length,
            jsBytes: totalJsBytes,
            jsKiB: Number((totalJsBytes / 1024).toFixed(2))
        },
        topJsOutputs: jsOutputs.slice(0, 12)
    };

    const markdownLines = [
        '# Frontend Bundle Size Report',
        '',
        `Generated at: ${report.generatedAt}`,
        '',
        `- Main bundle: \`${report.mainBundle.filePath}\` (${formatKiB(report.mainBundle.bytes)})`,
        `- Total JS output: ${report.totals.jsOutputs} files / ${formatKiB(report.totals.jsBytes)}`,
        '',
        '| File | Size |',
        '|---|---:|'
    ];
    for (const item of report.topJsOutputs) {
        markdownLines.push(`| \`${item.filePath}\` | ${formatKiB(item.bytes)} |`);
    }
    markdownLines.push('');

    return {
        report,
        markdown: markdownLines.join('\n')
    };
}

async function bundleFrontendSource() {
    const entryPath = path.join(projectRoot, 'src', 'main.js');
    const result = await esbuildBuild({
        entryPoints: [entryPath],
        outdir: bundleOutDir,
        bundle: true,
        splitting: true,
        format: 'esm',
        platform: 'browser',
        target: ['es2020'],
        minify: true,
        treeShaking: true,
        chunkNames: 'chunks/[name]-[hash]',
        entryNames: '[name]',
        metafile: true,
        logLevel: 'silent'
    });

    const { report, markdown } = createBundleReport(result.metafile);
    await writeFile(bundleReportJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    await writeFile(bundleReportMdPath, markdown, 'utf8');

    console.log(`[build:frontend] entry bundle: ${formatKiB(report.mainBundle.bytes)} (${report.mainBundle.filePath})`);
    console.log(`[build:frontend] total js output: ${report.totals.jsOutputs} files / ${formatKiB(report.totals.jsBytes)}`);
    if (report.mainBundle.bytes > MAIN_BUNDLE_WARN_BYTES) {
        console.warn(`[build:frontend] warning: main bundle exceeds ${formatKiB(MAIN_BUNDLE_WARN_BYTES)}`);
    }
    if (report.totals.jsBytes > TOTAL_BUNDLE_WARN_BYTES) {
        console.warn(`[build:frontend] warning: total js output exceeds ${formatKiB(TOTAL_BUNDLE_WARN_BYTES)}`);
    }
}

async function main() {
    await rm(distDir, { recursive: true, force: true });
    await mkdir(distDir, { recursive: true });

    for (const [sourceRel, targetRel] of FILE_COPIES) {
        const sourceAbs = path.join(projectRoot, sourceRel);
        const targetAbs = path.join(distDir, targetRel);
        const exists = await ensureExists(sourceAbs);
        if (!exists) {
            throw new Error(`Missing build input: ${sourceAbs}`);
        }
        await cp(sourceAbs, targetAbs);
    }

    for (const [sourceRel, targetRel, required] of DIR_COPIES) {
        const sourceAbs = path.join(projectRoot, sourceRel);
        const targetAbs = path.join(distDir, targetRel);
        const exists = await ensureExists(sourceAbs);
        if (!exists) {
            if (required) {
                throw new Error(`Missing build input: ${sourceAbs}`);
            }
            continue;
        }
        await cp(sourceAbs, targetAbs, { recursive: true });
    }

    const sourceIndexPath = path.join(projectRoot, 'index.html');
    const sourceIndexContent = await readFile(sourceIndexPath, 'utf8');
    if (!sourceIndexContent.includes('src/main.js')) {
        throw new Error('index.html is expected to reference src/main.js');
    }

    await bundleFrontendSource();

    console.log(`Frontend static build prepared at: ${distDir}`);
    console.log(`Frontend bundle report: ${bundleReportMdPath}`);
}

main().catch((error) => {
    console.error('[build:frontend] failed:', error);
    process.exitCode = 1;
});
