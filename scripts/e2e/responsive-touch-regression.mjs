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
const outputDir = path.join(projectRoot, 'output', 'e2e', 'responsive-touch');
const diffNotesPath = path.join(outputDir, 'responsive-touch-diff-notes.md');
const failureArtifacts = [];

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

async function recordFailureArtifact(scenario, page, error) {
    let screenshotPath = '';
    const fileName = `failure-${scenario}.png`;
    try {
        if (page) {
            await capture(page, fileName);
            screenshotPath = path.join(outputDir, fileName);
        }
    } catch (_) {
        screenshotPath = '';
    }

    failureArtifacts.push({
        scenario,
        message: error?.message || String(error),
        screenshotPath
    });
}

async function writeDiffNotes(entries = [], options = {}) {
    const generatedAt = new Date().toISOString();
    const intro = options.intro || 'Responsive touch regression diff notes';
    const lines = [
        '# Responsive Touch Diff Notes',
        '',
        `Generated at: ${generatedAt}`,
        '',
        intro,
        ''
    ];

    if (!entries.length) {
        lines.push('## Result');
        lines.push('- No failures in this run.');
        lines.push('- Expanded edit + measure workflow checks passed.');
    } else {
        lines.push('## Failures');
        entries.forEach((entry, index) => {
            lines.push(`${index + 1}. Scenario: ${entry.scenario}`);
            lines.push(`- Error: ${entry.message}`);
            lines.push(`- Screenshot: ${entry.screenshotPath || 'not-captured'}`);
        });
    }

    await writeFile(diffNotesPath, `${lines.join('\n')}\n`, 'utf8');
}

async function runPhoneTaskScenario(page, taskId) {
    return page.evaluate((task) => {
        const app = window.app;
        const interaction = app?.interaction;
        const renderer = app?.renderer;
        const circuit = app?.circuit;
        if (!app || !interaction || !renderer || !circuit) {
            return {
                ok: false,
                tapCount: 0,
                durationMs: 0,
                error: 'app_not_ready'
            };
        }

        const taskStart = performance.now();
        let tapCount = 0;
        let wireSequence = 0;

        const makeWireId = () => `e2e_${task}_${Date.now()}_${wireSequence++}`;
        const add = (type, x, y) => {
            tapCount += 1;
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
            tapCount += 1;
            circuit.addWire(wire);
            renderer.addWire(wire);
            return wire.id;
        };

        try {
            app.clearCircuit?.();

            if (task === 'series-build') {
                const source = add('PowerSource', 100, 180);
                const resistor = add('Resistor', 260, 180);
                connect(source, 0, resistor, 0);
                connect(resistor, 1, source, 1);
            } else if (task === 'parallel-build') {
                const source = add('PowerSource', 100, 220);
                const resistorA = add('Resistor', 260, 160);
                const resistorB = add('Resistor', 260, 280);
                connect(source, 0, resistorA, 0);
                connect(source, 0, resistorB, 0);
                connect(resistorA, 1, source, 1);
                connect(resistorB, 1, source, 1);
            } else if (task === 'probe-measurement') {
                const source = add('PowerSource', 100, 180);
                const resistor = add('Resistor', 260, 180);
                const w1 = connect(source, 0, resistor, 0);
                connect(resistor, 1, source, 1);

                const beforeProbeCount = (circuit.getAllObservationProbes?.() || []).length;
                const beforePlotCount = Array.isArray(app.observationPanel?.plots) ? app.observationPanel.plots.length : 0;
                tapCount += 1;
                interaction.addObservationProbeForWire?.(w1, 'WireCurrentProbe', { autoAddPlot: true });
                const probes = circuit.getAllObservationProbes?.() || [];
                if (probes.length <= beforeProbeCount) {
                    throw new Error('probe_add_failed');
                }
                const afterPlotCount = Array.isArray(app.observationPanel?.plots) ? app.observationPanel.plots.length : 0;
                if (afterPlotCount <= beforePlotCount) {
                    throw new Error('probe_plot_auto_add_failed');
                }
            } else {
                throw new Error(`unknown_task:${task}`);
            }

            tapCount += 1;
            app.startSimulation?.();
            tapCount += 1;
            app.stopSimulation?.();

            return {
                ok: true,
                tapCount,
                durationMs: Math.round(performance.now() - taskStart),
                details: {
                    componentCount: circuit.components?.size || 0,
                    wireCount: circuit.wires?.size || 0,
                    valid: !!circuit.lastResults?.valid
                }
            };
        } catch (error) {
            return {
                ok: false,
                tapCount,
                durationMs: Math.round(performance.now() - taskStart),
                error: error?.message || String(error)
            };
        }
    }, taskId);
}

