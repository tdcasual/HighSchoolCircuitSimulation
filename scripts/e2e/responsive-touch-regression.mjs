#!/usr/bin/env node

import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const outputDir = path.join(projectRoot, 'output', 'e2e', 'responsive-touch');

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
    const relative = path.posix.normalize(normalized).replace(/^\/+/, '');
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
        } catch (error) {
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
    const baseUrl = `http://127.0.0.1:${port}`;

    return {
        server,
        baseUrl,
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
        const hint = [
            'Playwright is required for this test suite.',
            'Install with: npm install -D playwright',
            `Original error: ${error?.message || String(error)}`
        ].join('\n');
        throw new Error(hint);
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

async function openScenarioPage(browser, baseUrl, scenario) {
    const context = await browser.newContext({
        viewport: scenario.viewport,
        isMobile: !!scenario.isMobile,
        hasTouch: !!scenario.hasTouch
    });

    await context.addInitScript(() => {
        try {
            localStorage.clear();
        } catch (_) {
            // ignore storage bootstrap errors
        }
    });

    const page = await context.newPage();
    await installCdnStubs(page);
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.app?.interaction && window.app?.responsiveLayout));

    return { context, page };
}

async function readLayoutState(page) {
    return page.evaluate(() => {
        const body = document.body;
        const modes = ['desktop', 'tablet', 'compact', 'phone'];
        const mode = modes.find((candidate) => body.classList.contains(`layout-mode-${candidate}`)) || 'unknown';

        const toolbox = document.getElementById('toolbox');
        const sidePanel = document.getElementById('side-panel');
        const backdrop = document.getElementById('layout-backdrop');

        return {
            mode,
            bodyClassName: body.className,
            toolboxToggleHidden: document.getElementById('btn-toggle-toolbox')?.hidden ?? null,
            sidePanelToggleHidden: document.getElementById('btn-toggle-side-panel')?.hidden ?? null,
            toolboxOpen: toolbox?.classList.contains('layout-open') ?? false,
            sidePanelOpen: sidePanel?.classList.contains('layout-open') ?? false,
            backdropHidden: backdrop?.hidden ?? null,
            backdropActive: backdrop?.classList.contains('active') ?? false
        };
    });
}

async function capture(page, fileName) {
    await mkdir(outputDir, { recursive: true });
    await page.screenshot({ path: path.join(outputDir, fileName), fullPage: true });
}

async function verifyDesktopLayout(browser, baseUrl) {
    const scenario = {
        name: 'desktop',
        viewport: { width: 1366, height: 768 },
        isMobile: false,
        hasTouch: false
    };

    const { context, page } = await openScenarioPage(browser, baseUrl, scenario);
    try {
        const state = await readLayoutState(page);
        assertCondition(state.mode === 'desktop', `desktop mode expected, got: ${state.bodyClassName}`);
        assertCondition(state.toolboxToggleHidden === true, 'toolbox toggle should stay hidden on desktop');
        assertCondition(state.sidePanelToggleHidden === true, 'side-panel toggle should stay hidden on desktop');

        const beforeClassroom = await page.evaluate(() => {
            const parsePx = (value) => {
                const num = parseFloat(value);
                return Number.isFinite(num) ? num : 0;
            };
            const toolbox = document.getElementById('toolbox');
            const sidePanel = document.getElementById('side-panel');
            const statusBar = document.getElementById('status-bar');
            const toolLabel = document.querySelector('.tool-item span');
            return {
                toolboxWidth: Math.round(toolbox?.getBoundingClientRect?.().width || 0),
                sidePanelWidth: Math.round(sidePanel?.getBoundingClientRect?.().width || 0),
                statusBarHeight: Math.round(statusBar?.getBoundingClientRect?.().height || 0),
                toolLabelFont: parsePx(getComputedStyle(toolLabel).fontSize)
            };
        });

        await page.click('#btn-classroom-mode');
        await page.waitForFunction(() => document.body.classList.contains('classroom-mode'));

        const afterClassroom = await page.evaluate(() => {
            const parsePx = (value) => {
                const num = parseFloat(value);
                return Number.isFinite(num) ? num : 0;
            };
            const toolbox = document.getElementById('toolbox');
            const sidePanel = document.getElementById('side-panel');
            const statusBar = document.getElementById('status-bar');
            const toolLabel = document.querySelector('.tool-item span');
            const modeButton = document.getElementById('btn-classroom-mode');
            return {
                toolboxWidth: Math.round(toolbox?.getBoundingClientRect?.().width || 0),
                sidePanelWidth: Math.round(sidePanel?.getBoundingClientRect?.().width || 0),
                statusBarHeight: Math.round(statusBar?.getBoundingClientRect?.().height || 0),
                toolLabelFont: parsePx(getComputedStyle(toolLabel).fontSize),
                modeButtonText: modeButton?.textContent || ''
            };
        });

        assertCondition(
            afterClassroom.toolboxWidth > beforeClassroom.toolboxWidth,
            `classroom mode should increase toolbox width (${beforeClassroom.toolboxWidth} -> ${afterClassroom.toolboxWidth})`
        );
        assertCondition(
            afterClassroom.sidePanelWidth > beforeClassroom.sidePanelWidth,
            `classroom mode should increase side-panel width (${beforeClassroom.sidePanelWidth} -> ${afterClassroom.sidePanelWidth})`
        );
        assertCondition(
            afterClassroom.statusBarHeight > beforeClassroom.statusBarHeight,
            `classroom mode should increase status-bar height (${beforeClassroom.statusBarHeight} -> ${afterClassroom.statusBarHeight})`
        );
        assertCondition(
            afterClassroom.toolLabelFont >= beforeClassroom.toolLabelFont + 2,
            `classroom mode should increase tool label font size (${beforeClassroom.toolLabelFont} -> ${afterClassroom.toolLabelFont})`
        );
        assertCondition(
            afterClassroom.modeButtonText.includes('课堂模式: 标准'),
            `classroom mode button text mismatch in standard level: ${afterClassroom.modeButtonText}`
        );

        await page.click('#btn-classroom-mode');
        await page.waitForFunction(() => document.body.classList.contains('classroom-mode-enhanced'));

        const enhancedClassroom = await page.evaluate(() => {
            const parsePx = (value) => {
                const num = parseFloat(value);
                return Number.isFinite(num) ? num : 0;
            };
            const toolLabel = document.querySelector('.tool-item span');
            const modeButton = document.getElementById('btn-classroom-mode');
            return {
                modeButtonText: modeButton?.textContent || '',
                toolLabelFont: parsePx(getComputedStyle(toolLabel).fontSize)
            };
        });

        assertCondition(
            enhancedClassroom.modeButtonText.includes('课堂模式: 增强'),
            `classroom mode button text mismatch in enhanced level: ${enhancedClassroom.modeButtonText}`
        );
        assertCondition(
            enhancedClassroom.toolLabelFont >= afterClassroom.toolLabelFont,
            `enhanced level should not reduce readability (${afterClassroom.toolLabelFont} -> ${enhancedClassroom.toolLabelFont})`
        );

        await capture(page, 'desktop-1366x768.png');
        await capture(page, 'desktop-1366x768-classroom-mode.png');
    } finally {
        await context.close();
    }
}

