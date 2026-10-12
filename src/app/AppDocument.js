import { AppError } from '../core/errors/AppError.js';
import { ErrorCodes } from '../core/errors/ErrorCodes.js';

export const APP_DOCUMENT_FORMAT = 'hscs-app';
export const APP_DOCUMENT_VERSION = 1;

const LEGACY_UI_META_KEYS = Object.freeze(['exerciseBoard', 'chartWorkspace']);
const SOLVER_BACKEND_MODES = Object.freeze(['v1', 'v2', 'shadow']);

function normalizeSolverBackendMode(raw) {
    if (raw == null || raw === '') return null;
    const text = String(raw).trim().toLowerCase();
    if (!SOLVER_BACKEND_MODES.includes(text)) return 'v1';
    return text;
}

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function safeInvokeMethod(target, methodName, ...args) {
    const fn = target?.[methodName];
    if (typeof fn !== 'function') return undefined;
    try {
        return fn.apply(target, args);
    } catch (_) {
        return undefined;
    }
}

function assertCircuitPayloadShape(circuit) {
    if (!isPlainObject(circuit) || !Array.isArray(circuit.components) || !Array.isArray(circuit.wires)) {
        throw new AppError(ErrorCodes.IO_ERR_INVALID_DOCUMENT, '无效的电路 JSON：缺少 components/wires');
    }
}

function unwrapNestedEnvelope(circuit, ui) {
    if (!isPlainObject(circuit) || circuit.format !== APP_DOCUMENT_FORMAT) {
        return { circuit, ui };
    }
    if (circuit.formatVersion !== APP_DOCUMENT_VERSION) {
        throw new AppError(
            ErrorCodes.IO_ERR_INVALID_DOCUMENT,
            `不支持的嵌套应用文档版本: ${circuit.formatVersion}`
        );
    }
    let nextUi = { ...ui };
    if (isPlainObject(circuit.ui)) {
        nextUi = { ...circuit.ui, ...ui };
    }
    return { circuit: circuit.circuit, ui: nextUi };
}

/**
 * Parse an application document or a bare circuit v3 payload.
 * Circuit.fromJSON must only receive the returned `circuit` object.
 */
export function parseAppDocument(raw) {
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new AppError(ErrorCodes.IO_ERR_INVALID_DOCUMENT, '无效的电路文档：根必须是对象');
    }

    if (raw.format === APP_DOCUMENT_FORMAT) {
        if (raw.formatVersion !== APP_DOCUMENT_VERSION) {
            throw new AppError(
                ErrorCodes.IO_ERR_INVALID_DOCUMENT,
                `不支持的应用文档版本: ${raw.formatVersion}`
            );
        }
        let circuit = raw.circuit;
        let ui = isPlainObject(raw.ui) ? { ...raw.ui } : {};
        const unwrapped = unwrapNestedEnvelope(circuit, ui);
        circuit = unwrapped.circuit;
        ui = unwrapped.ui;
        if (isPlainObject(circuit) && circuit.format === APP_DOCUMENT_FORMAT) {
            throw new AppError(ErrorCodes.IO_ERR_INVALID_DOCUMENT, '嵌套信封超过一层');
        }
        assertCircuitPayloadShape(circuit);
        return { circuit, ui, recoveredLegacyUi: false };
    }

    if (Object.prototype.hasOwnProperty.call(raw, 'format') && raw.format != null) {
        throw new AppError(ErrorCodes.IO_ERR_INVALID_DOCUMENT, `未知文档格式: ${raw.format}`);
    }

    assertCircuitPayloadShape(raw);

    const meta = isPlainObject(raw.meta) ? { ...raw.meta } : {};
    const ui = {};
    let recoveredLegacyUi = false;
    for (const key of LEGACY_UI_META_KEYS) {
        if (Object.prototype.hasOwnProperty.call(meta, key)) {
            ui[key] = meta[key];
            delete meta[key];
            recoveredLegacyUi = true;
        }
    }
    return { circuit: { ...raw, meta }, ui, recoveredLegacyUi };
}

export function buildAppDocument({
    circuit = null,
    exerciseBoard = null,
    chartWorkspace = null,
    solverBackend = null
} = {}) {
    const serialized = safeInvokeMethod(circuit, 'toJSON');
    const circuitPayload = isPlainObject(serialized)
        ? { ...serialized }
        : { components: [], wires: [] };
    if (isPlainObject(serialized?.meta)) {
        circuitPayload.meta = { ...serialized.meta };
    }

    const ui = {};
    const exerciseBoardData = safeInvokeMethod(exerciseBoard, 'toJSON');
    if (exerciseBoardData !== undefined) {
        ui.exerciseBoard = exerciseBoardData;
    }
    const chartWorkspaceData = safeInvokeMethod(chartWorkspace, 'toJSON');
    if (chartWorkspaceData !== undefined) {
        ui.chartWorkspace = chartWorkspaceData;
    }
    const solverMode = normalizeSolverBackendMode(solverBackend);
    if (solverMode) {
        ui.solverBackend = solverMode;
    }

    return {
        format: APP_DOCUMENT_FORMAT,
        formatVersion: APP_DOCUMENT_VERSION,
        circuit: circuitPayload,
        ui
    };
}

export function restoreAppUi({
    exerciseBoard = null,
    chartWorkspace = null,
    ui = null,
    solverBackend = null,
    applyMode = true
} = {}) {
    const blob = isPlainObject(ui) ? ui : {};
    safeInvokeMethod(exerciseBoard, 'fromJSON', blob.exerciseBoard);
    safeInvokeMethod(chartWorkspace, 'fromJSON', blob.chartWorkspace);
    if (!applyMode || !solverBackend) return;
    const mode = normalizeSolverBackendMode(blob.solverBackend);
    if (mode) {
        solverBackend.mode = mode;
    }
}

export function buildAppSaveData(options = {}) {
    return buildAppDocument(options);
}

export function restoreAppMetaFromSaveData({
    exerciseBoard = null,
    chartWorkspace = null,
    data = null
} = {}) {
    if (isPlainObject(data) && data.format === APP_DOCUMENT_FORMAT) {
        restoreAppUi({ exerciseBoard, chartWorkspace, ui: data.ui });
        return;
    }
    const meta = isPlainObject(data?.meta) ? data.meta : {};
    restoreAppUi({
        exerciseBoard,
        chartWorkspace,
        ui: {
            exerciseBoard: meta.exerciseBoard,
            chartWorkspace: meta.chartWorkspace
        }
    });
}
