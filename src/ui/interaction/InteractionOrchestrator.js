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
