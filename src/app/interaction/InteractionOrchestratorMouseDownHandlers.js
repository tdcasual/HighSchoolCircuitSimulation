import {
    hasClass,
    isTouchLikePointer,
    resolveWireModeGestureThreshold,
    restorePendingWireToolAfterAction,
    safeClosest
} from './InteractionOrchestratorHelpers.js';

export function handlePendingToolMouseDown(e, resolvedTargets = {}) {
    if (!(this.pendingToolType && e.button === 0)) {
        return false;
    }

    const target = resolvedTargets.target ?? e.target;
    const terminalTarget = resolvedTargets.terminalTarget !== undefined
        ? resolvedTargets.terminalTarget
        : (typeof this.resolveTerminalTarget === 'function' ? this.resolveTerminalTarget(target) : null);
    const componentGroup = resolvedTargets.componentGroup !== undefined
        ? resolvedTargets.componentGroup
        : safeClosest(target, '.component');

    if (this.pendingToolType === 'Wire') {
        const pointerType = this.resolvePointerType(e);

        if (isTouchLikePointer(pointerType)) {
            if (hasClass(target, 'rheostat-slider') && componentGroup) {
                if (this.isWiring) {
                    this.ignoreNextWireMouseUp = true;
                }
                this.startRheostatDrag(componentGroup.dataset.id, e);
                return true;
            }

            if (terminalTarget && componentGroup) {
                const componentId = componentGroup.dataset.id;
                const terminalIndex = parseInt(terminalTarget.dataset.terminal, 10);
                if (!Number.isNaN(terminalIndex) && terminalIndex >= 0) {
                    const point = this.renderer.getTerminalPosition(componentId, terminalIndex)
                        || this.screenToCanvas(e.clientX, e.clientY);
                    const comp = this.circuit.getComponent(componentId);
                    const kind = comp?.type === 'Rheostat' && terminalIndex === 2
                        ? 'rheostat-slider-terminal'
                        : 'terminal-extend';
                    this.wireModeGesture = {
                        kind,
                        pointerType,
                        componentId,
                        terminalIndex,
                        point,
                        screenX: e.clientX,
                        screenY: e.clientY,
                        moveThresholdPx: resolveWireModeGestureThreshold(pointerType, kind),
                        wasWiring: !!this.isWiring
                    };
                    return true;
                }
            }

            if (typeof this.isWireEndpointTarget === 'function' && this.isWireEndpointTarget(target)) {
                const wireGroup = safeClosest(target, '.wire-group');
                if (wireGroup) {
                    const wireId = wireGroup.dataset.id;
                    const end = target.dataset.end;
                    const wire = this.circuit.getWire(wireId);
                    const point = wire && (end === 'a' || end === 'b') ? wire[end] : null;
                    if (point) {
                        this.wireModeGesture = {
                            kind: 'wire-endpoint',
                            pointerType,
                            wireId,
                            end,
                            point: { x: point.x, y: point.y },
                            screenX: e.clientX,
                            screenY: e.clientY,
                            moveThresholdPx: resolveWireModeGestureThreshold(pointerType, 'wire-endpoint'),
                            wasWiring: !!this.isWiring
                        };
                        return true;
                    }
                }
            }
        }

        const resolveWireToolPoint = () => {
            if (terminalTarget && componentGroup) {
                const componentId = componentGroup.dataset.id;
                const terminalIndex = parseInt(terminalTarget.dataset.terminal, 10);
                if (!Number.isNaN(terminalIndex) && terminalIndex >= 0) {
                    const terminalPos = this.renderer.getTerminalPosition(componentId, terminalIndex);
                    if (terminalPos) return terminalPos;
                }
            }

            if (typeof this.isWireEndpointTarget === 'function' && this.isWireEndpointTarget(target)) {
                const wireGroup = safeClosest(target, '.wire-group');
                if (wireGroup) {
                    const wireId = wireGroup.dataset.id;
                    const end = target.dataset.end;
                    const wire = this.circuit.getWire(wireId);
                    const pos = wire && (end === 'a' || end === 'b') ? wire[end] : null;
                    if (pos) return pos;
                }
            }

            return this.screenToCanvas(e.clientX, e.clientY);
        };

        const wireToolPoint = resolveWireToolPoint();
        if (this.isWiring) {
            let finishPoint = wireToolPoint;
            const terminalOrEndpointTarget = Boolean(
                terminalTarget
                || (typeof this.isWireEndpointTarget === 'function' && this.isWireEndpointTarget(target))
            );
            if (!terminalOrEndpointTarget && wireToolPoint) {
                const snapped = this.snapPoint(wireToolPoint.x, wireToolPoint.y, {
                    allowWireSegmentSnap: true,
                    pointerType
                });
                if (snapped?.snap?.type && snapped.snap.type !== 'grid') {
                    finishPoint = snapped;
                } else {
                    finishPoint = null;
                }
            }

            if (finishPoint) {
                this.finishWiringToPoint(finishPoint, { pointerType });
            } else {
                this.cancelWiring();
                if (typeof this.updateStatus === 'function') {
                    this.updateStatus('未连接到端子/端点，已取消连线');
                }
            }
            restorePendingWireToolAfterAction(this);
        } else {
            this.startWiringFromPoint(wireToolPoint, e, true);
            this.updateStatus('导线模式：选择终点');
        }
        return true;
    }

    this.placePendingToolAt(e.clientX, e.clientY);
    return true;
}
