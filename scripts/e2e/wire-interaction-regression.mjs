#!/usr/bin/env node

import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const outputDir = path.join(projectRoot, 'output', 'e2e', 'wire-interaction');

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

async function openScenarioPage(browser, baseUrl) {
    const context = await browser.newContext({
        viewport: { width: 1366, height: 768 },
        isMobile: false,
        hasTouch: false
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
    await page.waitForFunction(() => Boolean(window.app?.interaction && window.app?.renderer));

    return { context, page };
}

async function capture(page, fileName) {
    await mkdir(outputDir, { recursive: true });
    await page.screenshot({ path: path.join(outputDir, fileName), fullPage: true });
}

async function runWireInteractionRegression(browser, baseUrl) {
    const { context, page } = await openScenarioPage(browser, baseUrl);
    try {
        const summary = await page.evaluate(async () => {
            const app = window.app;
            const interaction = app?.interaction;
            const svg = app?.svg;

            if (!app || !interaction || !svg) {
                return { ok: false, error: 'app/interaction/svg not initialized' };
            }

            const near = (a, b, eps = 0.75) => Math.abs(Number(a) - Number(b)) <= eps;
            const pointMatches = (point, x, y) => near(point?.x, x) && near(point?.y, y);

            const toClient = (canvasX, canvasY) => {
                const rect = svg.getBoundingClientRect();
                return {
                    clientX: rect.left + interaction.viewOffset.x + canvasX * interaction.scale,
                    clientY: rect.top + interaction.viewOffset.y + canvasY * interaction.scale
                };
            };

            const resetScene = () => {
                app.clearCircuit();
                interaction.scale = 1;
                interaction.viewOffset = { x: 0, y: 0 };
                interaction.updateViewTransform();
                interaction.cancelWiring();
            };

            const snapshotWireEndpoints = () => {
                return app.circuit.getAllWires().map((wire) => ({
                    id: wire.id,
                    a: { x: wire.a?.x, y: wire.a?.y },
                    b: { x: wire.b?.x, y: wire.b?.y }
                }));
            };

            const result = {
                terminalSnapMatrix: [],
                zoomEndpointMatrix: [],
                defaultTerminalAction: null,
                segmentHighlight: null,
                endpointAutoSplit: null
            };

            const scales = [0.5, 1, 2, 4];
            const pointers = ['mouse', 'pen', 'touch'];

            // WIR-003: terminal snapping should not be narrower than terminal hit area.
            resetScene();
            const addRes = interaction.addComponent('Resistor', 220, 220);
            if (!addRes?.ok || !addRes.payload?.componentId) {
                return { ok: false, error: 'failed to create resistor for terminal matrix' };
            }
            const terminalCompId = addRes.payload.componentId;
            const terminalPos = app.renderer.getTerminalPosition(terminalCompId, 0);
            if (!terminalPos) {
                return { ok: false, error: 'failed to resolve terminal position for terminal matrix' };
            }
            for (const scale of scales) {
                interaction.scale = scale;
                interaction.updateViewTransform();
                for (const pointerType of pointers) {
                    const snapped = interaction.snapPoint(terminalPos.x + 20, terminalPos.y, { pointerType });
                    const pass = snapped?.snap?.type === 'terminal'
                        && snapped?.snap?.componentId === terminalCompId
                        && snapped?.snap?.terminalIndex === 0;
                    result.terminalSnapMatrix.push({
                        scale,
                        pointerType,
                        snapType: snapped?.snap?.type || null,
                        pass
                    });
                }
            }

            // B001: zoom-in/zoom-out should preserve endpoint snapping for same screen distance.
            resetScene();
            app.circuit.addWire({ id: 'WZ1', a: { x: 300, y: 200 }, b: { x: 360, y: 200 } });
            app.renderer.renderWires();
            for (const scale of scales) {
                interaction.scale = scale;
                interaction.updateViewTransform();
                const snapped = interaction.snapPoint(300 + 12 / scale, 200, { pointerType: 'mouse' });
                result.zoomEndpointMatrix.push({
                    scale,
                    snapType: snapped?.snap?.type || null,
                    pass: snapped?.snap?.type === 'wire-endpoint'
                        && snapped?.snap?.wireId === 'WZ1'
                        && snapped?.snap?.end === 'a'
                });
            }

            // WIR-004: default terminal action should start wiring; Alt+terminal should extend lead.
            resetScene();
            const addRes2 = interaction.addComponent('Resistor', 260, 260);
            if (!addRes2?.ok || !addRes2.payload?.componentId) {
                return { ok: false, error: 'failed to create resistor for terminal default-action check' };
            }
            const compId = addRes2.payload.componentId;
            const terminalEl = document.querySelector(
                `g.component[data-id="${compId}"] .terminal-hit-area[data-terminal="0"]`
            );
            if (!terminalEl) {
                return { ok: false, error: 'failed to query terminal hit element' };
            }
            const term0 = app.renderer.getTerminalPosition(compId, 0);
            if (!term0) {
                return { ok: false, error: 'failed to resolve terminal position for default-action check' };
            }
            const baseClient = toClient(term0.x, term0.y);
            const baseEvent = {
                button: 0,
                ctrlKey: false,
                metaKey: false,
                shiftKey: false,
                target: terminalEl,
                pointerType: 'mouse',
                clientX: baseClient.clientX,
                clientY: baseClient.clientY,
                preventDefault: () => {},
                stopPropagation: () => {}
            };

            interaction.onMouseDown({ ...baseEvent, altKey: false });
            const defaultStartsWiring = interaction.isWiring
                && interaction.wireStart?.snap?.type === 'terminal'
                && interaction.wireStart?.snap?.componentId === compId
                && interaction.wireStart?.snap?.terminalIndex === 0;
            interaction.cancelWiring();

            const originalStartTerminalExtend = interaction.startTerminalExtend;
            let extendCallCount = 0;
            interaction.startTerminalExtend = (...args) => {
                extendCallCount += 1;
                return undefined;
            };
            interaction.onMouseDown({ ...baseEvent, altKey: true });
            interaction.startTerminalExtend = originalStartTerminalExtend;

            result.defaultTerminalAction = {
                defaultStartsWiring,
                altExtendsLead: extendCallCount === 1,
                pass: defaultStartsWiring && extendCallCount === 1
            };

            // WIR-005: wire-segment snaps should render node highlight during preview and endpoint drag.
            resetScene();
            app.circuit.addWire({ id: 'WH_PREVIEW', a: { x: 120, y: 220 }, b: { x: 320, y: 220 } });
            app.renderer.renderWires();
            interaction.startWiringFromPoint(
                { x: 80, y: 180 },
                { ...toClient(80, 180), pointerType: 'mouse' }
            );
            interaction.onMouseMove({ ...toClient(210, 226), target: svg, pointerType: 'mouse' });
            const hasPreviewHighlight = Boolean(document.querySelector('.wire-node-highlight'));
            interaction.cancelWiring();

            resetScene();
            app.circuit.addWire({ id: 'WH_DRAG', a: { x: 60, y: 120 }, b: { x: 140, y: 120 } });
            app.circuit.addWire({ id: 'WH_TARGET', a: { x: 180, y: 90 }, b: { x: 280, y: 90 } });
            app.renderer.renderWires();
            interaction.startWireEndpointDrag('WH_DRAG', 'b', {
                shiftKey: false,
                ...toClient(140, 120),
                preventDefault: () => {},
                stopPropagation: () => {}
            });
            interaction.onMouseMove({ ...toClient(220, 92), target: svg, pointerType: 'mouse' });
            const hasDragHighlight = Boolean(document.querySelector('.wire-node-highlight'));
            interaction.onMouseUp({ target: svg });

            result.segmentHighlight = {
                hasPreviewHighlight,
                hasDragHighlight,
                pass: hasPreviewHighlight && hasDragHighlight
            };

            // WIR-006 + WIR-002: endpoint drag onto diagonal segment should snap and auto-split target wire.
            resetScene();
            app.circuit.addWire({ id: 'W1', a: { x: 40, y: 300 }, b: { x: 120, y: 300 } });
            app.circuit.addWire({ id: 'W2', a: { x: 180, y: 260 }, b: { x: 260, y: 340 } });
            app.renderer.renderWires();
            interaction.startWireEndpointDrag('W1', 'b', {
                shiftKey: false,
                ...toClient(120, 300),
                preventDefault: () => {},
                stopPropagation: () => {}
            });
            interaction.onMouseMove({ ...toClient(220, 300), target: svg, pointerType: 'mouse' });
            const lastSnapType = interaction.wireEndpointDrag?.lastSnap?.type || null;
            const lastSnapWireId = interaction.wireEndpointDrag?.lastSnap?.wireId || null;
            interaction.onMouseUp({ target: svg });

            const wiresAfter = snapshotWireEndpoints();
            const splitPointConnections = wiresAfter.filter(
                (wire) => pointMatches(wire.a, 220, 300) || pointMatches(wire.b, 220, 300)
            ).length;
            const hasSplitResult = wiresAfter.length >= 3 && splitPointConnections >= 3;
            result.endpointAutoSplit = {
                lastSnapType,
                lastSnapWireId,
                wireCount: wiresAfter.length,
                splitPointConnections,
                pass: lastSnapType === 'wire-segment' && lastSnapWireId === 'W2' && hasSplitResult
            };

            const allPass = result.terminalSnapMatrix.every((row) => row.pass)
                && result.zoomEndpointMatrix.every((row) => row.pass)
                && result.defaultTerminalAction?.pass
                && result.segmentHighlight?.pass
                && result.endpointAutoSplit?.pass;

            return { ok: true, allPass, result };
        });

        assertCondition(summary?.ok, summary?.error || 'wire interaction regression page-eval failed');
        assertCondition(summary.allPass, `wire interaction regressions failed:\n${JSON.stringify(summary.result, null, 2)}`);

        await capture(page, 'wire-interaction-regression.png');
        return summary.result;
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
        const result = await runWireInteractionRegression(browser, server.baseUrl);
        console.log('Wire interaction E2E passed.');
        console.log(`Screenshots: ${outputDir}`);
        console.log(JSON.stringify(result, null, 2));
    } finally {
        if (browser) {
            await browser.close();
        }
        await server.close();
    }
}

main().catch((error) => {
    console.error('[wire-interaction-e2e] FAILED');
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = 1;
});
