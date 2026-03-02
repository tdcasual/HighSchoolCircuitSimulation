import { restorePendingWireToolAfterAction, safeClosest } from './InteractionOrchestratorHelpers.js';

export function handleWireModeGestureMouseUp(e, wireModeGesture) {
    if (!wireModeGesture) {
        return false;
    }

    const pointerType = wireModeGesture.pointerType || this.resolvePointerType(e);
    const gesturePoint = wireModeGesture.point || this.screenToCanvas(e.clientX, e.clientY);
    if (wireModeGesture.wasWiring) {
        if (gesturePoint) {
            this.finishWiringToPoint(gesturePoint, { pointerType });
        } else {
            this.cancelWiring();
            this.updateStatus?.('未连接到端子/端点，已取消连线');
        }
        restorePendingWireToolAfterAction(this);
    } else {
        this.startWiringFromPoint(gesturePoint, e, true);
        this.updateStatus('导线模式：选择终点');
    }
    this.pointerDownInfo = null;
    return true;
}

export function handlePanningMouseUp() {
    if (!this.isPanning) {
        return false;
    }

    this.isPanning = false;
    this.svg.style.cursor = '';
    this.pointerDownInfo = null;
    return true;
}

export function handleActiveWiringMouseUp(e) {
    if (!this.isWiring) {
        return false;
    }

    if (this.ignoreNextWireMouseUp) {
        this.ignoreNextWireMouseUp = false;
        return true;
    }
    const target = e.target;
    const pointerType = this.resolvePointerType(e);
    const terminalTarget = this.resolveTerminalTarget(target);
    if (terminalTarget) {
        const componentG = safeClosest(target, '.component');
        if (componentG) {
            const componentId = componentG.dataset.id;
            const terminalIndex = parseInt(terminalTarget.dataset.terminal);
            const pos = this.renderer.getTerminalPosition(componentId, terminalIndex);
            if (pos) {
                this.finishWiringToPoint(pos, { pointerType });
            } else {
                this.cancelWiring();
            }
        }
        return true;
    } else if (this.isWireEndpointTarget(target)) {
        const wireGroup = safeClosest(target, '.wire-group');
        if (wireGroup) {
            const wireId = wireGroup.dataset.id;
            const end = target.dataset.end;
            const wire = this.circuit.getWire(wireId);
            const pos = wire && (end === 'a' || end === 'b') ? wire[end] : null;
            if (pos) {
                this.finishWiringToPoint(pos, { pointerType });
                return true;
            }
        }
    }

    const canvasCoords = this.screenToCanvas(e.clientX, e.clientY);
    const snapped = this.snapPoint(canvasCoords.x, canvasCoords.y, {
        allowWireSegmentSnap: true,
        pointerType
    });
    if (snapped?.snap?.type && snapped.snap.type !== 'grid') {
        this.finishWiringToPoint(snapped, { pointerType });
        return true;
    }

    this.cancelWiring();
    if (typeof this.updateStatus === 'function') {
        this.updateStatus('未连接到端子/端点，已取消连线');
    }
    return true;
}