async function verifyTabletLayout(browser, baseUrl) {
    const scenario = {
        name: 'tablet',
        viewport: { width: 1024, height: 768 },
        isMobile: true,
        hasTouch: true
    };

    const { context, page } = await openScenarioPage(browser, baseUrl, scenario);
    try {
        const state = await readLayoutState(page);
        assertCondition(state.mode === 'tablet', `tablet mode expected, got: ${state.bodyClassName}`);
        assertCondition(state.toolboxToggleHidden === true, 'toolbox toggle should stay hidden on tablet mode');
        assertCondition(state.sidePanelToggleHidden === true, 'side-panel toggle should stay hidden on tablet mode');
        await capture(page, 'tablet-1024x768.png');
    } finally {
        await context.close();
    }
}

async function verifyCompactDrawerBehavior(browser, baseUrl) {
    const scenario = {
        name: 'compact',
        viewport: { width: 768, height: 1024 },
        isMobile: true,
        hasTouch: true
    };

    const { context, page } = await openScenarioPage(browser, baseUrl, scenario);
    try {
        let state = await readLayoutState(page);
        assertCondition(state.mode === 'compact', `compact mode expected, got: ${state.bodyClassName}`);
        assertCondition(state.toolboxToggleHidden === false, 'toolbox toggle must be visible in compact mode');
        assertCondition(state.sidePanelToggleHidden === false, 'side-panel toggle must be visible in compact mode');

        await page.click('#btn-toggle-toolbox');
        await page.waitForFunction(() => {
            const toolbox = document.getElementById('toolbox');
            const backdrop = document.getElementById('layout-backdrop');
            return toolbox?.classList.contains('layout-open') && backdrop && backdrop.hidden === false;
        });

        state = await readLayoutState(page);
        assertCondition(state.toolboxOpen === true, 'toolbox drawer should open after toggling');
        assertCondition(state.sidePanelOpen === false, 'side-panel should remain closed when toolbox is open');
        assertCondition(state.backdropHidden === false && state.backdropActive, 'backdrop should be active when drawer is open');

        await page.click('#layout-backdrop');
        await page.waitForFunction(() => {
            const toolbox = document.getElementById('toolbox');
            const sidePanel = document.getElementById('side-panel');
            const backdrop = document.getElementById('layout-backdrop');
            return !toolbox?.classList.contains('layout-open')
                && !sidePanel?.classList.contains('layout-open')
                && backdrop?.hidden === true;
        });

        await page.click('#btn-toggle-side-panel');
        await page.waitForFunction(() => {
            const toolbox = document.getElementById('toolbox');
            const sidePanel = document.getElementById('side-panel');
            return sidePanel?.classList.contains('layout-open') && !toolbox?.classList.contains('layout-open');
        });

        state = await readLayoutState(page);
        assertCondition(state.sidePanelOpen === true, 'side-panel drawer should open after toggling');
        assertCondition(state.toolboxOpen === false, 'toolbox drawer should auto-close when side-panel opens');

        await capture(page, 'compact-768x1024-drawers.png');
    } finally {
        await context.close();
    }
}

