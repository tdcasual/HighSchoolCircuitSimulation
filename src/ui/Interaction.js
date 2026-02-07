/**
 * Interaction.js - 交互管理器
 * 处理拖放、连线、选择等用户交互
 */

import * as WireInteractions from './interaction/WireInteractions.js';
import * as DragBehaviors from './interaction/DragBehaviors.js';
import * as SelectionPanelController from './interaction/SelectionPanelController.js';
import * as PropertyPanelController from './interaction/PropertyPanelController.js';
import * as PointerSessionManager from './interaction/PointerSessionManager.js';
import * as ViewportController from './interaction/ViewportController.js';
import * as SnapController from './interaction/SnapController.js';
import * as InteractionOrchestrator from '../app/interaction/InteractionOrchestrator.js';
import * as ComponentActions from './interaction/ComponentActions.js';
import * as ToolPlacementController from './interaction/ToolPlacementController.js';
import * as PanelBindingsController from './interaction/PanelBindingsController.js';
import * as InputResolver from './interaction/InputResolver.js';
import * as UIStateController from './interaction/UIStateController.js';
import * as MeasurementReadoutController from './interaction/MeasurementReadoutController.js';
import * as ToolboxBindingsController from './interaction/ToolboxBindingsController.js';
import * as EventBindingsController from './interaction/EventBindingsController.js';
import * as CoordinateTransforms from './interaction/CoordinateTransforms.js';
import { initializeInteractionState } from './interaction/InteractionStateInitializer.js';
import { installInteractionTailDelegates } from './interaction/InteractionTailDelegates.js';

export class InteractionManager {
    constructor(app) {
        initializeInteractionState(this, app);
        this.hideContextMenuHandler = () => {
            this.hideContextMenu();
        };

        // 绑定事件
        this.bindEvents();
    }

    /**
     * 将屏幕坐标转换为画布坐标（考虑平移和缩放）
     */
    screenToCanvas(clientX, clientY) {
        return ViewportController.screenToCanvas.call(this, clientX, clientY);
    }

    /**
     * 将画布坐标转换为元器件局部坐标（考虑旋转）
     */
    canvasToComponentLocal(comp, canvasPoint) {
        return CoordinateTransforms.canvasToComponentLocal(comp, canvasPoint);
    }

    /**
     * 绑定所有事件
     */
    bindEvents() {
        return EventBindingsController.bindEvents.call(this);
    }

    /**
     * 缩放控制事件
     */
    bindZoomEvents() {
        return EventBindingsController.bindZoomEvents.call(this);
    }

    /**
     * 工具箱拖放事件
     */
    bindToolboxEvents() {
        return ToolboxBindingsController.bindToolboxEvents.call(this);
    }

    /**
     * 画布交互事件
     */
    bindCanvasEvents() {
        return EventBindingsController.bindCanvasEvents.call(this);
    }

    onPointerDown(e) {
        return PointerSessionManager.onPointerDown.call(this, e);
    }

    onPointerMove(e) {
        return PointerSessionManager.onPointerMove.call(this, e);
    }

    onPointerUp(e) {
        return PointerSessionManager.onPointerUp.call(this, e);
    }

    onPointerCancel(e) {
        return PointerSessionManager.onPointerCancel.call(this, e);
    }

    onPointerLeave(e) {
        return PointerSessionManager.onPointerLeave.call(this, e);
    }

    releasePointerCaptureSafe(pointerId) {
        return PointerSessionManager.releasePointerCaptureSafe.call(this, pointerId);
    }

    shouldStartPinchGesture() {
        return PointerSessionManager.shouldStartPinchGesture.call(this);
    }

    getGesturePointers() {
        return PointerSessionManager.getGesturePointers.call(this);
    }

    endPrimaryInteractionForGesture() {
        return PointerSessionManager.endPrimaryInteractionForGesture.call(this);
    }

    startPinchGesture() {
        return PointerSessionManager.startPinchGesture.call(this);
    }

    updatePinchGesture() {
        return PointerSessionManager.updatePinchGesture.call(this);
    }

    endPinchGestureIfNeeded() {
        return PointerSessionManager.endPinchGestureIfNeeded.call(this);
    }

    setPendingToolType(type, item = null) {
        return ToolPlacementController.setPendingToolType.call(this, type, item);
    }

    clearPendingToolType(options = {}) {
        return ToolPlacementController.clearPendingToolType.call(this, options);
    }

    placePendingToolAt(clientX, clientY) {
        return ToolPlacementController.placePendingToolAt.call(this, clientX, clientY);
    }
    
    /**
     * 滚轮缩放处理
     */
    onWheel(e) {
        return ViewportController.onWheel.call(this, e);
    }

    /**
     * 按钮事件
     */
    bindButtonEvents() {
        return PanelBindingsController.bindButtonEvents.call(this);
    }

