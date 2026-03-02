#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getInteractionModeSnapshot } from '../../src/ui/interaction/ToolPlacementController.js';

const POINTER_TYPES = ['mouse', 'pen', 'touch'];
const LAYOUT_MODES = ['desktop', 'tablet', 'compact', 'phone'];
const CLASSROOM_LEVELS = ['off', 'standard', 'enhanced'];
const EMBED_READONLY_STATES = [false, true];
const MODE_INTENTS = ['select', 'wire', 'endpoint-edit'];

function parseArgs(argv = []) {
    const options = {
        fixture: null,
        outputDir: path.resolve(process.cwd(), 'output', 'e2e', 'mode-conflict')
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (!arg) continue;

        if (arg === '--fixture') {
            options.fixture = argv[index + 1] || null;
            index += 1;
            continue;
        }
        if (arg.startsWith('--fixture=')) {
            options.fixture = arg.slice('--fixture='.length);
            continue;
        }
        if (arg === '--output-dir') {
            options.outputDir = argv[index + 1]
                ? path.resolve(process.cwd(), argv[index + 1])
                : options.outputDir;
            index += 1;
            continue;
        }
        if (arg.startsWith('--output-dir=')) {
            options.outputDir = path.resolve(process.cwd(), arg.slice('--output-dir='.length));
            continue;
        }

        throw new Error(`unknown argument: ${arg}`);
    }

    return options;
}

function withLayoutDocument(layoutMode, callback) {
    const hadDocument = Object.prototype.hasOwnProperty.call(globalThis, 'document');
    const previousDocument = globalThis.document;
    const classNames = new Set([`layout-mode-${layoutMode}`]);
    const mockedDocument = {
        body: {
            classList: {
                contains(name) {
                    return classNames.has(String(name || '').trim());
                }
            }
        }
    };

    globalThis.document = mockedDocument;
    try {
        return callback();
    } finally {
        if (hadDocument) {
            globalThis.document = previousDocument;
        } else {
            delete globalThis.document;
        }
    }
}

function createBaseContext({ classroomLevel, embedReadonly }) {
    return {
        app: {
            classroomMode: { activeLevel: classroomLevel },
            embedRuntimeBridge: {
                enabled: !!embedReadonly,
                readonly: !!embedReadonly
            }
        },
        pendingToolType: null,
        mobileInteractionMode: 'select',
        stickyWireTool: false,
        isWiring: false,
        isDraggingWireEndpoint: false,
        isTerminalExtending: false,
        isRheostatDragging: false,
        endpointAutoBridgeMode: 'auto'
    };
}

function applyModeIntent(context, modeIntent) {
    if (modeIntent === 'wire') {
        context.pendingToolType = 'Wire';
        context.mobileInteractionMode = 'wire';
        context.stickyWireTool = true;
        context.isWiring = true;
        return 'wire';
    }
    if (modeIntent === 'endpoint-edit') {
        context.isDraggingWireEndpoint = true;
        return 'endpoint-edit';
    }
    return 'select';
}

function expectedRuntime(layoutMode, classroomLevel, embedReadonly) {
    return {
        phoneLikeLayout: layoutMode === 'phone' || layoutMode === 'compact',
        classroomModeActive: classroomLevel !== 'off',
        embedRuntimeActive: !!embedReadonly
    };
}

function generateMatrixRows() {
    const rows = [];

    for (const pointerType of POINTER_TYPES) {
        for (const layoutMode of LAYOUT_MODES) {
            for (const classroomLevel of CLASSROOM_LEVELS) {
                for (const embedReadonly of EMBED_READONLY_STATES) {
                    for (const modeIntent of MODE_INTENTS) {
                        const context = createBaseContext({ classroomLevel, embedReadonly });
                        const expectedMode = applyModeIntent(context, modeIntent);
                        const snapshot = withLayoutDocument(layoutMode, () => getInteractionModeSnapshot.call(context));
                        rows.push({
                            pointerType,
                            layoutMode,
                            classroomLevel,
                            embedReadonly,
                            modeIntent,
                            expectedMode,
                            expectedRuntime: expectedRuntime(layoutMode, classroomLevel, embedReadonly),
                            snapshot
                        });
                    }
                }
            }
        }
    }

    return rows;
}

