export function onMouseDown(e) {
    // 阻止默认的拖拽行为，防止触发drop事件创建重复元器件
    e.preventDefault();
    e.stopPropagation();
    this.lastPrimaryPointerType = this.resolvePointerType(e);

    const target = e.target;
    const probeMarker = this.resolveProbeMarkerTarget(target);
    const terminalTarget = this.resolveTerminalTarget(target);
    const componentGroup = target.closest('.component');

    if (this.pendingToolType && e.button === 0) {
        if (this.pendingToolType === 'Wire') {
            const canvasCoords = this.screenToCanvas(e.clientX, e.clientY);
            if (this.isWiring) {
                this.finishWiringToPoint(canvasCoords);
                this.clearPendingToolType({ silent: true });
            } else {
                this.startWiringFromPoint(canvasCoords, e, true);
                this.updateStatus('导线模式：选择终点');
            }
        } else {
            this.placePendingToolAt(e.clientX, e.clientY);
        }
        return;
    }

    // 右键或中键 - 直接开始拖动画布
    if (e.button === 1 || e.button === 2) {
        this.startPanning(e);
        return;
    }

    // 如果正在连线模式，点击非端子/非节点的地方应该取消连线
    // 点击端子或节点会在 onMouseUp 中处理
    if (this.isWiring) {
        // 连线模式下的 mousedown 不做特殊处理，让 mouseup 来处理
        return;
    }

    if (probeMarker && e.button === 0) {
        const wireId = probeMarker.dataset.wireId;
        if (wireId) this.selectWire(wireId);
        return;
    }

    // 端子交互：默认拖动端子即延长/缩短引脚
    if (terminalTarget) {
        if (componentGroup) {
            const componentId = componentGroup.dataset.id;
            const terminalIndex = parseInt(terminalTarget.dataset.terminal, 10);
            if (!isNaN(terminalIndex) && terminalIndex >= 0) {
                if (this.selectedComponent !== componentId) {
                    this.selectComponent(componentId);
                }
                this.startTerminalExtend(componentId, terminalIndex, e);
            }
            return;
        }
    }

    // 检查是否点击了滑动变阻器的滑块
    if (target.classList.contains('rheostat-slider')) {
        if (componentGroup) {
            this.startRheostatDrag(componentGroup.dataset.id, e);
            return;
        }
    }

    // 检查是否点击了开关（切换开关状态）
    if (target.classList.contains('switch-blade') || target.classList.contains('switch-touch')) {
        if (componentGroup) {
            this.toggleSwitch(componentGroup.dataset.id);
            return;
        }
    }

    // 平行板电容探索模式：拖动可动极板
    if (target.classList.contains('plate-movable') && target.dataset.role === 'plate-movable') {
        if (componentGroup) {
            const compId = componentGroup.dataset.id;
            const comp = this.circuit.getComponent(compId);
            if (comp && comp.type === 'ParallelPlateCapacitor' && comp.explorationMode) {
                this.startParallelPlateCapacitorDrag(compId, e);
                return;
            }
        }
    }

    // 检查是否点击了导线端点（拖动移动）
    if (this.isWireEndpointTarget(target)) {
        const wireGroup = target.closest('.wire-group');
        if (wireGroup) {
            const wireId = wireGroup.dataset.id;
            const end = target.dataset.end;
            if (end === 'a' || end === 'b') {
                this.startWireEndpointDrag(wireId, end, e);
                return;
            }
        }
    }

    // 检查是否点击了元器件
    if (componentGroup) {
        this.startDragging(componentGroup, e);
        return;
    }

    // 检查是否点击了导线或导线组（可拖动移动）
    if (target.classList.contains('wire') || target.classList.contains('wire-hit-area')) {
        const wireGroup = target.closest('.wire-group');
        const wireId = wireGroup ? wireGroup.dataset.id : target.dataset.id;

        // 与 CircuitJS 一致：Ctrl/Cmd + 左键单击导线时执行分割。
        if (e.button === 0 && (e.ctrlKey || e.metaKey)) {
            if (wireId) {
                const canvasCoords = this.screenToCanvas(e.clientX, e.clientY);
                this.selectWire(wireId);
                this.splitWireAtPoint(wireId, canvasCoords.x, canvasCoords.y);
            }
            return;
        }

        this.startWireDrag(wireId, e);
        return;
    }

    // Shift + 点击空白处：从任意点开始画导线（允许独立导线）
    if (e.shiftKey) {
        const canvasCoords = this.screenToCanvas(e.clientX, e.clientY);
        this.startWiringFromPoint(canvasCoords, e, false);
        return;
    }

    // 左键点击空白处取消选择
    this.clearSelection();
}