async function collectMobileTaskBaselines(page, collector) {
    const tasks = [
        MobileFlowTaskIds.SeriesBuild,
        MobileFlowTaskIds.ParallelBuild,
        MobileFlowTaskIds.ProbeMeasurement
    ];

    for (const taskId of tasks) {
        const result = await runPhoneTaskScenario(page, taskId);
        collector.recordTaskResult(taskId, {
            tapCount: result.tapCount,
            durationMs: result.durationMs,
            success: !!result.ok,
            note: result.ok ? '' : (result.error || 'unknown_error')
        });
        assertCondition(result.ok, `mobile task baseline failed for ${taskId}: ${result.error || 'unknown_error'}`);
        assertCondition(result.tapCount > 0, `mobile task baseline tap count should be > 0 for ${taskId}`);
    }
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
        const quickBarVisible = await page.evaluate(() => {
            const bar = document.getElementById('quick-action-bar');
            if (!bar) return false;
            const style = window.getComputedStyle(bar);
            const rect = bar.getBoundingClientRect();
            return bar.hidden === false && style.display !== 'none' && rect.width > 0 && rect.height > 0;
        });
        assertCondition(!quickBarVisible, 'quick-action bar should stay hidden in desktop idle state');
        await capture(page, 'desktop-1366x768.png');

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

        await capture(page, 'desktop-1366x768-classroom-mode.png');
    } catch (error) {
        await recordFailureArtifact('desktop-layout', page, error);
        throw error;
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
    } catch (error) {
        await recordFailureArtifact('tablet-layout', page, error);
        throw error;
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

        const addResult = await page.evaluate(() => {
            const result = window.app?.interaction?.addComponent?.('Resistor', 320, 320);
            return result || null;
        });
        assertCondition(addResult?.ok === true, `failed to add component in compact mode: ${JSON.stringify(addResult)}`);
        await page.waitForFunction(() => {
            const bar = document.getElementById('quick-action-bar');
            return !!bar && bar.hidden === false;
        });

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
        const quickActionHidden = await page.evaluate(() => document.getElementById('quick-action-bar')?.hidden === true);
        assertCondition(quickActionHidden, 'quick-action bar should hide while overlay drawers are open');

        await capture(page, 'compact-768x1024-drawers.png');
    } catch (error) {
        await recordFailureArtifact('compact-drawer-behavior', page, error);
        throw error;
    } finally {
        await context.close();
    }
}

