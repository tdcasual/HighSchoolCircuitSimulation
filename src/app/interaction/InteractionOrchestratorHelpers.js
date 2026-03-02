import { ErrorCodes } from '../../core/errors/ErrorCodes.js';
import { AppError } from '../../core/errors/AppError.js';
import { createTraceId, logActionFailure } from '../../utils/Logger.js';
import { InteractionModes } from './InteractionModeStore.js';
import {
    readInteractionModeContext,
    setInteractionModeContext,
    setWireToolContext
} from './InteractionModeBridge.js';

function normalizeEndpointAutoBridgeMode(rawMode) {
    if (rawMode === 'on' || rawMode === 'off' || rawMode === 'auto') {
        return rawMode;
    }
    return 'auto';
}

function safeClassListContains(classList, className) {
    const contains = classList?.contains;
    if (typeof contains !== 'function') return false;
    try {
        return !!contains.call(classList, className);
    } catch (_) {
        return false;
    }
}

function isPhoneLikeLayout() {
    if (typeof document === 'undefined') return false;
    const bodyClassList = document.body?.classList;
    if (!bodyClassList) return false;
    return safeClassListContains(bodyClassList, 'layout-mode-phone')
        || safeClassListContains(bodyClassList, 'layout-mode-compact');
}

export function shouldCreateEndpointBridge(context, pointerType) {
    if (pointerType !== 'touch') return false;
    const mode = normalizeEndpointAutoBridgeMode(context?.endpointAutoBridgeMode);
    if (mode === 'on') return true;
    if (mode === 'off') return false;
    return isPhoneLikeLayout();
}

export function isTouchLikePointer(pointerType) {
    return pointerType === 'touch' || pointerType === 'pen';
}

export function safeClosest(target, selector) {
    if (!target || typeof target.closest !== 'function') return null;
    return target.closest(selector);
}

export function hasClass(target, className) {
    if (!target || !target.classList || typeof target.classList.contains !== 'function') {
        return false;
    }
    try {
        return target.classList.contains(className);
    } catch (_) {
        return false;
    }
}

export function resolveWireModeGestureThreshold(pointerType, kind = 'default') {
    const isPen = pointerType === 'pen';
    if (kind === 'terminal-extend') return isPen ? 14 : 18;
    if (kind === 'rheostat-slider-terminal') return isPen ? 10 : 12;
    if (kind === 'wire-endpoint') return isPen ? 10 : 12;
    return isPen ? 10 : 12;
}

export function restorePendingWireToolAfterAction(context) {
    const modeContext = readInteractionModeContext(context);
    if (modeContext?.stickyWireTool) {
        setWireToolContext(context, {
            pendingToolType: 'Wire',
            mobileInteractionMode: 'wire',
            stickyWireTool: true
        }, {
            mode: InteractionModes.WIRE,
            source: 'restorePendingWireTool:wire'
        });
        context.pendingToolItem = null;
        if (typeof context.syncMobileModeButtons === 'function') {
            context.syncMobileModeButtons();
        }
    } else {
        context.clearPendingToolType({ silent: true });
        setInteractionModeContext(context, {
            pendingToolType: null,
            mobileInteractionMode: 'select',
            stickyWireTool: false,
            isWiring: false
        }, {
            mode: InteractionModes.SELECT,
            source: 'restorePendingWireTool:select'
        });
    }
}

export function resolveLiveWireStart(context) {
    const wireStart = context?.wireStart;
    if (!wireStart) return null;

    const snap = wireStart.snap || null;
    if (snap?.type === 'terminal') {
        const componentId = snap.componentId;
        const terminalIndex = Number(snap.terminalIndex);
        if (componentId && Number.isInteger(terminalIndex) && terminalIndex >= 0) {
            const pos = context?.renderer?.getTerminalPosition?.(componentId, terminalIndex);
            if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
                return { x: pos.x, y: pos.y, snap };
            }
        }
    } else if (snap?.type === 'wire-endpoint') {
        const wireId = snap.wireId;
        const end = snap.end;
        const wire = wireId ? context?.circuit?.getWire?.(wireId) : null;
        const point = wire && (end === 'a' || end === 'b') ? wire[end] : null;
        if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
            return { x: point.x, y: point.y, snap };
        }
    }

    if (Number.isFinite(wireStart.x) && Number.isFinite(wireStart.y)) {
        return { x: wireStart.x, y: wireStart.y, snap };
    }
    return null;
}

export function syncActiveWireStartAfterCompaction(context, compacted = null) {
    if (!context?.isWiring || context?.wireStart?.snap?.type !== 'wire-endpoint') {
        return;
    }

    const replacementByRemovedId = compacted?.replacementByRemovedId || {};
    const currentWireId = context.wireStart.snap.wireId;
    const resolvedWireId = typeof context.resolveCompactedWireId === 'function'
        ? context.resolveCompactedWireId(currentWireId, replacementByRemovedId)
        : (replacementByRemovedId[currentWireId] || currentWireId);
    if (resolvedWireId && resolvedWireId !== currentWireId) {
        context.wireStart.snap = { ...context.wireStart.snap, wireId: resolvedWireId };
    }

    const liveStart = resolveLiveWireStart(context);
    if (liveStart) {
        context.wireStart.x = liveStart.x;
        context.wireStart.y = liveStart.y;
        context.wireStart.snap = liveStart.snap || context.wireStart.snap || null;
    }
}

export function consumeActionResult(context, result) {
    if (!result || result.ok !== false) {
        return result;
    }
    const actionType = typeof result.type === 'string' && result.type
        ? result.type
        : 'unknown.action';
    const traceId = result.traceId || createTraceId('interaction');
    const code = typeof result.code === 'string' && result.code
        ? result.code
        : (actionType === 'unknown.action' ? ErrorCodes.APP_ERR_INVALID_ACTION_RESULT : ErrorCodes.APP_ERR_ACTION_FAILED);
    const appError = result.error instanceof AppError
        ? result.error
        : new AppError(code, result.message || '交互动作执行失败', {
            traceId,
            cause: result.error || undefined,
            details: { actionType, payload: result.payload || null }
        });

    if (!appError.traceId) {
        appError.traceId = traceId;
    }
    result.traceId = traceId;
    result.error = appError;
    result.code = appError.code;
    context.lastActionError = appError;

    logActionFailure(context.logger, {
        traceId,
        actionType,
        message: appError.message,
        error: {
            code: appError.code,
            message: appError.message
        },
        payload: result.payload || null
    });

    if (result.message && !result.notified && typeof context.updateStatus === 'function') {
        context.updateStatus(result.message);
    }
    return result;
}