    /**
     * 右侧面板 Tab 切换
     */
    bindSidePanelEvents() {
        return PanelBindingsController.bindSidePanelEvents.call(this);
    }

    isObservationTabActive() {
        return UIStateController.isObservationTabActive.call(this);
    }

    /**
     * 键盘事件
     */
    bindKeyboardEvents() {
        return EventBindingsController.bindKeyboardEvents.call(this);
    }

    resolveTerminalTarget(target) {
        return InputResolver.resolveTerminalTarget.call(this, target);
    }

    resolveProbeMarkerTarget(target) {
        return InputResolver.resolveProbeMarkerTarget.call(this, target);
    }

    resolvePointerType(event) {
        return InputResolver.resolvePointerType.call(this, event);
    }

    getAdaptiveSnapThreshold(options = {}) {
        return SnapController.getAdaptiveSnapThreshold.call(this, options);
    }

    isWireEndpointTarget(target) {
        return InputResolver.isWireEndpointTarget.call(this, target);
    }

    /**
     * 鼠标按下事件
     */
    onMouseDown(e) {
        return InteractionOrchestrator.onMouseDown.call(this, e);
    }

    /**
     * 开始画布平移
     */
    startPanning(e) {
        return ViewportController.startPanning.call(this, e);
    }
    
    /**
     * 更新画布视图变换
     */
    updateViewTransform() {
        return ViewportController.updateViewTransform.call(this);
    }
    
    /**
     * 重置视图
     */
    resetView() {
        return ViewportController.resetView.call(this);
    }

    /**
     * 计算当前电路在“画布坐标系”中的包围盒，用于居中/适配视图。
     * @returns {{minX:number,minY:number,maxX:number,maxY:number}|null}
     */
    getCircuitBounds() {
        return ViewportController.getCircuitBounds.call(this);
    }

    /**
     * 鼠标移动事件
     */
    onMouseMove(e) {
        return InteractionOrchestrator.onMouseMove.call(this, e);
    }

    /**
     * 鼠标释放事件
     */
    onMouseUp(e) {
        return InteractionOrchestrator.onMouseUp.call(this, e);
    }

    /**
     * 鼠标离开事件
     */
    onMouseLeave(e) {
        return InteractionOrchestrator.onMouseLeave.call(this, e);
    }

    /**
     * 右键菜单事件
     */
	    onContextMenu(e) {
	        return InteractionOrchestrator.onContextMenu.call(this, e);
	    }

    /**
     * 双击事件
     */
    onDoubleClick(e) {
        return InteractionOrchestrator.onDoubleClick.call(this, e);
    }

    /**
     * 添加元器件
     */
    addComponent(type, x, y) {
        return ComponentActions.addComponent.call(this, type, x, y);
    }

    /**
     * 删除元器件
     */
    deleteComponent(id) {
        return ComponentActions.deleteComponent.call(this, id);
    }

    /**
     * 删除导线
     */
    deleteWire(id) {
        return ComponentActions.deleteWire.call(this, id);
    }

    /**
     * 旋转元器件
     */
    rotateComponent(id) {
        return ComponentActions.rotateComponent.call(this, id);
    }

    /**
     * 切换开关状态
     */
    toggleSwitch(id) {
        return ComponentActions.toggleSwitch.call(this, id);
    }

    /**
     * 开始拖动
     */
    startDragging(componentG, e) {
        return DragBehaviors.startDragging.call(this, componentG, e);
    }

    /**
     * 从任意画布点开始连线（Model C）
     * @param {{x:number,y:number}} point
     * @param {MouseEvent|PointerEvent|null} e
     * @param {boolean} armMouseUpGuard
     */
    startWiringFromPoint(point, e = null, armMouseUpGuard = false) {
        return WireInteractions.startWiringFromPoint.call(this, point, e, armMouseUpGuard);
    }

    /**
     * 结束连线到某一点（Model C）
     * @param {{x:number,y:number}} point
     */
    finishWiringToPoint(point, options = {}) {
        return WireInteractions.finishWiringToPoint.call(this, point, options);
    }

    /**
     * 从工具箱创建一条独立导线（Model C）
     */
    addWireAt(x, y) {
        return WireInteractions.addWireAt.call(this, x, y);
    }

    /**
     * 拖动整条导线（Model C）
     */
    startWireDrag(wireId, e) {
        return WireInteractions.startWireDrag.call(this, wireId, e);
    }

    /**
     * 拖动导线端点（Model C）
     */
    startWireEndpointDrag(wireId, end, e) {
        return WireInteractions.startWireEndpointDrag.call(this, wireId, end, e);
    }

    resolveCompactedWireId(wireId, replacementByRemovedId = {}) {
        return WireInteractions.resolveCompactedWireId.call(this, wireId, replacementByRemovedId);
    }

