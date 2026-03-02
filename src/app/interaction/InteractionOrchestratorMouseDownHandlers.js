import {
    consumeActionResult,
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

export function handleWireTargetMouseDown(e, resolvedTargets = {}) {
    const target = resolvedTargets.target ?? e.target;
    if (!(hasClass(target, 'wire') || hasClass(target, 'wire-hit-area'))) {
        return false;
    }

    const wireGroup = safeClosest(target, '.wire-group');
    const wireId = wireGroup ? wireGroup.dataset.id : target.dataset.id;

    // 与 CircuitJS 一致：Ctrl/Cmd + 左键单击导线时执行分割。
    if (e.button === 0 && (e.ctrlKey || e.metaKey)) {
        if (wireId) {
            const canvasCoords = this.screenToCanvas(e.clientX, e.clientY);
            this.selectWire(wireId);
            this.splitWireAtPoint(wireId, canvasCoords.x, canvasCoords.y);
        }
        return true;
    }

    const pointerType = this.resolvePointerType(e);
    if ((pointerType === 'touch' || pointerType === 'pen') && wireId) {
        const wire = this.circuit?.getWire?.(wireId);
        if (wire?.a && wire?.b) {
            const canvasCoords = this.screenToCanvas(e.clientX, e.clientY);
            const threshold = typeof this.getAdaptiveSnapThreshold === 'function'
                ? this.getAdaptiveSnapThreshold({
                    pointerType,
                    snapIntent: 'wire-endpoint-drag',
                    threshold: 18
                })
                : 24;
            const distA = Math.hypot(canvasCoords.x - wire.a.x, canvasCoords.y - wire.a.y);
            const distB = Math.hypot(canvasCoords.x - wire.b.x, canvasCoords.y - wire.b.y);
            const nearA = distA <= threshold;
            const nearB = distB <= threshold;
            if (nearA || nearB) {
                this.startWireEndpointDrag(wireId, nearA && (!nearB || distA <= distB) ? 'a' : 'b', e);
                return true;
            }
        }
    }

    this.startWireDrag(wireId, e);
    return true;
}

export function handleSurfaceTargetMouseDown(e, resolvedTargets = {}) {
    const target = resolvedTargets.target ?? e.target;
    const probeMarker = resolvedTargets.probeMarker ?? null;
    const terminalTarget = resolvedTargets.terminalTarget !== undefined
        ? resolvedTargets.terminalTarget
        : (typeof this.resolveTerminalTarget === 'function' ? this.resolveTerminalTarget(target) : null);
    const componentGroup = resolvedTargets.componentGroup !== undefined
        ? resolvedTargets.componentGroup
        : safeClosest(target, '.component');

    if (probeMarker && e.button === 0) {
        const wireId = probeMarker.dataset.wireId;
        if (wireId) this.selectWire(wireId);
        return true;
    }

    // 端子交互：默认用于选中元器件；Ctrl/Cmd + 拖动用于延长/缩短引脚。
    // 连线动作通过显式导线工具触发，避免选择与起线语义冲突。
    if (terminalTarget) {
        if (componentGroup) {
            const componentId = componentGroup.dataset.id;
            const terminalIndex = parseInt(terminalTarget.dataset.terminal, 10);
            if (!Number.isNaN(terminalIndex) && terminalIndex >= 0) {
                if (this.selectedComponent !== componentId) {
                    this.selectComponent(componentId);
                }
                if (e.ctrlKey || e.metaKey) {
                    this.startTerminalExtend(componentId, terminalIndex, e);
                    return true;
                }
            }
            return true;
        }
    }

    // 检查是否点击了滑动变阻器的滑块
    if (hasClass(target, 'rheostat-slider')) {
        if (componentGroup) {
            this.startRheostatDrag(componentGroup.dataset.id, e);
            return true;
        }
    }

    // 检查是否点击了开关（切换开关状态）
    if (hasClass(target, 'switch-blade') || hasClass(target, 'switch-touch')) {
        if (componentGroup) {
            consumeActionResult(this, this.toggleSwitch(componentGroup.dataset.id));
            return true;
        }
    }

    // 平行板电容探索模式：拖动可动极板
    if (hasClass(target, 'plate-movable') && target.dataset.role === 'plate-movable') {
        if (componentGroup) {
            const compId = componentGroup.dataset.id;
            const comp = this.circuit.getComponent(compId);
            if (comp && comp.type === 'ParallelPlateCapacitor' && comp.explorationMode) {
                this.startParallelPlateCapacitorDrag(compId, e);
                return true;
            }
        }
    }

    // 检查是否点击了导线端点（拖动移动）
    if (typeof this.isWireEndpointTarget === 'function' && this.isWireEndpointTarget(target)) {
        const wireGroup = safeClosest(target, '.wire-group');
        if (wireGroup) {
            const wireId = wireGroup.dataset.id;
            const end = target.dataset.end;
            if (end === 'a' || end === 'b') {
                this.startWireEndpointDrag(wireId, end, e);
                return true;
            }
        }
    }

    // 检查是否点击了元器件
    if (componentGroup) {
        const componentId = componentGroup.dataset.id;
        const wasSelected = this.selectedComponent === componentId;
        this.pointerDownInfo = {
            componentId,
            wasSelected,
            screenX: e.clientX,
            screenY: e.clientY,
            pointerType: this.resolvePointerType(e),
            moved: false
        };
        this.startDragging(componentGroup, e);
        return true;
    }

    return false;
}

export function handleFallbackSurfaceMouseDown(e) {
    // Shift + 点击空白处：从任意点开始画导线（允许独立导线）
    if (e.shiftKey) {
        const canvasCoords = this.screenToCanvas(e.clientX, e.clientY);
        this.startWiringFromPoint(canvasCoords, e, false);
        return true;
    }

    // 左键点击空白处取消选择，并关闭可能打开的抽屉（移动端）
    this.clearSelection();
    this.app?.responsiveLayout?.closeDrawers?.();
    return true;
}
