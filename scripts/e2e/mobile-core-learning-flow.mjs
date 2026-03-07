#!/usr/bin/env node

import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    createMobileFlowMetricsCollector,
    MobileFlowTaskIds,
    summarizeMobileFlowMetrics
} from '../../src/core/metrics/MobileFlowMetrics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const outputDir = path.join(projectRoot, 'output', 'e2e', 'mobile-core-learning');
const reportPath = path.join(outputDir, 'mobile-core-learning-kpi.json');

const CORE_LEARNING_STEP_IDS = Object.freeze([
    'place-power-source',
    'place-resistor',
    'wire-series-loop',
    'run-simulation',
    'observe-readout'
]);

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
            'Playwright is required for this test suite.',
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

async function openPhonePage(browser, baseUrl) {
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true
    });

    await context.addInitScript(() => {
        try {
            localStorage.clear();
            localStorage.setItem('ui.first_run_guide_dismissed', '1');
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

async function runCoreLearningFlow(page) {
    const startedAt = Date.now();
    const setup = await page.evaluate((stepIds) => {
        const app = window.app;
        const interaction = app?.interaction;
        const renderer = app?.renderer;
        const circuit = app?.circuit;
        if (!app || !interaction || !renderer || !circuit) {
            return {
                ok: false,
                error: 'app_not_ready',
                interactionCount: 0,
                steps: []
            };
        }

        const steps = [];
        let interactionCount = 0;
        let wireSequence = 0;
        const taskStart = performance.now();
        const recordStep = (id, completed, note = '') => {
            steps.push({ id, completed: !!completed, note });
        };
        const makeWireId = () => `mobile_core_learning_${Date.now()}_${wireSequence++}`;
        const add = (type, x, y) => {
            interactionCount += 1;
            const result = interaction.addComponent(type, x, y);
            if (!result?.ok || !result?.payload?.componentId) {
                throw new Error(`add_component_failed:${type}`);
            }
            return result.payload.componentId;
        };
        const connect = (fromId, fromTerminal, toId, toTerminal) => {
            const from = renderer.getTerminalPosition(fromId, fromTerminal);
            const to = renderer.getTerminalPosition(toId, toTerminal);
            if (!from || !to) {
                throw new Error(`terminal_position_missing:${fromId}:${fromTerminal}->${toId}:${toTerminal}`);
            }
            const wire = {
                id: makeWireId(),
                a: { x: from.x, y: from.y },
                b: { x: to.x, y: to.y },
                aRef: { componentId: fromId, terminalIndex: fromTerminal },
                bRef: { componentId: toId, terminalIndex: toTerminal }
            };
            circuit.addWire(wire);
            renderer.addWire(wire);
            interactionCount += 1;
            return wire.id;
        };

        try {
            app.clearCircuit?.();
            const source = add('PowerSource', 90, 220);
            recordStep(stepIds[0], !!source);
            const resistor = add('Resistor', 250, 220);
            recordStep(stepIds[1], !!resistor);

            const firstWireId = connect(source, 0, resistor, 0);
            const secondWireId = connect(resistor, 1, source, 1);
            recordStep(stepIds[2], !!firstWireId && !!secondWireId);

            interaction.selectComponent?.(resistor);
            interactionCount += 1;
            app.startSimulation?.();
            interactionCount += 1;
            recordStep(stepIds[3], true);

            return {
                ok: true,
                interactionCount,
                durationMs: Math.round(performance.now() - taskStart),
                steps,
                resistorId: resistor
            };
        } catch (error) {
            return {
                ok: false,
                interactionCount,
                durationMs: Math.round(performance.now() - taskStart),
                steps,
                error: error?.message || String(error)
            };
        }
    }, CORE_LEARNING_STEP_IDS);

    if (!setup.ok) {
        return {
            ok: false,
            success: false,
            interactionCount: setup.interactionCount || 0,
            durationMs: Math.max(0, Date.now() - startedAt),
            steps: setup.steps || [],
            observationConfirmed: false,
            error: setup.error || 'unknown_error'
        };
    }

    await page.waitForTimeout(220);

    const observation = await page.evaluate((observeStepId) => {
        const current = document.getElementById('measure-current')?.textContent?.trim() || '';
        const voltage = document.getElementById('measure-voltage')?.textContent?.trim() || '';
        const power = document.getElementById('measure-power')?.textContent?.trim() || '';
        const observed = /\d/.test(current) && /\d/.test(voltage) && /\d/.test(power);
        const circuit = window.app?.circuit;
        const circuitState = {
            componentCount: circuit?.components?.size || 0,
            wireCount: circuit?.wires?.size || 0,
            valid: !!circuit?.lastResults?.valid
        };
        window.app?.stopSimulation?.();
        return {
            step: {
                id: observeStepId,
                completed: observed,
                note: observed ? '' : 'numeric readout missing'
            },
            current,
            voltage,
            power,
            observed,
            circuit: circuitState
        };
    }, CORE_LEARNING_STEP_IDS[4]);

    return {
        ok: setup.ok && observation.observed,
        success: setup.ok && observation.observed,
        interactionCount: (Number(setup.interactionCount) || 0) + 1,
        tapCount: (Number(setup.interactionCount) || 0) + 1,
        durationMs: Math.max(Number(setup.durationMs) || 0, Date.now() - startedAt),
        steps: [...(setup.steps || []), observation.step],
        observationConfirmed: observation.observed,
        observation,
        circuit: observation.circuit || null,
        error: observation.observed ? '' : 'observe_readout_missing'
    };
}

async function main() {
    await mkdir(outputDir, { recursive: true });
    const server = await startStaticServer();
    let browser = null;

    try {
        browser = await createBrowser();
        const { context, page } = await openPhonePage(browser, server.baseUrl);
        try {
            const collector = createMobileFlowMetricsCollector();
            const flow = await runCoreLearningFlow(page);
            collector.recordTaskResult(MobileFlowTaskIds.SeriesBuild, {
                tapCount: flow.tapCount,
                interactionCount: flow.interactionCount,
                durationMs: flow.durationMs,
                success: flow.success,
                observationConfirmed: flow.observationConfirmed,
                steps: flow.steps,
                note: flow.error || ''
            });

            const report = collector.toJSON();
            const activeReport = {
                generatedAt: report.generatedAt,
                tasks: report.tasks.filter((task) => {
                    return task.tapCount > 0
                        || task.interactionCount > 0
                        || task.durationMs > 0
                        || task.steps.length > 0
                        || task.success;
                })
            };
            const summary = summarizeMobileFlowMetrics(activeReport);

            assertCondition(flow.success, `core learning flow failed: ${flow.error || 'unknown_error'}`);
            assertCondition(flow.interactionCount >= 5, 'core learning flow interactionCount should cover place, wire, run, observe');
            assertCondition(summary?.taskKpi?.completionRate === 1, 'core learning flow must complete all required steps');
            assertCondition(summary?.taskKpi?.observationRate === 1, 'core learning flow must confirm observation step');
            assertCondition(flow.circuit?.valid === true, 'core learning flow circuit should settle to a valid reading before report output');

            await writeFile(reportPath, `${JSON.stringify({
                flow: {
                    taskId: MobileFlowTaskIds.SeriesBuild,
                    interactionCount: flow.interactionCount,
                    tapCount: flow.tapCount,
                    durationMs: flow.durationMs,
                    success: flow.success,
                    steps: flow.steps,
                    observationConfirmed: flow.observationConfirmed,
                    observation: flow.observation,
                    circuit: flow.circuit
                },
                metrics: {
                    report: activeReport,
                    summary
                }
            }, null, 2)}\n`, 'utf8');

            console.log('Mobile core learning KPI flow passed.');
            console.log(`KPI report: ${reportPath}`);
        } finally {
            await context.close();
        }
    } finally {
        if (browser) {
            await browser.close();
        }
        await server.close();
    }
}

main().catch((error) => {
    console.error(error?.message || String(error));
    process.exitCode = 1;
});