async function loadFixtureRows(fixtureArg) {
    if (!fixtureArg) return null;

    const fixturePath = path.resolve(process.cwd(), fixtureArg);
    if (!existsSync(fixturePath)) {
        throw new Error(`fixture not found: ${fixturePath}`);
    }

    const raw = await readFile(fixturePath, 'utf8');
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed) ? parsed : parsed?.rows;
    if (!Array.isArray(rows)) {
        throw new Error('fixture must be an array or an object with "rows" array');
    }
    return rows;
}

function evaluateRow(row) {
    const snapshot = row?.snapshot && typeof row.snapshot === 'object' ? row.snapshot : {};
    const activeModes = Array.isArray(snapshot.activeModes)
        ? Array.from(new Set(snapshot.activeModes.map((item) => String(item || '').trim()).filter(Boolean)))
        : [];
    const inferredConflict = snapshot.hasConflict === true
        || snapshot.mode === 'conflict'
        || activeModes.length > 1;
    const expectedMode = typeof row?.expectedMode === 'string' && row.expectedMode
        ? row.expectedMode
        : null;
    const modeMatches = expectedMode ? snapshot.mode === expectedMode : !inferredConflict;
    const runtime = snapshot?.runtime && typeof snapshot.runtime === 'object' ? snapshot.runtime : {};
    const expected = row?.expectedRuntime && typeof row.expectedRuntime === 'object'
        ? row.expectedRuntime
        : null;
    const runtimeMatches = expected
        ? Object.entries(expected).every(([key, value]) => runtime[key] === value)
        : true;
    const pass = !inferredConflict && modeMatches && runtimeMatches;

    return {
        ...row,
        activeModes,
        hasConflict: inferredConflict,
        modeMatches,
        runtimeMatches,
        pass
    };
}

function summarizeRows(rows) {
    const evaluatedRows = rows.map((row) => evaluateRow(row));
    const conflictRows = evaluatedRows.filter((row) => row.hasConflict);
    const failureRows = evaluatedRows.filter((row) => !row.pass);

    return {
        rows: evaluatedRows,
        conflicts: conflictRows,
        failures: failureRows,
        totals: {
            rows: evaluatedRows.length,
            conflicts: conflictRows.length,
            failures: failureRows.length
        }
    };
}

async function writeSummaryArtifact(outputDir, summary) {
    await mkdir(outputDir, { recursive: true });
    const summaryPath = path.join(outputDir, 'matrix-summary.json');
    await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
    return summaryPath;
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const sourceRows = await loadFixtureRows(options.fixture) || generateMatrixRows();
    const summaryCore = summarizeRows(sourceRows);
    const summary = {
        generatedAt: new Date().toISOString(),
        dimensions: {
            pointerTypes: POINTER_TYPES,
            layoutModes: LAYOUT_MODES,
            classroomLevels: CLASSROOM_LEVELS,
            embedReadonlyStates: EMBED_READONLY_STATES,
            modeIntents: MODE_INTENTS
        },
        source: options.fixture ? 'fixture' : 'generated',
        totals: summaryCore.totals,
        conflicts: summaryCore.conflicts,
        failures: summaryCore.failures,
        rows: summaryCore.rows
    };
    const summaryPath = await writeSummaryArtifact(options.outputDir, summary);

    console.log(`[mode-conflict-matrix] rows=${summary.totals.rows}`);
    console.log(`[mode-conflict-matrix] conflicts=${summary.totals.conflicts}`);
    console.log(`[mode-conflict-matrix] failures=${summary.totals.failures}`);
    console.log(`[mode-conflict-matrix] artifact=${summaryPath}`);

    if (summary.totals.conflicts > 0 || summary.totals.failures > 0) {
        console.error('[mode-conflict-matrix] detected mode conflicts');
        process.exitCode = 1;
    }
}

main().catch((error) => {
    console.error('[mode-conflict-matrix] FAILED');
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = 1;
});
