#!/usr/bin/env node

import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const outputDir = path.join(projectRoot, 'output', 'e2e', 'ai-mobile-layout');

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
    if (!absolute.startsWith(projectRoot)) return null;
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
            'Playwright is required for ai-mobile-layout-regression.',
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

function overlaps(a, b) {
    if (!a || !b) return false;
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

async function measureMobileAiLayout(page) {
    return page.evaluate(() => {
        const panel = document.getElementById('ai-assistant-panel');
        const panelHeader = document.getElementById('ai-panel-header');
        const panelContent = document.querySelector('#ai-assistant-panel .ai-tab-content.active')
            || document.querySelector('#ai-assistant-panel .ai-tab-content');
        const controls = document.getElementById('canvas-mobile-controls');
        const status = document.getElementById('status-bar');
        const chatInput = document.getElementById('chat-input-area');
        const chatInputBox = document.getElementById('chat-input');
        const resizeHandle = document.getElementById('ai-resize-handle');
        const body = document.body;

        const rect = (el) => {
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return {
                left: Math.round(r.left),
                top: Math.round(r.top),
                right: Math.round(r.right),
                bottom: Math.round(r.bottom),
                width: Math.round(r.width),
                height: Math.round(r.height)
            };
        };

        const targets = [
            ['#chat-send-btn', document.getElementById('chat-send-btn')],
            ['.chat-insert-btn[data-insert="inline-math"]', document.querySelector('.chat-insert-btn[data-insert="inline-math"]')],
            ['.chat-insert-btn[data-insert="block-math"]', document.querySelector('.chat-insert-btn[data-insert="block-math"]')],
            ['#ai-settings-btn', document.getElementById('ai-settings-btn')],
            ['#ai-toggle-btn', document.getElementById('ai-toggle-btn')]
        ].map(([selector, el]) => ({
            selector,
            rect: rect(el)
        }));

        const resizeStyle = resizeHandle ? window.getComputedStyle(resizeHandle).display : '';
        const controlsStyle = controls ? window.getComputedStyle(controls) : null;
        const inputStyle = chatInputBox ? window.getComputedStyle(chatInputBox) : null;
        const contentStyle = panelContent ? window.getComputedStyle(panelContent) : null;

        return {
            modePhone: body?.classList?.contains('layout-mode-phone') || false,
            aiPanelOpen: body?.classList?.contains('ai-panel-open') || false,
            aiInputActive: body?.classList?.contains('ai-input-active') || false,
            aiKeyboardOpen: body?.classList?.contains('ai-keyboard-open') || false,
            panelCollapsed: panel?.classList?.contains('collapsed') || false,
            panelRect: rect(panel),
            headerRect: rect(panelHeader),
            controlsRect: rect(controls),
            statusRect: rect(status),
            chatInputRect: rect(chatInput),
            chatInputFocused: document.activeElement === chatInputBox,
            chatInputFontSize: inputStyle ? Number.parseFloat(inputStyle.fontSize || '0') : Number.NaN,
            contentPaddingHorizontal: contentStyle ? Number.parseFloat(contentStyle.paddingLeft || '0') : Number.NaN,
            controlsPointerEvents: controlsStyle?.pointerEvents || '',
            controlsOpacity: controlsStyle ? Number(controlsStyle.opacity) : Number.NaN,
            touchTargets: targets,
            resizeDisplay: resizeStyle
        };
    });
}

function assertNoOverlap(label, a, b) {
    assertCondition(!overlaps(a, b), `${label} should not overlap`);
}

function assertTouchTargets(result) {
    result.touchTargets.forEach((item) => {
        const rect = item.rect;
        assertCondition(rect && rect.width > 0 && rect.height > 0, `${item.selector} should exist`);
        assertCondition(rect.width >= 44, `${item.selector} width should be >= 44px (actual ${rect.width})`);
        assertCondition(rect.height >= 44, `${item.selector} height should be >= 44px (actual ${rect.height})`);
    });
}

async function runScenario(browser, baseUrl) {
    const scenarios = [
        {
            name: 'portrait',
            viewport: { width: 390, height: 844 },
            expectLandscape: false,
            narrow: false
        },
        {
            name: 'narrow',
            viewport: { width: 360, height: 740 },
            expectLandscape: false,
            narrow: true
        },
        {
            name: 'landscape',
            viewport: { width: 640, height: 360 },
            expectLandscape: true,
            narrow: false
        }
    ];

    for (const scenario of scenarios) {
        const context = await browser.newContext({
            viewport: scenario.viewport,
            isMobile: true,
            hasTouch: true
        });
        await context.addInitScript(() => {
            try {
                localStorage.clear();
                localStorage.setItem('ui.first_run_guide_dismissed', '1');
            } catch (_) {}
        });
        const page = await context.newPage();
        await installCdnStubs(page);
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => Boolean(window.app?.aiPanel && window.app?.responsiveLayout));

        const collapsedState = await measureMobileAiLayout(page);
        await capture(page, `ai-mobile-${scenario.name}-collapsed.png`);

        assertCondition(collapsedState.modePhone, `${scenario.name}: viewport should be phone mode`);
        assertCondition(collapsedState.panelCollapsed, `${scenario.name}: AI panel should start collapsed`);
        assertNoOverlap(
            `${scenario.name}: Collapsed AI panel and mobile controls`,
            collapsedState.panelRect,
            collapsedState.controlsRect
        );
        assertNoOverlap(
            `${scenario.name}: Collapsed AI panel and status bar`,
            collapsedState.panelRect,
            collapsedState.statusRect
        );

        await page.click('#ai-fab-btn');
        await page.waitForFunction(() => {
            const panel = document.getElementById('ai-assistant-panel');
            return panel && !panel.classList.contains('collapsed');
        });
        await page.waitForFunction(() => {
            const panel = document.getElementById('ai-assistant-panel');
            const inputArea = document.getElementById('chat-input-area');
            if (!panel || panel.classList.contains('collapsed')) return false;
            const panelRect = panel.getBoundingClientRect();
            const inputRect = inputArea?.getBoundingClientRect?.();
            const panelReady = panelRect.width >= 240;
            const inputReady = !inputRect || inputRect.width >= 120;
            return panelReady && inputReady;
        });
        await page.waitForTimeout(50);

        const expandedState = await measureMobileAiLayout(page);
        await capture(page, `ai-mobile-${scenario.name}-expanded.png`);

        assertCondition(expandedState.aiPanelOpen, `${scenario.name}: expanded AI panel should set ai-panel-open`);
        assertNoOverlap(
            `${scenario.name}: Expanded AI panel and mobile controls`,
            expandedState.panelRect,
            expandedState.controlsRect
        );
        assertNoOverlap(
            `${scenario.name}: Expanded AI panel and status bar`,
            expandedState.panelRect,
            expandedState.statusRect
        );
        assertNoOverlap(
            `${scenario.name}: Chat input and mobile controls`,
            expandedState.chatInputRect,
            expandedState.controlsRect
        );
        assertNoOverlap(
            `${scenario.name}: Chat input and status bar`,
            expandedState.chatInputRect,
            expandedState.statusRect
        );
        assertCondition(expandedState.resizeDisplay === 'none', `${scenario.name}: resize handle should be hidden`);
        assertTouchTargets(expandedState);
        assertCondition(
            Number.isFinite(expandedState.chatInputFontSize) && expandedState.chatInputFontSize >= 16,
            `${scenario.name}: chat input font size should be >= 16px (actual ${expandedState.chatInputFontSize})`
        );

        if (scenario.expectLandscape) {
            assertCondition(
                Number.isFinite(expandedState.contentPaddingHorizontal) && expandedState.contentPaddingHorizontal <= 10,
                `${scenario.name}: landscape content horizontal padding should be <=10px (actual ${expandedState.contentPaddingHorizontal})`
            );
            assertCondition(
                expandedState.chatInputRect?.height <= 62,
                `${scenario.name}: landscape input area should stay compact (<=62px, actual ${expandedState.chatInputRect?.height})`
            );
        }
        if (scenario.narrow) {
            assertCondition(
                Number.isFinite(expandedState.contentPaddingHorizontal) && expandedState.contentPaddingHorizontal <= 10,
                `${scenario.name}: narrow content horizontal padding should be <=10px (actual ${expandedState.contentPaddingHorizontal})`
            );
        }

        await page.click('#chat-input');
        await page.waitForFunction(() => document.body.classList.contains('ai-input-active'));
        const typingState = await measureMobileAiLayout(page);
        assertCondition(typingState.chatInputFocused, `${scenario.name}: chat input should be focused`);
        assertCondition(typingState.aiInputActive, `${scenario.name}: typing should toggle ai-input-active`);
        assertCondition(
            typingState.controlsPointerEvents === 'none' || typingState.controlsOpacity <= 0.05,
            `${scenario.name}: mobile controls should hide while typing (pointer-events=${typingState.controlsPointerEvents}, opacity=${typingState.controlsOpacity})`
        );

        await page.click('#ai-panel-header');
        await page.waitForTimeout(180);
        const blurState = await measureMobileAiLayout(page);
        assertCondition(!blurState.aiInputActive, `${scenario.name}: ai-input-active should clear after blur`);

        const densityProbe = await page.evaluate(() => {
            const panel = window.app?.aiPanel;
            if (!panel || typeof panel.addChatMessage !== 'function') {
                return { ok: false, reason: 'missing-ai-panel' };
            }
            const shortId = panel.addChatMessage('assistant', '短回答');
            const longId = panel.addChatMessage(
                'assistant',
                ('第一步：建立等效。\n第二步：计算节点。\n- 条件A\n- 条件B\n```\\nI=U/R\\n```\\n').repeat(6),
                { markdown: true }
            );
            const shortEl = document.querySelector(`#${CSS.escape(shortId)} .chat-message-content`);
            const longEl = document.querySelector(`#${CSS.escape(longId)} .chat-message-content`);
            return {
                ok: true,
                shortClass: shortEl?.className || '',
                longClass: longEl?.className || ''
            };
        });
        assertCondition(densityProbe.ok, `${scenario.name}: density probe should run`);
        assertCondition(
            densityProbe.shortClass.includes('chat-density-compact'),
            `${scenario.name}: short assistant message should be compact density`
        );
        assertCondition(
            densityProbe.longClass.includes('chat-density-relaxed'),
            `${scenario.name}: long assistant message should be relaxed density`
        );

        await context.close();
    }
}

async function main() {
    const server = await startStaticServer();
    const browser = await createBrowser();
    try {
        await runScenario(browser, server.baseUrl);
        console.log('ai-mobile-layout-regression: PASS');
    } finally {
        await browser.close();
        await server.close();
    }
}

main().catch((error) => {
    console.error('ai-mobile-layout-regression: FAIL');
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = 1;
});