export function onMouseUp(e) {
    // 结束画布平移
    if (this.isPanning) {
        this.isPanning = false;
        this.svg.style.cursor = '';
        return;
    }

    // 结束导线端点拖动
    if (this.isDraggingWireEndpoint) {
        const drag = this.wireEndpointDrag;
        this.isDraggingWireEndpoint = false;
        this.wireEndpointDrag = null;
        this.renderer.clearTerminalHighlight();

        const affectedIds = Array.isArray(drag?.affected)
            ? drag.affected.map((item) => item?.wireId).filter(Boolean)
            : [];
        this.compactWiresAndRefresh({
            preferredWireId: drag?.wireId || this.selectedWire,
            scopeWireIds: affectedIds
        });
        this.circuit.rebuildNodes();
        this.commitHistoryTransaction();
        return;
    }

    // 结束导线整体拖动
    if (this.isDraggingWire) {
        const drag = this.wireDrag;
        this.isDraggingWire = false;
        this.wireDrag = null;
        this.compactWiresAndRefresh({
            preferredWireId: drag?.wireId || this.selectedWire,
            scopeWireIds: drag?.wireId ? [drag.wireId] : null
        });
        this.circuit.rebuildNodes();
        this.commitHistoryTransaction();
        return;
    }

    // 结束拖动
    if (this.isDragging) {
        this.isDragging = false;
        this.dragTarget = null;
        this.isDraggingComponent = false;
        this.dragGroup = null;
        this.hideAlignmentGuides();
        this.circuit.rebuildNodes();
        this.commitHistoryTransaction();
    }

    // 结束连线
    if (this.isWiring) {
        if (this.ignoreNextWireMouseUp) {
            this.ignoreNextWireMouseUp = false;
            return;
        }
        const target = e.target;
        const terminalTarget = this.resolveTerminalTarget(target);
        if (terminalTarget) {
            const componentG = target.closest('.component');
            if (componentG) {
                const componentId = componentG.dataset.id;
                const terminalIndex = parseInt(terminalTarget.dataset.terminal);
                const pos = this.renderer.getTerminalPosition(componentId, terminalIndex);
                if (pos) {
                    this.finishWiringToPoint(pos, { pointerType: this.resolvePointerType(e) });
                } else {
                    this.cancelWiring();
                }
            }
            return;
        } else if (this.isWireEndpointTarget(target)) {
            const wireGroup = target.closest('.wire-group');
            if (wireGroup) {
                const wireId = wireGroup.dataset.id;
                const end = target.dataset.end;
                const wire = this.circuit.getWire(wireId);
                const pos = wire && (end === 'a' || end === 'b') ? wire[end] : null;
                if (pos) {
                    this.finishWiringToPoint(pos, { pointerType: this.resolvePointerType(e) });
                    return;
                }
            }
        } else {
            const canvasCoords = this.screenToCanvas(e.clientX, e.clientY);
            const snapped = this.snapPoint(canvasCoords.x, canvasCoords.y, {
                allowWireSegmentSnap: false,
                pointerType: this.resolvePointerType(e)
            });
            this.finishWiringToPoint(snapped, { pointerType: this.resolvePointerType(e) });
            return;
        }
    }
}

export function onMouseLeave(e) {
    if (this.isPanning) {
        this.isPanning = false;
        this.svg.style.cursor = '';
    }
    if (this.isDraggingWireEndpoint) {
        const drag = this.wireEndpointDrag;
        this.isDraggingWireEndpoint = false;
        this.wireEndpointDrag = null;
        this.renderer.clearTerminalHighlight();
        const affectedIds = Array.isArray(drag?.affected)
            ? drag.affected.map((item) => item?.wireId).filter(Boolean)
            : [];
        this.compactWiresAndRefresh({
            preferredWireId: drag?.wireId || this.selectedWire,
            scopeWireIds: affectedIds
        });
        this.circuit.rebuildNodes();
        this.commitHistoryTransaction();
    }
    if (this.isDraggingWire) {
        const drag = this.wireDrag;
        this.isDraggingWire = false;
        this.wireDrag = null;
        this.compactWiresAndRefresh({
            preferredWireId: drag?.wireId || this.selectedWire,
            scopeWireIds: drag?.wireId ? [drag.wireId] : null
        });
        this.circuit.rebuildNodes();
        this.commitHistoryTransaction();
    }
    if (this.isDragging) {
        this.isDragging = false;
        this.dragTarget = null;
        this.dragGroup = null;
        this.isDraggingComponent = false;
        this.hideAlignmentGuides();
        this.circuit.rebuildNodes();
        this.commitHistoryTransaction();
    }
}
