#!/usr/bin/env node

import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const outputDir = path.join(projectRoot, 'output', 'e2e', 'browser-compat');
const summaryPath = path.join(outputDir, 'smoke-summary.json');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon'
};

const TARGETS = [
    { id: 'chromium', label: 'Chromium', required: true, viewport: { width: 1366, height: 768 } },
    { id: 'firefox', label: 'Firefox', required: false, viewport: { width: 1366, height: 768 } },
    { id: 'webkit', label: 'WebKit', required: false, viewport: { width: 1366, height: 768 } }
];

function assertCondition(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function toLocalFilePath(urlPath = '/') {
    const cleanPath = urlPath.split('?')[0].split('#')[0] || '/';
    const normalized = cleanPath === '/' ? '/index.html' : cleanPath;
    const relative = path.posix.normalize(normalized).replace(/^\/+/u, '');
    const absolute = path.resolve(projectRoot, relative);
    if (!absolute.startsWith(projectRoot)) {
        return null;
    }
    return absolute;
}

async function startStaticServer() {
    const server = createServer(async (req, res) => {
        try {
            const filePath = toLocalFilePath(req.url || '/');
            if (!filePath) {
                res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Forbidden');
                return;
            }

            const content = await readFile(filePath);
            const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
            res.end(content);
        } catch (_) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Not Found');
        }
    });

    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve());
    });

    const address = server.address();
    const port = address && typeof address === 'object' ? address.port : 0;
    return {
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((resolve, reject) => {
            server.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        })
    };
}

async function createPlaywright() {
    try {
        return await import('playwright');
    } catch (error) {
        throw new Error([
            'Playwright is required for browser compatibility smoke checks.',
            'Install with: npm install -D playwright',
            `Original error: ${error?.message || String(error)}`
        ].join('\n'));
    }
}

async function installCdnStubs(page) {
    await page.route('**/cdn.jsdelivr.net/npm/marked@12.0.0/marked.min.js*', (route) => {
        route.fulfill({
            status: 200,
            contentType: 'application/javascript; charset=utf-8',
            body: 'window.marked={parse:(s)=>String(s??"")};'
        });
    });
    await page.route('**/cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js*', (route) => {
        route.fulfill({
            status: 200,
            contentType: 'application/javascript; charset=utf-8',
            body: 'window.MathJax=window.MathJax||{};'
        });
    });
}

async function runTarget(playwright, target, baseUrl) {
    const launcher = playwright[target.id];
    if (!launcher || typeof launcher.launch !== 'function') {
        return {
            browser: target.id,
            status: 'skipped',
            reason: 'launcher-unavailable',
            required: target.required
        };
    }

    let browser = null;
    try {
        browser = await launcher.launch({ headless: true });
    } catch (error) {
        return {
            browser: target.id,
            status: 'skipped',
            reason: `launch-failed: ${error?.message || String(error)}`,
            required: target.required
        };
    }

    const context = await browser.newContext({ viewport: target.viewport });
    const page = await context.newPage();
    try {
        await installCdnStubs(page);
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => Boolean(window.app?.chartWorkspace && window.app?.interaction));

        const state = await page.evaluate(() => {
            const app = window.app;
            const workspace = app?.chartWorkspace;
            const addButton = document.querySelector('[data-chart-action="add"]');
            const before = Array.isArray(workspace?.windows) ? workspace.windows.length : 0;
            addButton?.click?.();
            const after = Array.isArray(workspace?.windows) ? workspace.windows.length : 0;
            app?.startSimulation?.();
            app?.stopSimulation?.();
            return {
                hasChartWorkspace: Boolean(workspace),
                hasAddButton: Boolean(addButton),
                before,
                after
            };
        });

        assertCondition(state.hasChartWorkspace, `${target.label}: chartWorkspace missing`);
        assertCondition(state.hasAddButton, `${target.label}: add chart window button missing`);
        assertCondition(state.after === state.before + 1, `${target.label}: add window action did not increase count`);

        await mkdir(outputDir, { recursive: true });
        await page.screenshot({
            path: path.join(outputDir, `${target.id}.png`),
            fullPage: true
        });

        return {
            browser: target.id,
            status: 'pass',
            required: target.required,
            beforeWindows: state.before,
            afterWindows: state.after
        };
    } catch (error) {
        return {
            browser: target.id,
            status: 'fail',
            reason: error?.message || String(error),
            required: target.required
        };
    } finally {
        await context.close();
        await browser.close();
    }
}

async function writeSummary(results) {
    await mkdir(outputDir, { recursive: true });
    const summary = {
        generatedAt: new Date().toISOString(),
        requiredBrowsers: TARGETS.filter((target) => target.required).map((target) => target.id),
        results
    };
    await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
}

async function main() {
    const server = await startStaticServer();
    const playwright = await createPlaywright();
    const results = [];

    try {
        for (const target of TARGETS) {
            results.push(await runTarget(playwright, target, server.baseUrl));
        }
        await writeSummary(results);

        const requiredFailures = results.filter((entry) => entry.required && entry.status !== 'pass');
        const passed = results.filter((entry) => entry.status === 'pass');

        if (requiredFailures.length > 0) {
            const failureLabel = requiredFailures.map((entry) => `${entry.browser}:${entry.status}`).join(', ');
            throw new Error(`required browser smoke checks failed: ${failureLabel}`);
        }
        if (passed.length === 0) {
            throw new Error('no browser smoke checks passed');
        }

        console.log('browser-compat-smoke: PASS');
        for (const result of results) {
            const detail = result.reason ? ` (${result.reason})` : '';
            console.log(`- ${result.browser}: ${result.status}${detail}`);
        }
        console.log(`summary: ${summaryPath}`);
    } finally {
        await server.close();
    }
}

main().catch((error) => {
    console.error('browser-compat-smoke: FAIL');
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = 1;
});