    compactWiresAndRefresh(options = {}) {
        return WireInteractions.compactWiresAndRefresh.call(this, options);
    }

    /**
     * 吸附点：优先吸附到端子/导线端点，可选吸附到导线中段，否则吸附到网格
     */
    snapPoint(x, y, options = {}) {
        return SnapController.snapPoint.call(this, x, y, options);
    }

	    findNearbyWireEndpoint(x, y, threshold, excludeWireId = null, excludeEnd = null, excludeWireEndpoints = null) {
	        return WireInteractions.findNearbyWireEndpoint.call(
                this,
                x,
                y,
                threshold,
                excludeWireId,
                excludeEnd,
                excludeWireEndpoints
            );
	    }

    /**
     * 查找附近导线线段上的最近点（用于显式分割）
     */
    findNearbyWireSegment(x, y, threshold, excludeWireId = null) {
        return WireInteractions.findNearbyWireSegment.call(this, x, y, threshold, excludeWireId);
    }

    /**
     * 在指定位置分割导线为两段
     */
    splitWireAtPoint(wireId, x, y) {
        return WireInteractions.splitWireAtPoint.call(this, wireId, x, y);
    }

    /**
     * 分割导线内部实现（不记录历史）。
     */
    splitWireAtPointInternal(wireId, x, y, options = {}) {
        return WireInteractions.splitWireAtPointInternal.call(this, wireId, x, y, options);
    }

    /**
     * 取消连线
     */
    cancelWiring() {
        return WireInteractions.cancelWiring.call(this);
    }

    registerDragListeners(startEvent, onMove, onUp) {
        return DragBehaviors.registerDragListeners.call(this, startEvent, onMove, onUp);
    }

    /**
     * 端子延长拖动（平滑移动，支持对齐）
     */
    startTerminalExtend(componentId, terminalIndex, e) {
        return DragBehaviors.startTerminalExtend.call(this, componentId, terminalIndex, e);
    }

    /**
     * 滑动变阻器拖动
     */
    startRheostatDrag(componentId, e) {
        return DragBehaviors.startRheostatDrag.call(this, componentId, e);
    }

    /**
     * 平行板电容探索模式：拖动右侧极板
     * - 左右拖动：改变板间距 d
     * - 上下拖动：改变重叠面积（通过纵向错位近似）
     */
    startParallelPlateCapacitorDrag(componentId, e) {
        return DragBehaviors.startParallelPlateCapacitorDrag.call(this, componentId, e);
    }

    /**
     * 选择元器件
     */
    selectComponent(id) {
        return SelectionPanelController.selectComponent.call(this, id);
    }

    /**
     * 选择导线（10 秒后自动取消选择）
     */
    selectWire(id) {
        return SelectionPanelController.selectWire.call(this, id);
    }
    
    /**
     * 查找附近的端点
     * @param {number} x - x坐标
     * @param {number} y - y坐标  
     * @param {number} threshold - 距离阈值
     * @returns {Object|null} 端点信息 {componentId, terminalIndex} 或 null
     */
    findNearbyTerminal(x, y, threshold) {
        return SnapController.findNearbyTerminal.call(this, x, y, threshold);
    }

    /**
     * 清除选择
     */
    clearSelection() {
        return SelectionPanelController.clearSelection.call(this);
    }

    /**
     * 更新属性面板（使用安全的 DOM 操作防止 XSS）
     */
    updatePropertyPanel(comp) {
        return PropertyPanelController.updatePropertyPanel.call(this, comp);
    }

    createMeterSelfReadingControl(comp) {
        return MeasurementReadoutController.createMeterSelfReadingControl.call(this, comp);
    }

    /**
     * 仅更新属性面板里的“实时测量”等动态值，避免每帧重建 DOM 导致闪烁/输入框失焦
     */
    updateSelectedComponentReadouts(comp) {
        return MeasurementReadoutController.updateSelectedComponentReadouts.call(this, comp);
    }

    /**
     * 仅更新滑动变阻器属性面板的动态值（避免闪烁）
     */
    updateRheostatPanelValues(comp) {
        return MeasurementReadoutController.updateRheostatPanelValues.call(this, comp);
    }

    /**
     * 根据平行板电容的物理参数重算电容值，并可选更新图形/面板。
     * 注意：不修改 prevCharge（用于保持“断开后 Q 近似守恒”的演示效果）。
     */
    recomputeParallelPlateCapacitance(comp, options = {}) {
        return MeasurementReadoutController.recomputeParallelPlateCapacitance.call(this, comp, options);
    }

    /**
     * 仅更新平行板电容在属性面板中的动态字段
     */
    updateParallelPlateCapacitorPanelValues(comp) {
        return MeasurementReadoutController.updateParallelPlateCapacitorPanelValues.call(this, comp);
    }

}

installInteractionTailDelegates(InteractionManager);
