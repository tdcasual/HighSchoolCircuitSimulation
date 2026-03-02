function safeClassContains(target, className) {
    const contains = target?.classList?.contains;
    if (typeof contains !== 'function') return false;
    try {
        return !!contains.call(target.classList, className);
    } catch (_) {
        return false;
    }
}

export function resolveTerminalTarget(target) {
    if (safeClassContains(target, 'terminal')) return target;
    if (safeClassContains(target, 'terminal-hit-area')) return target;
    return null;
}

export function resolveProbeMarkerTarget(target) {
    if (!target || typeof target.closest !== 'function') return null;
    return target.closest('.wire-probe-marker');
}

export function resolvePointerType(event) {
    const pointerType = event?.pointerType;
    if (pointerType === 'mouse' || pointerType === 'touch' || pointerType === 'pen') {
        return pointerType;
    }
    return this.lastPrimaryPointerType || 'mouse';
}

export function isWireEndpointTarget(target) {
    return safeClassContains(target, 'wire-endpoint') || safeClassContains(target, 'wire-endpoint-hit');
}
