#!/usr/bin/env node

import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const outputDir = path.join(projectRoot, 'output', 'e2e', 'observation-touch');

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

async function createBrowser() {
    try {
        const playwright = await import('playwright');
        return playwright.chromium.launch({ headless: true });
    } catch (error) {
        throw new Error([
            'Playwright is required for observation-touch-regression.',
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

async function capture(page, fileName) {
    await mkdir(outputDir, { recursive: true });
    await page.screenshot({ path: path.join(outputDir, fileName), fullPage: true });
}

async function runObservationScenario(browser, baseUrl) {
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true
    });

    const page = await context.newPage();
    await installCdnStubs(page);
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.app?.chartWorkspace && window.app?.interaction));

    const initial = await page.evaluate(() => {
        const workspace = window.app.chartWorkspace;
        workspace.onLayoutModeChanged?.('phone');
        const root = document.getElementById('chart-workspace-root');
        return {
            windowCount: Array.isArray(workspace?.windows) ? workspace.windows.length : 0,
            hasAddButton: Boolean(document.getElementById('btn-add-chart') || document.getElementById('btn-mobile-add-chart')),
            isPhoneMode: root?.classList?.contains?.('chart-workspace-phone') === true
        };
    });

    assertCondition(initial.hasAddButton, 'chart workspace add button should exist');
    assertCondition(initial.windowCount === 0, `expected default chart window count to be 0, got ${initial.windowCount}`);
    assertCondition(initial.isPhoneMode, 'chart workspace should switch to phone layout mode');

    const afterAdd = await page.evaluate(() => {
        const workspace = window.app.chartWorkspace;
        const before = Array.isArray(workspace?.windows) ? workspace.windows.length : 0;
        const addButton = document.getElementById('btn-mobile-add-chart') || document.getElementById('btn-add-chart');
        addButton?.click?.();
        return {
            before,
            after: Array.isArray(workspace?.windows) ? workspace.windows.length : 0
        };
    });

    assertCondition(
        afterAdd.after === afterAdd.before + 1,
        `chart workspace add button should append one window (${afterAdd.before} -> ${afterAdd.after})`
    );

    const collapseCheck = await page.evaluate(() => {
        const workspace = window.app.chartWorkspace;
        const firstWindow = workspace?.windows?.[0];
        if (!firstWindow) {
            return { ok: false, reason: 'missing-first-window' };
        }
        const buttons = Array.from(firstWindow.elements?.root?.querySelectorAll?.('button.chart-window-btn') || []);
        const collapseBtn = buttons.find((btn) => {
            const text = String(btn?.textContent || '').trim();
            return text === '收起图例' || text === '展开图例';
        });
        if (!collapseBtn) {
            return { ok: false, reason: 'missing-collapse-button' };
        }
        const before = !!firstWindow.state?.ui?.legendCollapsed;
        collapseBtn.click();
        const after = !!firstWindow.state?.ui?.legendCollapsed;
        return {
            ok: true,
            before,
            after
        };
    });

    assertCondition(collapseCheck.ok, `chart window collapse check failed: ${collapseCheck.reason || 'unknown'}`);
    assertCondition(
        collapseCheck.before !== collapseCheck.after,
        'chart window collapse state should toggle after clicking collapse button'
    );

    await capture(page, 'observation-phone-touch.png');
    await context.close();
}

async function main() {
    const server = await startStaticServer();
    const browser = await createBrowser();
    try {
        await runObservationScenario(browser, server.baseUrl);
        console.log('observation-touch-regression: PASS');
    } finally {
        await browser.close();
        await server.close();
    }
}

main().catch((error) => {
    console.error('observation-touch-regression: FAIL');
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = 1;
});