async function verifyPhoneTouchFlow(browser, baseUrl) {
    const scenario = {
        name: 'phone',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true
    };

    const { context, page } = await openScenarioPage(browser, baseUrl, scenario);
    try {
        const state = await readLayoutState(page);
        assertCondition(state.mode === 'phone', `phone mode expected, got: ${state.bodyClassName}`);

        const addResult = await page.evaluate(() => {
            const result = window.app?.interaction?.addComponent?.('Resistor', 180, 220);
            return result || null;
        });

        assertCondition(addResult?.ok === true, `failed to add component in phone mode: ${JSON.stringify(addResult)}`);
        const componentId = addResult?.payload?.componentId;
        assertCondition(!!componentId, 'component id should be returned after addComponent');

        await page.waitForFunction(() => {
            const bar = document.getElementById('quick-action-bar');
            return !!bar && bar.hidden === false;
        });

        const quickActionState = await page.evaluate(() => {
            const bar = document.getElementById('quick-action-bar');
            const label = bar?.querySelector('.quick-action-label')?.textContent?.trim() || '';
            const actions = Array.from(bar?.querySelectorAll('.quick-action-btn') || []).map((btn) => btn.textContent?.trim() || '');
            return {
                hidden: bar?.hidden ?? true,
                label,
                actions
            };
        });

        assertCondition(quickActionState.hidden === false, 'quick-action bar should be visible after selecting component');
        assertCondition(quickActionState.actions.length === 4, `expected 4 component quick actions, got ${quickActionState.actions.length}`);
        ['编辑', '旋转', '复制', '删除'].forEach((expectedLabel) => {
            assertCondition(
                quickActionState.actions.includes(expectedLabel),
                `quick-action bar missing action: ${expectedLabel}`
            );
        });

        const componentSelector = `g.component[data-id="${componentId}"]`;
        await page.waitForSelector(componentSelector);
        const bounds = await page.locator(componentSelector).boundingBox();
        assertCondition(!!bounds, 'component should have a visible bounding box for long-press test');

        const pressX = Math.round((bounds?.x || 0) + (bounds?.width || 0) / 2);
        const pressY = Math.round((bounds?.y || 0) + (bounds?.height || 0) / 2);

        await page.dispatchEvent(componentSelector, 'pointerdown', {
            pointerId: 91,
            pointerType: 'touch',
            isPrimary: true,
            bubbles: true,
            clientX: pressX,
            clientY: pressY,
            button: 0
        });

        await page.waitForTimeout(520);

        await page.waitForSelector('#context-menu', { state: 'visible' });

        const contextMenuLabels = await page.$$eval('#context-menu .context-menu-item', (items) => {
            return items.map((item) => item.textContent?.trim() || '');
        });

        assertCondition(contextMenuLabels.includes('编辑属性'), 'long-press menu should include 编辑属性');
        assertCondition(contextMenuLabels.some((label) => label.includes('删除')), 'long-press menu should include delete action');

        await page.dispatchEvent(componentSelector, 'pointerup', {
            pointerId: 91,
            pointerType: 'touch',
            isPrimary: true,
            bubbles: true,
            clientX: pressX,
            clientY: pressY,
            button: 0
        });

        await page.click('#status-bar', { position: { x: 8, y: 8 } });
        await page.waitForTimeout(30);

        const interactionCostMs = await page.evaluate(async () => {
            const toggleBtn = document.getElementById('btn-toggle-toolbox');
            const backdrop = document.getElementById('layout-backdrop');
            if (!toggleBtn || !backdrop) return null;

            const waitFrame = () => new Promise((resolve) => {
                requestAnimationFrame(() => requestAnimationFrame(resolve));
            });

            const t0 = performance.now();
            for (let i = 0; i < 4; i += 1) {
                toggleBtn.click();
                await waitFrame();
                if (backdrop.hidden === false) {
                    backdrop.click();
                }
                await waitFrame();
            }
            return performance.now() - t0;
        });

        assertCondition(
            Number.isFinite(interactionCostMs) && interactionCostMs < 3000,
            `drawer interaction loop is unexpectedly slow: ${interactionCostMs}ms`
        );

        await capture(page, 'phone-390x844-touch-flow.png');
    } finally {
        await context.close();
    }
}

async function main() {
    await mkdir(outputDir, { recursive: true });

    const server = await startStaticServer();
    let browser = null;

    try {
        browser = await createBrowser();

        await verifyDesktopLayout(browser, server.baseUrl);
        await verifyTabletLayout(browser, server.baseUrl);
        await verifyCompactDrawerBehavior(browser, server.baseUrl);
        await verifyPhoneTouchFlow(browser, server.baseUrl);

        console.log('Responsive touch E2E passed.');
        console.log(`Screenshots: ${outputDir}`);
    } finally {
        if (browser) {
            await browser.close();
        }
        await server.close();
    }
}

main().catch((error) => {
    console.error('[responsive-touch-e2e] FAILED');
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = 1;
});