async function verifyPhoneTouchFlow(browser, baseUrl, collector) {
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

        const topActionState = await page.evaluate(() => {
            const isVisible = (id) => {
                const node = document.getElementById(id);
                if (!node) return false;
                const style = window.getComputedStyle(node);
                if (style.display === 'none' || style.visibility === 'hidden') return false;
                const rect = node.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0;
            };
            return {
                moreVisible: isVisible('btn-top-action-more'),
                clearVisible: isVisible('btn-clear'),
                exportVisible: isVisible('btn-export'),
                importVisible: isVisible('btn-import'),
                exerciseVisible: isVisible('btn-exercise-board')
            };
        });
        assertCondition(topActionState.moreVisible, 'phone mode should display top more button');
        assertCondition(!topActionState.clearVisible, 'desktop clear button should be hidden in phone mode');
        assertCondition(!topActionState.exportVisible, 'desktop export button should be hidden in phone mode');
        assertCondition(!topActionState.importVisible, 'desktop import button should be hidden in phone mode');
        assertCondition(!topActionState.exerciseVisible, 'desktop exercise button should be hidden in phone mode');

        await page.click('#btn-top-action-more');
        await page.waitForFunction(() => {
            const menu = document.getElementById('top-action-more-menu');
            return !!menu && menu.hidden === false && menu.classList.contains('open');
        });
        const menuLabels = await page.$$eval('#top-action-more-menu .top-action-more-item', (items) => {
            return items.map((item) => item.textContent?.trim() || '');
        });
        ['清空电路', '导出JSON', '导入JSON', '习题板'].forEach((label) => {
            assertCondition(menuLabels.includes(label), `phone more menu missing item: ${label}`);
        });
        await page.click('#btn-mobile-export');
        await page.waitForFunction(() => {
            const menu = document.getElementById('top-action-more-menu');
            return !!menu && menu.hidden === true;
        });

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
        assertCondition(quickActionState.actions.length >= 4, `expected at least 4 component quick actions, got ${quickActionState.actions.length}`);
        ['编辑', '旋转', '复制', '删除'].forEach((expectedLabel) => {
            assertCondition(
                quickActionState.actions.includes(expectedLabel),
                `quick-action bar missing action: ${expectedLabel}`
            );
        });

        await page.click('#quick-action-bar .quick-action-btn[data-action="component-edit"]');
        await page.waitForFunction(() => {
            const overlay = document.getElementById('dialog-overlay');
            return !!overlay && !overlay.classList.contains('hidden');
        });
        const dialogTitle = await page.$eval('#dialog-title', (el) => el.textContent?.trim() || '');
        assertCondition(dialogTitle.includes('编辑'), `component edit dialog title mismatch: ${dialogTitle}`);
        await page.click('#dialog-cancel');
        await page.waitForFunction(() => {
            const overlay = document.getElementById('dialog-overlay');
            return !!overlay && overlay.classList.contains('hidden');
        });

        await page.click('#btn-toggle-side-panel');
        await page.waitForFunction(() => {
            const sidePanel = document.getElementById('side-panel');
            return !!sidePanel?.classList.contains('layout-open');
        });
        await page.waitForTimeout(260);
        const propertyCardState = await page.evaluate(() => {
            const content = document.getElementById('property-content');
            const measurementCard = content?.querySelector?.('.property-card-measurement');
            const measureIds = Array.from(measurementCard?.querySelectorAll?.('.value[id]') || []).map((el) => el.id);
            return {
                cardCount: content?.querySelectorAll?.('.property-card').length || 0,
                hasSummary: !!content?.querySelector?.('.property-card-summary'),
                hasParameters: !!content?.querySelector?.('.property-card-parameters'),
                hasMeasurement: !!measurementCard,
                measureIds
            };
        });
        assertCondition(propertyCardState.cardCount >= 3, `property cards should render at least 3 cards, got ${propertyCardState.cardCount}`);
        assertCondition(propertyCardState.hasSummary, 'property panel should include summary card');
        assertCondition(propertyCardState.hasParameters, 'property panel should include parameter card');
        assertCondition(propertyCardState.hasMeasurement, 'property panel should include measurement card');
        ['measure-current', 'measure-voltage', 'measure-power'].forEach((id) => {
            assertCondition(propertyCardState.measureIds.includes(id), `measurement card missing ${id}`);
        });
        await capture(page, 'phone-390x844-property-cards.png');
        await page.evaluate(() => {
            window.app?.responsiveLayout?.closeDrawers?.();
        });
        await page.waitForFunction(() => {
            const sidePanel = document.getElementById('side-panel');
            return !sidePanel?.classList.contains('layout-open');
        });

        await page.click('#btn-toggle-side-panel');
        await page.waitForFunction(() => {
            const sidePanel = document.getElementById('side-panel');
            return !!sidePanel?.classList.contains('layout-open');
        });

        const phoneBottomOverlap = await page.evaluate(() => {
            const bar = document.getElementById('quick-action-bar');
            const statusBar = document.getElementById('status-bar');
            if (!bar || !statusBar) return Number.POSITIVE_INFINITY;
            const b = bar.getBoundingClientRect();
            const s = statusBar.getBoundingClientRect();
            return Math.max(0, Math.min(b.bottom, s.bottom) - Math.max(b.top, s.top));
        });
        assertCondition(
            phoneBottomOverlap <= 0,
            `quick-action bar should not overlap status bar on phone, overlap=${phoneBottomOverlap}px`
        );

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

        await page.evaluate(() => {
            const backdrop = document.getElementById('layout-backdrop');
            if (backdrop && backdrop.hidden === false) {
                backdrop.click();
            }
            window.app?.responsiveLayout?.closeDrawers?.();
        });
        await page.waitForFunction(() => {
            const backdrop = document.getElementById('layout-backdrop');
            return !backdrop || backdrop.hidden !== false;
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

        const editMeasureSetup = await page.evaluate(() => {
            const app = window.app;
            const interaction = app?.interaction;
            const renderer = app?.renderer;
            const circuit = app?.circuit;
            if (!app || !interaction || !renderer || !circuit) {
                return { ok: false, error: 'app_not_ready' };
            }

            let wireSeq = 0;
            const makeWireId = () => `e2e_day12_measure_${Date.now()}_${wireSeq++}`;
            const add = (type, x, y) => {
                const result = interaction.addComponent(type, x, y);
                if (!result?.ok || !result?.payload?.componentId) return null;
                return result.payload.componentId;
            };
            const connect = (fromId, fromTerminal, toId, toTerminal) => {
                const from = renderer.getTerminalPosition(fromId, fromTerminal);
                const to = renderer.getTerminalPosition(toId, toTerminal);
                if (!from || !to) return false;
                const wire = {
                    id: makeWireId(),
                    a: { x: from.x, y: from.y },
                    b: { x: to.x, y: to.y },
                    aRef: { componentId: fromId, terminalIndex: fromTerminal },
                    bRef: { componentId: toId, terminalIndex: toTerminal }
                };
                circuit.addWire(wire);
                renderer.addWire(wire);
                return true;
            };

            app.clearCircuit?.();
            const source = add('PowerSource', 90, 220);
            const resistor = add('Resistor', 250, 220);
            if (!source || !resistor) {
                return { ok: false, error: 'add_component_failed' };
            }
            if (!connect(source, 0, resistor, 0) || !connect(resistor, 1, source, 1)) {
                return { ok: false, error: 'wire_connect_failed' };
            }
            interaction.selectComponent?.(resistor);
            app.startSimulation?.();
            return { ok: true, resistorId: resistor };
        });
        assertCondition(editMeasureSetup.ok, `edit+measure setup failed: ${editMeasureSetup.error || 'unknown_error'}`);

        await page.waitForTimeout(220);

        const readoutState = await page.evaluate(() => {
            const current = document.getElementById('measure-current')?.textContent?.trim() || '';
            const voltage = document.getElementById('measure-voltage')?.textContent?.trim() || '';
            const power = document.getElementById('measure-power')?.textContent?.trim() || '';
            return {
                current,
                voltage,
                power,
                hasCurrent: /\d/.test(current),
                hasVoltage: /\d/.test(voltage),
                hasPower: /\d/.test(power)
            };
        });
        assertCondition(readoutState.hasCurrent, `measurement current readout missing numeric value: ${readoutState.current}`);
        assertCondition(readoutState.hasVoltage, `measurement voltage readout missing numeric value: ${readoutState.voltage}`);
        assertCondition(readoutState.hasPower, `measurement power readout missing numeric value: ${readoutState.power}`);
        await capture(page, 'phone-390x844-edit-measure-workflow.png');

        await page.evaluate(() => {
            window.app?.stopSimulation?.();
            window.app?.responsiveLayout?.closeDrawers?.();
        });

        await collectMobileTaskBaselines(page, collector);
        await capture(page, 'phone-390x844-touch-flow.png');
    } catch (error) {
        await recordFailureArtifact('phone-touch-flow', page, error);
        throw error;
    } finally {
        await context.close();
    }
}

async function main() {
    await mkdir(outputDir, { recursive: true });

    const server = await startStaticServer();
    let browser = null;
    const metricsCollector = createMobileFlowMetricsCollector();

    try {
        browser = await createBrowser();

        await verifyDesktopLayout(browser, server.baseUrl);
        await verifyTabletLayout(browser, server.baseUrl);
        await verifyCompactDrawerBehavior(browser, server.baseUrl);
        await verifyPhoneTouchFlow(browser, server.baseUrl, metricsCollector);

        const metricsReport = metricsCollector.toJSON();
        const metricsSummary = summarizeMobileFlowMetrics(metricsReport);
        const baselinePath = path.join(outputDir, 'mobile-flow-baseline.json');
        await writeFile(
            baselinePath,
            `${JSON.stringify({ report: metricsReport, summary: metricsSummary }, null, 2)}\n`,
            'utf8'
        );
        await writeDiffNotes([], {
            intro: 'Responsive touch regressions passed with expanded edit + measure workflow checks.'
        });

        console.log('Responsive touch E2E passed.');
        console.log(`Mobile task baseline: ${path.join(outputDir, 'mobile-flow-baseline.json')}`);
        console.log(`Diff notes: ${diffNotesPath}`);
        console.log(`Screenshots: ${outputDir}`);
    } catch (error) {
        if (failureArtifacts.length === 0) {
            failureArtifacts.push({
                scenario: 'main',
                message: error?.message || String(error),
                screenshotPath: ''
            });
        }
        await writeDiffNotes(failureArtifacts, {
            intro: 'Responsive touch regressions failed. See failure entries below.'
        });
        throw error;
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
