export function resolveTerminalTarget(target) {
    if (!target || !target.classList) return null;
    if (target.classList.contains('terminal')) return target;
    if (target.classList.contains('terminal-hit-area')) return target;
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
    if (!target || !target.classList) return false;
    return target.classList.contains('wire-endpoint') || target.classList.contains('wire-endpoint-hit');
}
