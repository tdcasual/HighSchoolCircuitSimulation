import { GRID_SIZE, snapToGrid, toCanvasInt } from '../../utils/CanvasCoords.js';
import { ErrorCodes } from '../../core/errors/ErrorCodes.js';
import { AppError } from '../../core/errors/AppError.js';
import { createTraceId, logActionFailure } from '../../utils/Logger.js';

function consumeActionResult(context, result) {
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
            consumeActionResult(this, this.toggleSwitch(componentGroup.dataset.id));
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

export function onMouseMove(e) {
    // 画布平移（使用屏幕坐标）
    if (this.isPanning) {
        this.viewOffset = {
            x: e.clientX - this.panStart.x,
            y: e.clientY - this.panStart.y
        };
        this.updateViewTransform();
        return;
    }

    // 其他操作使用画布坐标
    const canvasCoords = this.screenToCanvas(e.clientX, e.clientY);
    const canvasX = canvasCoords.x;
    const canvasY = canvasCoords.y;

    // 拖动导线端点（Model C）
    if (this.isDraggingWireEndpoint && this.wireEndpointDrag) {
        const drag = this.wireEndpointDrag;
        const affected = Array.isArray(drag.affected) && drag.affected.length > 0
            ? drag.affected
            : [{ wireId: drag.wireId, end: drag.end }];

        const excludeWireEndpoints = new Set(affected.map((a) => `${a.wireId}:${a.end}`));
        const excludeWireIds = new Set(affected.map((a) => a.wireId));
        const snapped = this.snapPoint(canvasX, canvasY, {
            excludeWireEndpoints,
            allowWireSegmentSnap: false,
            excludeWireIds,
            pointerType: this.resolvePointerType(e)
        });
        drag.lastSnap = snapped.snap || null;
        drag.lastPoint = { x: snapped.x, y: snapped.y };

        const originX = Number(drag.origin?.x) || 0;
        const originY = Number(drag.origin?.y) || 0;
        const moved = Math.hypot(snapped.x - originX, snapped.y - originY) > 1e-6;
        if (moved && !drag.detached) {
            // Once movement starts, detach any terminal bindings so the junction can move freely.
            for (const a of affected) {
                const w = this.circuit.getWire(a.wireId);
                if (!w) continue;
                const refKey = a.end === 'a' ? 'aRef' : 'bRef';
                delete w[refKey];
            }
            drag.detached = true;
        }

        const terminalSnap = snapped.snap && snapped.snap.type === 'terminal'
            ? { componentId: snapped.snap.componentId, terminalIndex: snapped.snap.terminalIndex }
            : null;

        const changedWireIds = new Set();
        for (const a of affected) {
            const w = this.circuit.getWire(a.wireId);
            if (!w || (a.end !== 'a' && a.end !== 'b')) continue;
            w[a.end] = { x: snapped.x, y: snapped.y };

            const refKey = a.end === 'a' ? 'aRef' : 'bRef';
            if (terminalSnap) {
                w[refKey] = { componentId: terminalSnap.componentId, terminalIndex: terminalSnap.terminalIndex };
            } else if (drag.detached) {
                delete w[refKey];
            }

            changedWireIds.add(a.wireId);
        }

        if (terminalSnap) {
            this.renderer.highlightTerminal(terminalSnap.componentId, terminalSnap.terminalIndex);
        } else {
            this.renderer.clearTerminalHighlight();
        }
        for (const id of changedWireIds) {
            this.renderer.refreshWire(id);
        }
        return;
    }

    // 拖动整条导线（平移，保持线段形状）
    if (this.isDraggingWire && this.wireDrag) {
        const drag = this.wireDrag;
        const wire = this.circuit.getWire(drag.wireId);
        if (!wire || !wire.a || !wire.b) return;

        const dxScreen = e.clientX - (drag.startClient?.x || 0);
        const dyScreen = e.clientY - (drag.startClient?.y || 0);
        const movedScreen = Math.hypot(dxScreen, dyScreen);
        const moveThreshold = 3; // px

        const rawDx = canvasX - (drag.startCanvas?.x || 0);
        const rawDy = canvasY - (drag.startCanvas?.y || 0);
        const snappedDx = e.shiftKey ? snapToGrid(rawDx, GRID_SIZE) : toCanvasInt(rawDx);
        const snappedDy = e.shiftKey ? snapToGrid(rawDy, GRID_SIZE) : toCanvasInt(rawDy);

        // Avoid accidental micro-moves: only start applying translation after threshold.
        if (movedScreen < moveThreshold && snappedDx === 0 && snappedDy === 0) {
            return;
        }

        if (!drag.detached && (snappedDx !== 0 || snappedDy !== 0)) {
            // Dragging a wire segment translates both endpoints; detach any terminal bindings.
            delete wire.aRef;
            delete wire.bRef;
            drag.detached = true;
        }

        if (snappedDx === drag.lastDx && snappedDy === drag.lastDy) {
            return;
        }
        drag.lastDx = snappedDx;
        drag.lastDy = snappedDy;

        wire.a = { x: (drag.startA?.x || 0) + snappedDx, y: (drag.startA?.y || 0) + snappedDy };
        wire.b = { x: (drag.startB?.x || 0) + snappedDx, y: (drag.startB?.y || 0) + snappedDy };
        this.renderer.refreshWire(drag.wireId);
        return;
    }

    // 拖动元器件（平滑移动 + 对齐辅助）
    if (this.isDragging && this.dragTarget) {
        const comp = this.circuit.getComponent(this.dragTarget);
        if (comp) {
            // 计算新位置（不强制对齐网格，实现平滑移动）
            let newX = canvasX - this.dragOffset.x;
            let newY = canvasY - this.dragOffset.y;

            // 检测与其他元器件的对齐
            const alignment = this.detectAlignment(comp.id, newX, newY);

            // 应用吸附
            if (alignment.snapX !== null) {
                newX = alignment.snapX;
            }
            if (alignment.snapY !== null) {
                newY = alignment.snapY;
            }

            // Normalize to integer pixels to avoid hidden rounding in node connectivity.
            newX = toCanvasInt(newX);
            newY = toCanvasInt(newY);

            // 黑箱：整体移动（包含盒内元件与盒内导线端点）
            if (comp.type === 'BlackBox' && this.dragGroup && this.dragGroup.boxId === comp.id) {
                const dx = newX - (comp.x || 0);
                const dy = newY - (comp.y || 0);

                comp.x = newX;
                comp.y = newY;

                // 移动盒内元件
                for (const id of this.dragGroup.componentIds) {
                    const inner = this.circuit.getComponent(id);
                    if (!inner) continue;
                    inner.x = toCanvasInt((inner.x || 0) + dx);
                    inner.y = toCanvasInt((inner.y || 0) + dy);
                    this.renderer.updateComponentTransform(inner);
                }

                // 移动与黑箱组相关的导线端点（按拖动开始时的 inside mask）
                for (const wireId of this.dragGroup.connectedWireIds) {
                    const wire = this.circuit.getWire(wireId);
                    const mask = this.dragGroup.wireEndpointMask?.get(wireId);
                    if (!wire || !mask) continue;
                    if (mask.aInside && wire.a) {
                        wire.a = {
                            x: toCanvasInt((wire.a.x || 0) + dx),
                            y: toCanvasInt((wire.a.y || 0) + dy)
                        };
                    }
                    if (mask.bInside && wire.b) {
                        wire.b = {
                            x: toCanvasInt((wire.b.x || 0) + dx),
                            y: toCanvasInt((wire.b.y || 0) + dy)
                        };
                    }
                }

                // 更新黑箱自身 transform
                this.renderer.updateComponentTransform(comp);

                // 刷新与组相关的导线（含外部连接）
                for (const wireId of this.dragGroup.connectedWireIds) {
                    this.renderer.refreshWire(wireId);
                }
            } else {
                // 普通元器件：更新位置
                comp.x = newX;
                comp.y = newY;
                this.renderer.updateComponentPosition(comp);
            }

            // 显示对齐辅助线
            this.showAlignmentGuides(alignment);
        }
    }

    // 连线预览
    if (this.isWiring && this.wireStart && this.tempWire) {
        const preview = this.snapPoint(canvasX, canvasY, {
            allowWireSegmentSnap: false,
            pointerType: this.resolvePointerType(e)
        });
        this.renderer.updateTempWire(this.tempWire, this.wireStart.x, this.wireStart.y, preview.x, preview.y);
        if (preview.snap?.type === 'terminal') {
            this.renderer.highlightTerminal(preview.snap.componentId, preview.snap.terminalIndex);
        } else {
            this.renderer.clearTerminalHighlight();
        }
    }
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

export function onContextMenu(e) {
    e.preventDefault();
    const probeMarker = this.resolveProbeMarkerTarget(e.target);
    if (probeMarker) {
        const probeId = probeMarker.dataset.probeId;
        const wireId = probeMarker.dataset.wireId;
        if (wireId) this.selectWire(wireId);
        this.showProbeContextMenu(e, probeId, wireId);
        return;
    }

    const componentG = e.target.closest('.component');
    if (componentG) {
        const id = componentG.dataset.id;
        this.selectComponent(id);
        this.showContextMenu(e, id);
    } else {
        const wireGroup = e.target.closest('.wire-group');
        if (wireGroup) {
            const id = wireGroup.dataset.id;
            this.selectWire(id);
            this.showWireContextMenu(e, id);
        } else {
            this.hideContextMenu();
        }
    }
}

export function onDoubleClick(e) {
    const probeMarker = this.resolveProbeMarkerTarget(e.target);
    if (probeMarker) {
        const probeId = probeMarker.dataset.probeId;
        if (probeId) {
            this.renameObservationProbe(probeId);
        }
        return;
    }

    // 双击元器件打开属性编辑
    const componentG = e.target.closest('.component');
    if (componentG) {
        this.showPropertyDialog(componentG.dataset.id);
    }
}

export function onKeyDown(e) {
    // 检查对话框是否打开
    const dialogOverlay = typeof document !== 'undefined'
        ? document.getElementById('dialog-overlay')
        : null;
    const isDialogOpen = dialogOverlay && !dialogOverlay.classList.contains('hidden');

    // 如果对话框打开，只处理 Escape 键关闭对话框
    if (isDialogOpen) {
        if (e.key === 'Escape') {
            this.hideDialog();
        }
        return;
    }

    // 如果焦点在输入框、文本框等可编辑元素中，不处理快捷键
    const activeElement = typeof document !== 'undefined' ? document.activeElement : null;
    const isEditing = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.tagName === 'SELECT' ||
        activeElement.isContentEditable
    );

    if (isEditing) {
        return;
    }

    // Undo / Redo
    const modKey = e.metaKey || e.ctrlKey;
    if (modKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
            this.redo();
        } else {
            this.undo();
        }
        return;
    }
    if (modKey && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        this.redo();
        return;
    }

    // Delete键删除选中的元器件
    if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (this.selectedComponent) {
            consumeActionResult(this, this.deleteComponent(this.selectedComponent));
        } else if (this.selectedWire) {
            consumeActionResult(this, this.deleteWire(this.selectedWire));
        }
    }

    // R键旋转
    if (e.key === 'r' || e.key === 'R') {
        if (this.selectedComponent) {
            consumeActionResult(this, this.rotateComponent(this.selectedComponent));
        }
    }

    // Escape取消连线
    if (e.key === 'Escape') {
        this.cancelWiring();
        this.clearPendingToolType({ silent: true });
        this.clearSelection();
    }
}
