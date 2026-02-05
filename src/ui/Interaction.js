/**
 * Interaction.js - 交互管理器
 * 处理拖放、连线、选择等用户交互
 */

import { createComponent, ComponentNames, ComponentDefaults, SVGRenderer } from '../components/Component.js';
import { 
    createElement, 
    createPropertyRow, 
    createHintParagraph,
    createFormGroup,
    createSliderFormGroup,
    createSwitchToggleGroup,
    clearElement
} from '../utils/SafeDOM.js';
import { computeOverlapFractionFromOffsetPx, computeParallelPlateCapacitance } from '../utils/Physics.js';

export class InteractionManager {
    constructor(app) {
        this.app = app;
        this.circuit = app.circuit;
        this.renderer = app.renderer;
        this.svg = app.svg;
        
        // 交互状态
        this.isDragging = false;
        this.isWiring = false;
        this.isDraggingComponent = false; // 标记是否正在拖动元器件（而不是从工具箱拖放）
        this.dragTarget = null;
        this.dragGroup = null; // 黑箱拖动时的组移动信息
        this.dragOffset = { x: 0, y: 0 };
        this.selectedComponent = null;
        this.selectedWire = null;

        // 平行板电容探索模式：拖动极板（使用局部 document 监听实现）
        
        // 连线状态
        this.wireStart = null;
        this.tempWire = null;
        this.isDraggingWireEndpoint = false;
        this.wireEndpointDrag = null; // {wireId,end}
        this.isDraggingWire = false;
        this.wireDrag = null; // {wireId,startCanvas,startClient,startA,startB,detached,lastDx,lastDy}
        
        // 画布平移状态
        this.isPanning = false;
        this.panStart = { x: 0, y: 0 };
        this.viewOffset = { x: 0, y: 0 };
        this.scale = 1;
        
        // 对齐辅助线
        this.alignmentGuides = null;
        this.snapThreshold = 10; // 吸附阈值（像素）
        
        // 绑定事件
        this.bindEvents();
    }

    /**
     * 将屏幕坐标转换为画布坐标（考虑平移和缩放）
     */
    screenToCanvas(clientX, clientY) {
        const rect = this.svg.getBoundingClientRect();
        const screenX = clientX - rect.left;
        const screenY = clientY - rect.top;
        
        // 应用逆变换：先减去平移，再除以缩放
        const canvasX = (screenX - this.viewOffset.x) / this.scale;
        const canvasY = (screenY - this.viewOffset.y) / this.scale;
        
        return { x: canvasX, y: canvasY };
    }

    /**
     * 将画布坐标转换为元器件局部坐标（考虑旋转）
     */
    canvasToComponentLocal(comp, canvasPoint) {
        const dx = canvasPoint.x - (comp.x || 0);
        const dy = canvasPoint.y - (comp.y || 0);
        const rotation = (comp.rotation || 0) * Math.PI / 180;
        const cos = Math.cos(-rotation);
        const sin = Math.sin(-rotation);
        return {
            x: dx * cos - dy * sin,
            y: dx * sin + dy * cos
        };
    }

    /**
     * 绑定所有事件
     */
    bindEvents() {
        // 工具箱拖放
        this.bindToolboxEvents();
        
        // SVG画布事件
        this.bindCanvasEvents();
        
        // 按钮事件
        this.bindButtonEvents();

        // 右侧面板 Tab 切换
        this.bindSidePanelEvents();
        
        // 键盘事件
        this.bindKeyboardEvents();
        
        // 缩放显示点击重置
        this.bindZoomEvents();
    }

    /**
     * 缩放控制事件
     */
    bindZoomEvents() {
        const zoomLevel = document.getElementById('zoom-level');
        if (zoomLevel) {
            zoomLevel.addEventListener('click', () => {
                this.resetView();
            });
            zoomLevel.title = '点击重置视图 (快捷键: H)';
        }
    }

    /**
     * 工具箱拖放事件
     */
    bindToolboxEvents() {
        const toolItems = document.querySelectorAll('.tool-item');
        const validTypes = ['PowerSource', 'Resistor', 'Rheostat', 'Bulb', 'Capacitor', 'ParallelPlateCapacitor', 'Motor', 'Switch', 'Ammeter', 'Voltmeter', 'BlackBox', 'Wire'];
        
        // 标记是否正在从工具箱拖放
        this.isToolboxDrag = false;
        
        toolItems.forEach(item => {
            // 开始拖动
            item.addEventListener('dragstart', (e) => {
                const type = item.dataset.type;
                if (!type || !validTypes.includes(type)) {
                    console.error('Invalid component type:', type);
                    e.preventDefault();
                    return;
                }
                // 使用特定的 MIME 类型避免与其他拖放混淆
                e.dataTransfer.setData('application/x-circuit-component', type);
                e.dataTransfer.effectAllowed = 'copy';
                item.classList.add('dragging');
                this.isToolboxDrag = true;
                console.log('Toolbox drag started:', type);
            });
            
            // 结束拖动
            item.addEventListener('dragend', (e) => {
                item.classList.remove('dragging');
                this.isToolboxDrag = false;
            });
        });
        
        // 只绑定到 SVG 画布，不绑定到 container（避免双重触发）
        const handleDragOver = (e) => {
            // 只接受工具箱的拖放
            if (e.dataTransfer.types.includes('application/x-circuit-component')) {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'copy';
            }
        };
        
        const handleDrop = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // 如果正在拖动画布上的元器件，不创建新元器件
            if (this.isDraggingComponent) {
                console.log('Ignoring drop: dragging existing component');
                return;
            }
            
            // 只接受工具箱的拖放
            const type = e.dataTransfer.getData('application/x-circuit-component');
            console.log('Drop event, type:', type);
            
            // 验证类型
            if (!type || !validTypes.includes(type)) {
                console.log('Invalid component type, ignoring drop:', type);
                return;
            }
            
            // 计算相对于SVG的位置（考虑缩放和平移）
            const rect = this.svg.getBoundingClientRect();
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;
            // 转换为画布坐标
            const canvasX = (screenX - this.viewOffset.x) / this.scale;
            const canvasY = (screenY - this.viewOffset.y) / this.scale;
            const x = Math.round(canvasX / 20) * 20;
            const y = Math.round(canvasY / 20) * 20;
            
            if (type === 'Wire') {
                if (typeof this.addWireAt === 'function') {
                    this.addWireAt(x, y);
                } else {
                    // Fallback (should not happen): create a short wire segment at the drop point.
                    const wire = {
                        id: `wire_${Date.now()}`,
                        a: { x: x - 30, y },
                        b: { x: x + 30, y }
                    };
                    this.circuit.addWire(wire);
                    this.renderer.addWire(wire);
                    this.selectWire(wire.id);
                    this.updateStatus('已添加导线');
                }
            } else {
                this.addComponent(type, x, y);
            }
        };
        
        // 只绑定到 SVG 元素
        this.svg.addEventListener('dragover', handleDragOver);
        this.svg.addEventListener('drop', handleDrop);
    }

    /**
     * 画布交互事件
     */
    bindCanvasEvents() {
        // 鼠标按下
        this.svg.addEventListener('mousedown', (e) => this.onMouseDown(e));
        
        // 鼠标移动
        this.svg.addEventListener('mousemove', (e) => this.onMouseMove(e));
        
        // 鼠标释放
        this.svg.addEventListener('mouseup', (e) => this.onMouseUp(e));
        
        // 鼠标离开
        this.svg.addEventListener('mouseleave', (e) => this.onMouseLeave(e));
        
        // 右键菜单 - 禁用默认菜单
        this.svg.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.onContextMenu(e);
        });
        
        // 双击编辑
        this.svg.addEventListener('dblclick', (e) => this.onDoubleClick(e));
        
        // 滚轮缩放
        this.svg.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    }
    
    /**
     * 滚轮缩放处理
     */
    onWheel(e) {
        e.preventDefault();
        
        const rect = this.svg.getBoundingClientRect();
        // 鼠标在SVG中的位置
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // 统一 deltaY 的量级（trackpad/pinch 与滚轮差异很大）
        let deltaY = Number(e.deltaY) || 0;
        if (e.deltaMode === 1) deltaY *= 16;     // lines -> px
        if (e.deltaMode === 2) deltaY *= 800;    // pages -> px (rough)
        // pinch gesture in Chromium often sets ctrlKey=true; reduce sensitivity to avoid huge jumps
        if (e.ctrlKey) deltaY *= 0.25;

        const minScale = 0.1;
        const maxScale = 4;
        const zoomIntensity = 0.0015; // smaller = less sensitive

        // Exponential mapping feels smooth and consistent across devices.
        const zoomFactor = Math.exp(-deltaY * zoomIntensity);
        const newScale = Math.min(Math.max(this.scale * zoomFactor, minScale), maxScale);

        if (Math.abs(newScale - this.scale) < 1e-9) return;
        
        // 计算缩放前鼠标位置对应的画布坐标
        const canvasX = (mouseX - this.viewOffset.x) / this.scale;
        const canvasY = (mouseY - this.viewOffset.y) / this.scale;
        
        // 更新缩放
        this.scale = newScale;
        
        // 调整偏移，使鼠标位置保持不变
        this.viewOffset.x = mouseX - canvasX * this.scale;
        this.viewOffset.y = mouseY - canvasY * this.scale;
        
        this.updateViewTransform();
    }

    /**
     * 按钮事件
     */
    bindButtonEvents() {
        // 运行按钮
        document.getElementById('btn-run').addEventListener('click', () => {
            this.app.startSimulation();
        });
        
        // 停止按钮
        document.getElementById('btn-stop').addEventListener('click', () => {
            this.app.stopSimulation();
        });
        
        // 清空按钮
        document.getElementById('btn-clear').addEventListener('click', () => {
            if (confirm('确定要清空整个电路吗？')) {
                this.app.clearCircuit();
            }
        });
        
        // 导出按钮
        document.getElementById('btn-export').addEventListener('click', () => {
            this.app.exportCircuit();
        });
        
        // 导入按钮
        document.getElementById('btn-import').addEventListener('click', () => {
            document.getElementById('file-import').click();
        });
        
        // 文件选择
        document.getElementById('file-import').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.app.importCircuit(file);
            }
            e.target.value = '';
        });
        
        // 对话框按钮
        document.getElementById('dialog-cancel').addEventListener('click', () => {
            this.hideDialog();
        });
        
        document.getElementById('dialog-ok').addEventListener('click', () => {
            this.applyDialogChanges();
        });
        
        // 点击遮罩关闭对话框
        document.getElementById('dialog-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'dialog-overlay') {
                this.hideDialog();
            }
        });
    }

    /**
     * 右侧面板 Tab 切换
     */
    bindSidePanelEvents() {
        const tabButtons = Array.from(document.querySelectorAll('.panel-tab-btn'));
        const pages = Array.from(document.querySelectorAll('.panel-page'));
        if (tabButtons.length === 0 || pages.length === 0) return;

        const activate = (panelName) => {
            tabButtons.forEach((btn) => {
                const isActive = btn.dataset.panel === panelName;
                btn.classList.toggle('active', isActive);
                btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
            });

            pages.forEach((page) => {
                const isActive = page.dataset.panel === panelName;
                page.classList.toggle('active', isActive);
                if (page.id === 'panel-observation') {
                    page.setAttribute('aria-hidden', isActive ? 'false' : 'true');
                }
            });
        };

        tabButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const panelName = btn.dataset.panel;
                if (panelName) activate(panelName);
            });
        });

        // 暴露给其他逻辑使用（选择元件时自动跳回属性页）
        this.activateSidePanelTab = activate;
    }

    /**
     * 键盘事件
     */
    bindKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            // 检查对话框是否打开
            const dialogOverlay = document.getElementById('dialog-overlay');
            const isDialogOpen = dialogOverlay && !dialogOverlay.classList.contains('hidden');
            
            // 如果对话框打开，只处理 Escape 键关闭对话框
            if (isDialogOpen) {
                if (e.key === 'Escape') {
                    this.hideDialog();
                }
                return; // 对话框打开时不处理其他快捷键
            }
            
            // 如果焦点在输入框、文本框等可编辑元素中，不处理快捷键
            const activeElement = document.activeElement;
            const isEditing = activeElement && (
                activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'TEXTAREA' ||
                activeElement.tagName === 'SELECT' ||
                activeElement.isContentEditable
            );
            
            if (isEditing) {
                return; // 让输入框正常处理键盘事件
            }
            
            // Delete键删除选中的元器件
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault(); // 防止浏览器后退
                if (this.selectedComponent) {
                    this.deleteComponent(this.selectedComponent);
                } else if (this.selectedWire) {
                    this.deleteWire(this.selectedWire);
                }
            }
            
            // R键旋转
            if (e.key === 'r' || e.key === 'R') {
                if (this.selectedComponent) {
                    this.rotateComponent(this.selectedComponent);
                }
            }
            
            // Escape取消连线
            if (e.key === 'Escape') {
                this.cancelWiring();
                this.clearSelection();
            }
        });
    }

    /**
     * 鼠标按下事件
     */
    onMouseDown(e) {
        // 阻止默认的拖拽行为，防止触发drop事件创建重复元器件
        e.preventDefault();
        e.stopPropagation();

	        const target = e.target;

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

	        // 端子交互：
	        // - Alt + 拖动端子：延长/缩短引脚
	        // - 普通点击端子：仅选中元器件（避免误拖动元器件）
	        if (target.classList.contains('terminal')) {
	            const componentG = target.closest('.component');
	            if (componentG) {
	                const componentId = componentG.dataset.id;
	                const terminalIndex = parseInt(target.dataset.terminal, 10);
	                if (e.altKey) {
	                    if (!isNaN(terminalIndex) && terminalIndex >= 0) {
	                        this.startTerminalExtend(componentId, terminalIndex, e);
	                    }
	                } else {
	                    this.selectComponent(componentId);
	                }
	                return;
	            }
	        }
	        
	        // 检查是否点击了滑动变阻器的滑块
	        if (target.classList.contains('rheostat-slider')) {
	            const componentG = target.closest('.component');
            if (componentG) {
                this.startRheostatDrag(componentG.dataset.id, e);
                return;
            }
        }
        
        // 检查是否点击了开关（切换开关状态）
        if (target.classList.contains('switch-blade') || target.classList.contains('switch-touch')) {
            const componentG = target.closest('.component');
            if (componentG) {
                this.toggleSwitch(componentG.dataset.id);
                return;
            }
        }

        // 平行板电容探索模式：拖动可动极板
        if (target.classList.contains('plate-movable') && target.dataset.role === 'plate-movable') {
            const componentG = target.closest('.component');
            if (componentG) {
                const compId = componentG.dataset.id;
                const comp = this.circuit.getComponent(compId);
                if (comp && comp.type === 'ParallelPlateCapacitor' && comp.explorationMode) {
                    this.startParallelPlateCapacitorDrag(compId, e);
                    return;
                }
            }
        }
        
        // 检查是否点击了导线端点（拖动移动）
        if (target.classList.contains('wire-endpoint')) {
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
        const componentG = target.closest('.component');
        if (componentG) {
            this.startDragging(componentG, e);
            return;
        }
        
        // 检查是否点击了导线或导线组（可拖动移动）
        if (target.classList.contains('wire') || target.classList.contains('wire-hit-area')) {
            const wireGroup = target.closest('.wire-group');
            const wireId = wireGroup ? wireGroup.dataset.id : target.dataset.id;
            this.startWireDrag(wireId, e);
            return;
        }

        // Shift + 点击空白处：从任意点开始画导线（允许独立导线）
        if (e.shiftKey) {
            const canvasCoords = this.screenToCanvas(e.clientX, e.clientY);
            this.startWiringFromPoint(canvasCoords, e);
            return;
        }
        
        // 左键点击空白处取消选择
        this.clearSelection();
    }
    
    /**
     * 开始画布平移
     */
    startPanning(e) {
        this.isPanning = true;
        this.panStart = {
            x: e.clientX - this.viewOffset.x,
            y: e.clientY - this.viewOffset.y
        };
        this.svg.style.cursor = 'grabbing';
    }
    
    /**
     * 更新画布视图变换
     */
    updateViewTransform() {
        const contentGroup = this.svg.querySelector('#layer-grid').parentElement;
        // 应用变换到所有图层的父容器，或者直接应用到各图层
        const layers = ['#layer-grid', '#layer-wires', '#layer-components', '#layer-ui'];
        layers.forEach(selector => {
            const layer = this.svg.querySelector(selector);
            if (layer) {
                layer.setAttribute('transform', 
                    `translate(${this.viewOffset.x}, ${this.viewOffset.y}) scale(${this.scale})`
                );
            }
        });
        
        // 更新对齐辅助线组的变换
        const guidesGroup = this.svg.querySelector('#alignment-guides');
        if (guidesGroup) {
            guidesGroup.setAttribute('transform', 
                `translate(${this.viewOffset.x}, ${this.viewOffset.y}) scale(${this.scale})`
            );
        }
        
        // 更新缩放百分比显示
        const zoomLevel = document.getElementById('zoom-level');
        if (zoomLevel) {
            zoomLevel.textContent = `${Math.round(this.scale * 100)}%`;
        }
    }
    
    /**
     * 重置视图
     */
    resetView() {
        this.scale = 1;
        // Center the current circuit content in the viewport for a nicer reset.
        const bounds = this.getCircuitBounds();
        if (bounds) {
            const centerX = (bounds.minX + bounds.maxX) / 2;
            const centerY = (bounds.minY + bounds.maxY) / 2;
            const rect = this.svg.getBoundingClientRect();
            const screenCenterX = rect.width / 2;
            const screenCenterY = rect.height / 2;
            this.viewOffset = {
                x: screenCenterX - centerX * this.scale,
                y: screenCenterY - centerY * this.scale
            };
        } else {
            this.viewOffset = { x: 0, y: 0 };
        }
        this.updateViewTransform();
        this.updateStatus('视图已重置');
    }

    /**
     * 计算当前电路在“画布坐标系”中的包围盒，用于居中/适配视图。
     * @returns {{minX:number,minY:number,maxX:number,maxY:number}|null}
     */
    getCircuitBounds() {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        const expand = (x, y) => {
            if (!Number.isFinite(x) || !Number.isFinite(y)) return;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        };

        for (const comp of this.circuit.getAllComponents()) {
            if (!comp) continue;
            expand(comp.x || 0, comp.y || 0);
        }

        for (const wire of this.circuit.getAllWires()) {
            if (!wire) continue;
            if (wire.a) expand(wire.a.x, wire.a.y);
            if (wire.b) expand(wire.b.x, wire.b.y);
        }

        if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
            return null;
        }

        // Add a bit of padding so we don't center too tightly.
        const pad = 80;
        return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
    }

    /**
     * 鼠标移动事件
     */
    onMouseMove(e) {
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
	            const snapped = this.snapPoint(canvasX, canvasY, { excludeWireEndpoints });

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
            const snappedDx = Math.round(rawDx / 20) * 20;
            const snappedDy = Math.round(rawDy / 20) * 20;

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

                // 黑箱：整体移动（包含盒内元件与内部导线控制点）
                if (comp.type === 'BlackBox' && this.dragGroup && this.dragGroup.boxId === comp.id) {
                    const dx = newX - (comp.x || 0);
                    const dy = newY - (comp.y || 0);

                    comp.x = newX;
                    comp.y = newY;

                    // 移动盒内元件
                    for (const id of this.dragGroup.componentIds) {
                        const inner = this.circuit.getComponent(id);
                        if (!inner) continue;
                        inner.x = (inner.x || 0) + dx;
                        inner.y = (inner.y || 0) + dy;
                        this.renderer.updateComponentTransform(inner);
                    }

                    // 移动与黑箱组相关的导线端点（按拖动开始时的 inside mask）
                    for (const wireId of this.dragGroup.connectedWireIds) {
                        const wire = this.circuit.getWire(wireId);
                        const mask = this.dragGroup.wireEndpointMask?.get(wireId);
                        if (!wire || !mask) continue;
                        if (mask.aInside && wire.a) {
                            wire.a = { x: (wire.a.x || 0) + dx, y: (wire.a.y || 0) + dy };
                        }
                        if (mask.bInside && wire.b) {
                            wire.b = { x: (wire.b.x || 0) + dx, y: (wire.b.y || 0) + dy };
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
            this.renderer.updateTempWire(this.tempWire, this.wireStart.x, this.wireStart.y, canvasX, canvasY);
        }
    }

    /**
     * 鼠标释放事件
     */
    onMouseUp(e) {
        // 结束画布平移
        if (this.isPanning) {
            this.isPanning = false;
            this.svg.style.cursor = '';
            return;
        }

        // 结束导线端点拖动
        if (this.isDraggingWireEndpoint) {
            this.isDraggingWireEndpoint = false;
            this.wireEndpointDrag = null;
            this.circuit.rebuildNodes();
            return;
        }

        // 结束导线整体拖动
        if (this.isDraggingWire) {
            this.isDraggingWire = false;
            this.wireDrag = null;
            this.circuit.rebuildNodes();
            return;
        }
        
        // 结束拖动
        if (this.isDragging) {
            this.isDragging = false;
            this.dragTarget = null;
            this.isDraggingComponent = false; // 清除拖动标志
            this.dragGroup = null;
            this.hideAlignmentGuides(); // 隐藏对齐辅助线
            this.circuit.rebuildNodes();
        }
        
        // 结束连线
        if (this.isWiring) {
            const target = e.target;
            if (target.classList.contains('terminal')) {
                const componentG = target.closest('.component');
                if (componentG) {
                    const componentId = componentG.dataset.id;
                    const terminalIndex = parseInt(target.dataset.terminal);
                    const pos = this.renderer.getTerminalPosition(componentId, terminalIndex);
                    if (pos) {
                        this.finishWiringToPoint(pos);
                    } else {
                        this.cancelWiring();
                    }
                }
                return;
            } else if (target.classList.contains('wire-endpoint')) {
                const wireGroup = target.closest('.wire-group');
                if (wireGroup) {
                    const wireId = wireGroup.dataset.id;
                    const end = target.dataset.end;
                    const wire = this.circuit.getWire(wireId);
                    const pos = wire && (end === 'a' || end === 'b') ? wire[end] : null;
                    if (pos) {
                        this.finishWiringToPoint(pos);
                        return;
                    }
                }
            } else {
                const canvasCoords = this.screenToCanvas(e.clientX, e.clientY);
                const snapped = this.snapPoint(canvasCoords.x, canvasCoords.y);
                this.finishWiringToPoint(snapped);
                return;
            }
        }
    }

    /**
     * 鼠标离开事件
     */
    onMouseLeave(e) {
        if (this.isPanning) {
            this.isPanning = false;
            this.svg.style.cursor = '';
        }
        if (this.isDraggingWireEndpoint) {
            this.isDraggingWireEndpoint = false;
            this.wireEndpointDrag = null;
            this.circuit.rebuildNodes();
        }
        if (this.isDraggingWire) {
            this.isDraggingWire = false;
            this.wireDrag = null;
            this.circuit.rebuildNodes();
        }
        if (this.isDragging) {
            this.isDragging = false;
            this.dragTarget = null;
            this.dragGroup = null;
        }
    }

    /**
     * 右键菜单事件
     */
	    onContextMenu(e) {
	        e.preventDefault();
	        
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

    /**
     * 双击事件
     */
    onDoubleClick(e) {
        // 双击导线：在该位置分割成两段（形成显式端点/连接点）
        if (e.target.classList.contains('wire') || e.target.classList.contains('wire-hit-area')) {
            const wireGroup = e.target.closest('.wire-group');
            const wireId = wireGroup ? wireGroup.dataset.id : e.target.dataset.id;
            const canvasCoords = this.screenToCanvas(e.clientX, e.clientY);
            this.splitWireAtPoint(wireId, canvasCoords.x, canvasCoords.y);
            return;
        }
        
        // 双击元器件打开属性编辑
        const componentG = e.target.closest('.component');
        if (componentG) {
            this.showPropertyDialog(componentG.dataset.id);
        }
    }

    /**
     * 添加元器件
     */
    addComponent(type, x, y) {
        console.log('Adding component:', type, 'at', x, y);
        try {
            const comp = createComponent(type, x, y);
            console.log('Created component:', comp);
            this.circuit.addComponent(comp);
            const svgElement = this.renderer.addComponent(comp);
            console.log('Rendered SVG element:', svgElement);
            this.selectComponent(comp.id);
            this.app.observationPanel?.refreshComponentOptions();
            this.app.observationPanel?.refreshDialGauges();
            this.updateStatus(`已添加 ${ComponentNames[type]}`);
        } catch (error) {
            console.error('Error adding component:', error);
            this.updateStatus(`添加失败: ${error.message}`);
        }
    }

    /**
     * 删除元器件
     */
    deleteComponent(id) {
        this.circuit.removeComponent(id);
        this.renderer.removeComponent(id);

        // Model C: wires are independent segments; deleting a component does not delete wires.
        this.renderer.renderWires();
        this.clearSelection();
        this.app.observationPanel?.refreshComponentOptions();
        this.app.observationPanel?.refreshDialGauges();
        this.updateStatus('已删除元器件');
    }

    /**
     * 删除导线
     */
    deleteWire(id) {
        this.circuit.removeWire(id);
        this.renderer.removeWire(id);
        this.clearSelection();
        this.updateStatus('已删除导线');
    }

    /**
     * 旋转元器件
     */
    rotateComponent(id) {
        const comp = this.circuit.getComponent(id);
        if (comp) {
            comp.rotation = ((comp.rotation || 0) + 90) % 360;
            this.renderer.refreshComponent(comp);
            this.renderer.updateConnectedWires(id);
            this.renderer.setSelected(id, true);
        }
    }

    /**
     * 切换开关状态
     */
    toggleSwitch(id) {
        const comp = this.circuit.getComponent(id);
        if (comp && comp.type === 'Switch') {
            comp.closed = !comp.closed;
            this.renderer.refreshComponent(comp);
            this.renderer.setSelected(id, true);
            this.selectComponent(id);
            this.updateStatus(`开关已${comp.closed ? '闭合' : '断开'}`);
        }
    }

    /**
     * 开始拖动
     */
    startDragging(componentG, e) {
        const id = componentG.dataset.id;
        const comp = this.circuit.getComponent(id);
        if (!comp) return;
        
        this.isDragging = true;
        this.dragTarget = id;
        this.isDraggingComponent = true; // 标记正在拖动元器件
        this.dragGroup = null;
        
        // 使用统一的坐标转换，计算鼠标相对于元器件中心的偏移
        const canvasCoords = this.screenToCanvas(e.clientX, e.clientY);
        this.dragOffset = {
            x: canvasCoords.x - comp.x,
            y: canvasCoords.y - comp.y
        };

        // 黑箱：准备整体移动信息（盒内元件 + 与盒相关的导线端点）
        if (comp.type === 'BlackBox') {
            const componentIds = this.getBlackBoxContainedComponentIds(comp, { includeBoxes: true });
            const connectedWireIds = new Set();
            const wireEndpointMask = new Map(); // wireId -> {aInside,bInside}
            const inside = (pt) => this.renderer.isPointInsideBlackBox(pt, comp);

            for (const wire of this.circuit.getAllWires()) {
                const aInside = !!(wire?.a && inside(wire.a));
                const bInside = !!(wire?.b && inside(wire.b));
                if (aInside || bInside) {
                    connectedWireIds.add(wire.id);
                    wireEndpointMask.set(wire.id, { aInside, bInside });
                }
            }

            this.dragGroup = {
                boxId: comp.id,
                componentIds,
                connectedWireIds: Array.from(connectedWireIds),
                wireEndpointMask
            };
        }
        
        this.selectComponent(id);
    }

    /**
     * 从任意画布点开始连线（Model C）
     * @param {{x:number,y:number}} point
     * @param {MouseEvent|null} e
     */
    startWiringFromPoint(point, e = null) {
        if (!point) return;

        // 确保清除任何残留的辅助线和高亮
        this.hideAlignmentGuides();
        this.renderer.clearTerminalHighlight();

        const start = this.snapPoint(point.x, point.y);

        this.isWiring = true;
        this.wireStart = { x: start.x, y: start.y, snap: start.snap || null };

        // 创建临时导线
        this.tempWire = this.renderer.createTempWire();

        const cursor = e ? this.screenToCanvas(e.clientX, e.clientY) : start;
        this.renderer.updateTempWire(this.tempWire, start.x, start.y, cursor.x, cursor.y);
    }

    /**
     * 结束连线到某一点（Model C）
     * @param {{x:number,y:number}} point
     */
    finishWiringToPoint(point) {
        if (!this.wireStart || !point) {
            this.cancelWiring();
            return;
        }

        const start = { x: this.wireStart.x, y: this.wireStart.y };
        const end = this.snapPoint(point.x, point.y);
        const dist = Math.hypot(end.x - start.x, end.y - start.y);
        if (dist < 1e-6) {
            this.cancelWiring();
            return;
        }

        const ensureUniqueWireId = (baseId) => {
            if (!this.circuit.getWire(baseId)) return baseId;
            let i = 1;
            while (this.circuit.getWire(`${baseId}_${i}`)) i++;
            return `${baseId}_${i}`;
        };

        // Auto-route: prefer orthogonal (Manhattan) wiring with a single corner.
        const points = [{ x: start.x, y: start.y }];
        if (start.x !== end.x && start.y !== end.y) {
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const horizontalFirst = Math.abs(dx) >= Math.abs(dy);
            const corner = horizontalFirst
                ? { x: end.x, y: start.y }
                : { x: start.x, y: end.y };
            points.push(corner);
        }
        points.push({ x: end.x, y: end.y });

        const baseId = `wire_${Date.now()}`;
        const createdIds = [];
        for (let i = 0; i < points.length - 1; i++) {
            const a = points[i];
            const b = points[i + 1];
            const segDist = Math.hypot(b.x - a.x, b.y - a.y);
            if (segDist < 1e-6) continue;

            const id = ensureUniqueWireId(i === 0 ? baseId : `${baseId}_${i}`);
            const wire = {
                id,
                a: { x: a.x, y: a.y },
                b: { x: b.x, y: b.y }
            };

            // Bind only the outer endpoints to terminals so wires follow component moves/terminal extension.
            if (i === 0 && this.wireStart.snap && this.wireStart.snap.type === 'terminal') {
                wire.aRef = {
                    componentId: this.wireStart.snap.componentId,
                    terminalIndex: this.wireStart.snap.terminalIndex
                };
            }
            if (i === points.length - 2 && end.snap && end.snap.type === 'terminal') {
                wire.bRef = {
                    componentId: end.snap.componentId,
                    terminalIndex: end.snap.terminalIndex
                };
            }

            this.circuit.addWire(wire);
            this.renderer.addWire(wire);
            createdIds.push(id);
        }

        this.cancelWiring();
        if (createdIds.length > 0) {
            this.selectWire(createdIds[createdIds.length - 1]);
        }
        this.updateStatus('已添加导线');
    }

    /**
     * 从工具箱创建一条独立导线（Model C）
     */
    addWireAt(x, y) {
        const start = { x: x - 30, y };
        const end = { x: x + 30, y };
        const wire = {
            id: `wire_${Date.now()}`,
            a: start,
            b: end
        };
        this.circuit.addWire(wire);
        this.renderer.addWire(wire);
        this.selectWire(wire.id);
        this.updateStatus('已添加导线');
    }

    /**
     * 拖动整条导线（Model C）
     */
    startWireDrag(wireId, e) {
        const wire = this.circuit.getWire(wireId);
        if (!wire || !wire.a || !wire.b) return;

        this.isDraggingWire = true;
        this.wireDrag = {
            wireId,
            startCanvas: this.screenToCanvas(e.clientX, e.clientY),
            startClient: { x: e.clientX, y: e.clientY },
            startA: { x: wire.a.x, y: wire.a.y },
            startB: { x: wire.b.x, y: wire.b.y },
            detached: false,
            lastDx: 0,
            lastDy: 0
        };

        this.selectWire(wireId);
        e.preventDefault();
        e.stopPropagation();
    }

    /**
     * 拖动导线端点（Model C）
     */
	    startWireEndpointDrag(wireId, end, e) {
	        const wire = this.circuit.getWire(wireId);
	        if (!wire || (end !== 'a' && end !== 'b')) return;

	        const origin = wire[end];
	        if (!origin) return;

	        // Default: drag the whole junction (all endpoints at the same coordinate).
	        // Hold Alt while dragging to detach and move only this single endpoint.
	        const keyOf = (pt) => `${Math.round(pt.x)},${Math.round(pt.y)}`;
	        const originKey = keyOf(origin);
	        const affected = [];
	        if (e && e.altKey) {
	            affected.push({ wireId, end });
	        } else {
	            for (const w of this.circuit.getAllWires()) {
	                if (!w) continue;
	                for (const which of ['a', 'b']) {
	                    const pt = w[which];
	                    if (!pt) continue;
	                    if (keyOf(pt) === originKey) {
	                        affected.push({ wireId: w.id, end: which });
	                    }
	                }
	            }
	            if (affected.length === 0) {
	                affected.push({ wireId, end });
	            }
	        }

	        this.isDraggingWireEndpoint = true;
	        this.wireEndpointDrag = {
	            wireId,
	            end,
	            origin: { x: origin.x, y: origin.y },
	            affected,
	            detached: false
	        };
	        this.selectWire(wireId);
	        e.preventDefault();
	        e.stopPropagation();
	    }

    /**
     * 吸附点：优先吸附到端子/导线端点，否则吸附到网格
     */
	    snapPoint(x, y, options = {}) {
	        const threshold = 15;

        const nearbyTerminal = this.findNearbyTerminal(x, y, threshold);
        if (nearbyTerminal) {
            const pos = this.renderer.getTerminalPosition(nearbyTerminal.componentId, nearbyTerminal.terminalIndex);
            if (pos) {
                return {
                    x: pos.x,
                    y: pos.y,
                    snap: {
                        type: 'terminal',
                        componentId: nearbyTerminal.componentId,
                        terminalIndex: nearbyTerminal.terminalIndex
                    }
                };
            }
        }

	        const nearbyEndpoint = this.findNearbyWireEndpoint(
	            x,
	            y,
	            threshold,
	            options.excludeWireId,
	            options.excludeEnd,
	            options.excludeWireEndpoints
	        );
        if (nearbyEndpoint) {
            return {
                x: nearbyEndpoint.x,
                y: nearbyEndpoint.y,
                snap: { type: 'wire-endpoint', wireId: nearbyEndpoint.wireId, end: nearbyEndpoint.end }
            };
        }

        return {
            x: Math.round(x / 20) * 20,
            y: Math.round(y / 20) * 20,
            snap: { type: 'grid' }
        };
	    }

	    findNearbyWireEndpoint(x, y, threshold, excludeWireId = null, excludeEnd = null, excludeWireEndpoints = null) {
	        let best = null;
	        let bestDist = Infinity;

	        for (const wire of this.circuit.getAllWires()) {
	            if (!wire) continue;
	            for (const end of ['a', 'b']) {
	                if (excludeWireEndpoints && excludeWireEndpoints.has(`${wire.id}:${end}`)) continue;
	                if (excludeWireId && wire.id === excludeWireId && excludeEnd === end) continue;
	                const pt = wire[end];
	                if (!pt) continue;
	                const dist = Math.hypot(x - pt.x, y - pt.y);
                if (dist < threshold && dist < bestDist) {
                    bestDist = dist;
                    best = { wireId: wire.id, end, x: pt.x, y: pt.y };
                }
            }
        }
        return best;
    }

    /**
     * 双击导线：在指定位置分割为两段（Model C）
     */
    splitWireAtPoint(wireId, x, y) {
        const wire = this.circuit.getWire(wireId);
        if (!wire || !wire.a || !wire.b) return;

        const split = this.snapPoint(x, y, { excludeWireId: wireId });

        // Keep split aligned for axis-aligned wires.
        if (wire.a.x === wire.b.x) split.x = wire.a.x;
        if (wire.a.y === wire.b.y) split.y = wire.a.y;

        const tooClose =
            Math.hypot(split.x - wire.a.x, split.y - wire.a.y) < 5 ||
            Math.hypot(split.x - wire.b.x, split.y - wire.b.y) < 5;
        if (tooClose) return;

        const oldB = { x: wire.b.x, y: wire.b.y };
        const oldBRef = wire.bRef ? { ...wire.bRef } : null;
        wire.b = { x: split.x, y: split.y };
        delete wire.bRef;
        this.renderer.refreshWire(wireId);

        const newWire = {
            id: `wire_${Date.now()}`,
            a: { x: split.x, y: split.y },
            b: oldB
        };
        if (oldBRef) newWire.bRef = oldBRef;

        this.circuit.addWire(newWire);
        this.renderer.addWire(newWire);
        this.updateStatus('导线已分割');
    }

    /**
     * 从导线节点开始连线
     */
    startWiringFromNode(wireId, nodeIndex, e) {
        const wire = this.circuit.getWire(wireId);
        if (!wire || !wire.controlPoints || !wire.controlPoints[nodeIndex]) return;
        
        // 确保清除任何残留的辅助线和高亮
        this.hideAlignmentGuides();
        this.renderer.clearTerminalHighlight();
        
        const nodePos = wire.controlPoints[nodeIndex];
        
        this.isWiring = true;
        // 记录连线起点为导线节点
        this.wireStart = { 
            isWireNode: true,
            wireId: wireId,
            nodeIndex: nodeIndex,
            position: nodePos
        };
        
        // 选中该导线
        this.selectWire(wireId);
        
        // 创建临时导线
        this.tempWire = this.renderer.createTempWire();
        
        // 使用统一的坐标转换
        const canvasCoords = this.screenToCanvas(e.clientX, e.clientY);
        this.renderer.updateTempWire(this.tempWire, nodePos.x, nodePos.y, canvasCoords.x, canvasCoords.y);
    }

    /**
     * 结束连线
     */
    endWiring(componentId, terminalIndex) {
        if (!this.wireStart) return;
        
        // 如果是从导线节点开始的连线
        if (this.wireStart.isWireNode) {
            this.endWiringFromNodeToTerminal(componentId, terminalIndex);
            return;
        }
        
        // 不能连接到自己
        if (this.wireStart.componentId === componentId && 
            this.wireStart.terminalIndex === terminalIndex) {
            this.cancelWiring();
            return;
        }
        
        // 检查是否已经存在这条连接
        for (const wire of this.circuit.getAllWires()) {
            if ((wire.startComponentId === this.wireStart.componentId && 
                 wire.startTerminalIndex === this.wireStart.terminalIndex &&
                 wire.endComponentId === componentId &&
                 wire.endTerminalIndex === terminalIndex) ||
                (wire.startComponentId === componentId && 
                 wire.startTerminalIndex === terminalIndex &&
                 wire.endComponentId === this.wireStart.componentId &&
                 wire.endTerminalIndex === this.wireStart.terminalIndex)) {
                this.cancelWiring();
                return;
            }
        }
        
        // 创建导线
        const wire = {
            id: `wire_${Date.now()}`,
            startComponentId: this.wireStart.componentId,
            startTerminalIndex: this.wireStart.terminalIndex,
            endComponentId: componentId,
            endTerminalIndex: terminalIndex
        };
        
        this.circuit.addWire(wire);
        this.renderer.addWire(wire);
        
        this.cancelWiring();
        this.updateStatus('已添加连接');
    }

    /**
     * 从导线节点开始连线到端子
     * 所见即所得：从节点位置创建一条新导线连接到目标端子
     */
    endWiringFromNodeToTerminal(componentId, terminalIndex) {
        const sourceWire = this.circuit.getWire(this.wireStart.wireId);
        if (!sourceWire || !sourceWire.controlPoints) {
            this.cancelWiring();
            return;
        }
        
        const nodePos = this.wireStart.position;
        
        // 找到离节点更近的那个端点作为"中转"
        const startTerminalPos = this.renderer.getTerminalPosition(
            sourceWire.startComponentId, 
            sourceWire.startTerminalIndex
        );
        const endTerminalPos = this.renderer.getTerminalPosition(
            sourceWire.endComponentId, 
            sourceWire.endTerminalIndex
        );
        
        let hubComponentId, hubTerminalIndex;
        
        if (startTerminalPos && endTerminalPos) {
            const distToStart = Math.hypot(nodePos.x - startTerminalPos.x, nodePos.y - startTerminalPos.y);
            const distToEnd = Math.hypot(nodePos.x - endTerminalPos.x, nodePos.y - endTerminalPos.y);
            
            if (distToStart <= distToEnd) {
                hubComponentId = sourceWire.startComponentId;
                hubTerminalIndex = sourceWire.startTerminalIndex;
            } else {
                hubComponentId = sourceWire.endComponentId;
                hubTerminalIndex = sourceWire.endTerminalIndex;
            }
        } else {
            // 回退：使用起始端点
            hubComponentId = sourceWire.startComponentId;
            hubTerminalIndex = sourceWire.startTerminalIndex;
        }
        
        // 创建一条新导线：从源导线的较近端点连接到目标端点
        // 控制点经过节点位置，实现视觉上"从节点连出"的效果
        const newWire = {
            id: `wire_${Date.now()}`,
            startComponentId: hubComponentId,
            startTerminalIndex: hubTerminalIndex,
            endComponentId: componentId,
            endTerminalIndex: terminalIndex,
            controlPoints: [nodePos]  // 经过节点位置
        };
        
        this.circuit.addWire(newWire);
        this.renderer.addWire(newWire);
        
        // 重建节点
        this.circuit.rebuildNodes();
        
        this.cancelWiring();
        this.updateStatus('已添加连接');
    }

    /**
     * 结束连线到导线节点
     * 所见即所得：创建一条新导线连接两个端点，经过节点位置
     */
    endWiringToNode(targetWireId, nodeIndex) {
        if (!this.wireStart) return;
        
        // 如果从导线节点开始连接到另一个节点
        if (this.wireStart.isWireNode) {
            this.endWiringNodeToNode(targetWireId, nodeIndex);
            return;
        }
        
        // 从端子连接到导线节点
        const targetWire = this.circuit.getWire(targetWireId);
        if (!targetWire || !targetWire.controlPoints) {
            this.cancelWiring();
            return;
        }
        
        const nodePos = targetWire.controlPoints[nodeIndex];
        if (!nodePos) {
            this.cancelWiring();
            return;
        }
        
        // 找到离节点更近的那个端点作为"中转"
        const startTerminalPos = this.renderer.getTerminalPosition(
            targetWire.startComponentId, 
            targetWire.startTerminalIndex
        );
        const endTerminalPos = this.renderer.getTerminalPosition(
            targetWire.endComponentId, 
            targetWire.endTerminalIndex
        );
        
        let hubComponentId, hubTerminalIndex;
        
        if (startTerminalPos && endTerminalPos) {
            const distToStart = Math.hypot(nodePos.x - startTerminalPos.x, nodePos.y - startTerminalPos.y);
            const distToEnd = Math.hypot(nodePos.x - endTerminalPos.x, nodePos.y - endTerminalPos.y);
            
            if (distToStart <= distToEnd) {
                hubComponentId = targetWire.startComponentId;
                hubTerminalIndex = targetWire.startTerminalIndex;
            } else {
                hubComponentId = targetWire.endComponentId;
                hubTerminalIndex = targetWire.endTerminalIndex;
            }
        } else {
            // 回退：使用起始端点
            hubComponentId = targetWire.startComponentId;
            hubTerminalIndex = targetWire.startTerminalIndex;
        }
        
        // 创建一条新导线：从起始端点连接到目标导线的较近端点
        // 控制点经过节点位置，实现视觉上"连到节点"的效果
        const newWire = {
            id: `wire_${Date.now()}`,
            startComponentId: this.wireStart.componentId,
            startTerminalIndex: this.wireStart.terminalIndex,
            endComponentId: hubComponentId,
            endTerminalIndex: hubTerminalIndex,
            controlPoints: [nodePos]  // 经过节点位置
        };
        
        this.circuit.addWire(newWire);
        this.renderer.addWire(newWire);
        
        // 重建节点
        this.circuit.rebuildNodes();
        
        this.cancelWiring();
        this.updateStatus('已添加连接');
    }

    /**
     * 从导线节点连接到另一个导线节点
     * 所见即所得：创建一条新导线连接两条导线的端点，经过两个节点位置
     */
    endWiringNodeToNode(targetWireId, targetNodeIndex) {
        const sourceWireId = this.wireStart.wireId;
        const sourceNodeIndex = this.wireStart.nodeIndex;
        
        // 不能连接同一条导线的同一个节点
        if (sourceWireId === targetWireId && sourceNodeIndex === targetNodeIndex) {
            this.cancelWiring();
            return;
        }
        
        const sourceWire = this.circuit.getWire(sourceWireId);
        const targetWire = this.circuit.getWire(targetWireId);
        
        if (!sourceWire || !sourceWire.controlPoints || !targetWire || !targetWire.controlPoints) {
            this.cancelWiring();
            return;
        }
        
        const sourceNodePos = this.wireStart.position;
        const targetNodePos = targetWire.controlPoints[targetNodeIndex];
        
        if (!sourceNodePos || !targetNodePos) {
            this.cancelWiring();
            return;
        }
        
        // 如果是同一条导线的不同节点，不需要创建新连接（已经连通）
        if (sourceWireId === targetWireId) {
            this.cancelWiring();
            this.updateStatus('同一导线上的节点已连通');
            return;
        }
        
        // 找到源导线离节点更近的端点
        const sourceStartPos = this.renderer.getTerminalPosition(
            sourceWire.startComponentId, 
            sourceWire.startTerminalIndex
        );
        const sourceEndPos = this.renderer.getTerminalPosition(
            sourceWire.endComponentId, 
            sourceWire.endTerminalIndex
        );
        
        let sourceHubComponentId, sourceHubTerminalIndex;
        if (sourceStartPos && sourceEndPos) {
            const distToStart = Math.hypot(sourceNodePos.x - sourceStartPos.x, sourceNodePos.y - sourceStartPos.y);
            const distToEnd = Math.hypot(sourceNodePos.x - sourceEndPos.x, sourceNodePos.y - sourceEndPos.y);
            if (distToStart <= distToEnd) {
                sourceHubComponentId = sourceWire.startComponentId;
                sourceHubTerminalIndex = sourceWire.startTerminalIndex;
            } else {
                sourceHubComponentId = sourceWire.endComponentId;
                sourceHubTerminalIndex = sourceWire.endTerminalIndex;
            }
        } else {
            sourceHubComponentId = sourceWire.startComponentId;
            sourceHubTerminalIndex = sourceWire.startTerminalIndex;
        }
        
        // 找到目标导线离节点更近的端点
        const targetStartPos = this.renderer.getTerminalPosition(
            targetWire.startComponentId, 
            targetWire.startTerminalIndex
        );
        const targetEndPos = this.renderer.getTerminalPosition(
            targetWire.endComponentId, 
            targetWire.endTerminalIndex
        );
        
        let targetHubComponentId, targetHubTerminalIndex;
        if (targetStartPos && targetEndPos) {
            const distToStart = Math.hypot(targetNodePos.x - targetStartPos.x, targetNodePos.y - targetStartPos.y);
            const distToEnd = Math.hypot(targetNodePos.x - targetEndPos.x, targetNodePos.y - targetEndPos.y);
            if (distToStart <= distToEnd) {
                targetHubComponentId = targetWire.startComponentId;
                targetHubTerminalIndex = targetWire.startTerminalIndex;
            } else {
                targetHubComponentId = targetWire.endComponentId;
                targetHubTerminalIndex = targetWire.endTerminalIndex;
            }
        } else {
            targetHubComponentId = targetWire.startComponentId;
            targetHubTerminalIndex = targetWire.startTerminalIndex;
        }
        
        // 创建一条新导线连接两条导线的较近端点
        // 控制点经过两个节点位置
        const newWire = {
            id: `wire_${Date.now()}`,
            startComponentId: sourceHubComponentId,
            startTerminalIndex: sourceHubTerminalIndex,
            endComponentId: targetHubComponentId,
            endTerminalIndex: targetHubTerminalIndex,
            controlPoints: [sourceNodePos, targetNodePos]  // 经过两个节点位置
        };
        
        this.circuit.addWire(newWire);
        this.renderer.addWire(newWire);
        
        // 重建节点
        this.circuit.rebuildNodes();
        
        this.cancelWiring();
        this.updateStatus('已添加连接');
    }

    /**
     * 取消连线
     */
    cancelWiring() {
        this.isWiring = false;
        this.wireStart = null;
        if (this.tempWire) {
            this.renderer.removeTempWire(this.tempWire);
            this.tempWire = null;
        }
        // 确保清除辅助线和高亮
        this.hideAlignmentGuides();
        this.renderer.clearTerminalHighlight();
    }

    /**
     * 端子延长拖动（平滑移动，支持对齐）
     */
    startTerminalExtend(componentId, terminalIndex, e) {
        const comp = this.circuit.getComponent(componentId);
        if (!comp) return;

        // 初始化端子延长数据
        if (!comp.terminalExtensions) {
            comp.terminalExtensions = {};
        }
        if (!comp.terminalExtensions[terminalIndex]) {
            comp.terminalExtensions[terminalIndex] = { x: 0, y: 0 };
        }

        const startX = e.clientX;
        const startY = e.clientY;
        const startExtX = comp.terminalExtensions[terminalIndex].x;
        const startExtY = comp.terminalExtensions[terminalIndex].y;
        const rotation = (comp.rotation || 0) * Math.PI / 180;

        const onMove = (moveE) => {
            // 计算鼠标移动向量（屏幕坐标，考虑缩放）
            const dx = (moveE.clientX - startX) / this.scale;
            const dy = (moveE.clientY - startY) / this.scale;

            // 将移动向量转换到元器件本地坐标系
            const cos = Math.cos(-rotation);
            const sin = Math.sin(-rotation);
            const localDx = dx * cos - dy * sin;
            const localDy = dx * sin + dy * cos;

            // 计算新的延长偏移（平滑移动，不强制对齐网格）
            let newExtX = startExtX + localDx;
            let newExtY = startExtY + localDy;

            // 与网格轻微吸附，便于对齐
            const snapThreshold = 8;
            const gridX = Math.round(newExtX / 20) * 20;
            const gridY = Math.round(newExtY / 20) * 20;
            if (Math.abs(newExtX - gridX) < snapThreshold) newExtX = gridX;
            if (Math.abs(newExtY - gridY) < snapThreshold) newExtY = gridY;

            // 检测与水平/垂直方向的对齐
            if (Math.abs(newExtY) < snapThreshold) newExtY = 0;
            if (Math.abs(newExtX) < snapThreshold) newExtX = 0;

            comp.terminalExtensions[terminalIndex] = { x: newExtX, y: newExtY };

            // 重新渲染元器件
            this.renderer.refreshComponent(comp);
            this.renderer.setSelected(componentId, true);

            // 更新连接到该元器件的所有导线
            this.renderer.updateConnectedWires(componentId);
        };

        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            this.hideAlignmentGuides();
            // 端子位置会影响坐标拓扑，需重建节点
            this.circuit.rebuildNodes();
            this.updateStatus('端子位置已调整');
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);

        e.preventDefault();
        e.stopPropagation();
    }

    /**
     * 滑动变阻器拖动
     */
    startRheostatDrag(componentId, e) {
        const comp = this.circuit.getComponent(componentId);
        if (!comp || comp.type !== 'Rheostat') return;
        
        // 记录初始位置和初始position
        const startX = e.clientX;
        const startY = e.clientY;
        const startPosition = comp.position;
        const rotation = (comp.rotation || 0) * Math.PI / 180;
        
        const onMove = (moveE) => {
            // 计算鼠标移动向量
            const dx = moveE.clientX - startX;
            const dy = moveE.clientY - startY;
            
            // 将鼠标移动向量旋转到元器件本地坐标系
            // 元器件旋转了rotation角度，所以鼠标移动要反向旋转
            const cos = Math.cos(-rotation);
            const sin = Math.sin(-rotation);
            const localDx = dx * cos - dy * sin;
            
            // 根据本地X方向移动距离计算新位置
            const width = 70; // 滑动范围（像素）
            const positionDelta = localDx / width;
            let position = Math.max(0, Math.min(1, startPosition + positionDelta));
            comp.position = position;
            
            // 重新渲染元器件
            this.renderer.refreshComponent(comp);
            this.renderer.setSelected(componentId, true);
            
            // 更新连接到该元器件的所有导线（特别是连接到滑动触点的导线）
            this.renderer.updateConnectedWires(componentId);
            
            // 只更新属性面板中的动态值，避免整体刷新导致闪烁
            this.updateRheostatPanelValues(comp);
        };
        
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            // 拖动结束后完整刷新一次属性面板
            this.updatePropertyPanel(comp);
        };
        
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    /**
     * 平行板电容探索模式：拖动右侧极板
     * - 左右拖动：改变板间距 d
     * - 上下拖动：改变重叠面积（通过纵向错位近似）
     */
    startParallelPlateCapacitorDrag(componentId, e) {
        const comp = this.circuit.getComponent(componentId);
        if (!comp || comp.type !== 'ParallelPlateCapacitor' || !comp.explorationMode) return;

        // 选中以便同步右侧面板
        if (this.selectedComponent !== componentId) {
            this.selectComponent(componentId);
        }

        const plateLengthPx = 24;
        const pxPerMm = 10;
        const minGapPx = 6;
        const maxGapPx = 30;

        const startCanvas = this.screenToCanvas(e.clientX, e.clientY);
        const startLocal = this.canvasToComponentLocal(comp, startCanvas);

        const startDistanceMm = (comp.plateDistance ?? 0.001) * 1000;
        const startGapPx = Math.min(maxGapPx, Math.max(minGapPx, startDistanceMm * pxPerMm));
        const startOffsetY = comp.plateOffsetYPx ?? 0;

        const onMove = (moveE) => {
            const canvas = this.screenToCanvas(moveE.clientX, moveE.clientY);
            const local = this.canvasToComponentLocal(comp, canvas);
            const dx = local.x - startLocal.x;
            const dy = local.y - startLocal.y;

            const gapPx = Math.min(maxGapPx, Math.max(minGapPx, startGapPx + dx));
            const distanceMm = gapPx / pxPerMm;
            comp.plateDistance = distanceMm / 1000;
            comp.plateOffsetYPx = Math.min(plateLengthPx, Math.max(-plateLengthPx, startOffsetY + dy));

            this.recomputeParallelPlateCapacitance(comp, { updateVisual: true, updatePanel: true });
            this.renderer.setSelected(componentId, true);
        };

        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            this.updateStatus('已调整平行板电容参数');
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);

        e.preventDefault();
        e.stopPropagation();
    }

    /**
     * 选择元器件
     */
    selectComponent(id) {
        this.clearSelection();
        this.selectedComponent = id;
        this.selectedWire = null;
        this.renderer.setSelected(id, true);

        if (typeof this.activateSidePanelTab === 'function') {
            this.activateSidePanelTab('properties');
        }
        
        const comp = this.circuit.getComponent(id);
        if (comp) {
            this.updatePropertyPanel(comp);
        }
    }

    /**
     * 选择导线（10 秒后自动取消选择）
     */
    selectWire(id) {
        this.clearSelection();
        this.selectedWire = id;
        this.selectedComponent = null;
        this.renderer.setWireSelected(id, true);

        if (typeof this.activateSidePanelTab === 'function') {
            this.activateSidePanelTab('properties');
        }
        
        // 清除之前的自动隐藏计时器
        if (this.wireAutoHideTimer) {
            clearTimeout(this.wireAutoHideTimer);
            this.wireAutoHideTimer = null;
        }
        
        // 设置10秒后自动取消选择
        this.wireAutoHideTimer = setTimeout(() => {
            if (this.selectedWire === id) {
                this.renderer.setWireSelected(id, false);
                this.selectedWire = null;
                // 恢复属性面板
                const content = document.getElementById('property-content');
                clearElement(content);
                const hint = createElement('p', { className: 'hint', textContent: '选择一个元器件查看和编辑属性' });
                content.appendChild(hint);
            }
        }, 10000);
        
        const wire = this.circuit.getWire(id);
        const fmtEnd = (which) => {
            const ref = which === 'a' ? wire?.aRef : wire?.bRef;
            if (ref && ref.componentId !== undefined && ref.componentId !== null) {
                return `${ref.componentId}:${ref.terminalIndex}`;
            }
            const pt = which === 'a' ? wire?.a : wire?.b;
            if (pt && Number.isFinite(Number(pt.x)) && Number.isFinite(Number(pt.y))) {
                return `(${Math.round(Number(pt.x))},${Math.round(Number(pt.y))})`;
            }
            return '?';
        };
        const length = wire?.a && wire?.b ? Math.hypot(wire.a.x - wire.b.x, wire.a.y - wire.b.y) : 0;
        
        // 显示导线信息（使用安全的 DOM 操作）
        const content = document.getElementById('property-content');
        clearElement(content);
        
        content.appendChild(createPropertyRow('类型', '导线'));
        content.appendChild(createPropertyRow('端点 A', fmtEnd('a')));
        content.appendChild(createPropertyRow('端点 B', fmtEnd('b')));
        content.appendChild(createPropertyRow('长度', `${length.toFixed(1)} px`));
	        content.appendChild(createHintParagraph([
	            '拖动导线可整体平移（按网格移动）',
	            '拖动两端圆点可移动端点（默认拖动整节点，按 Alt 仅拖动单端点）',
	            '双击导线可在该处分割成两段',
	            'Shift + 点击空白处可从任意位置开始画导线（允许独立导线）',
	            'Alt + 拖动端子可伸长/缩短元器件引脚'
	        ]));
	    }
    
    /**
     * 处理导线节点的点击：拖动移动或点击连线
     * 如果鼠标移动超过阈值，则是拖动移动节点
     * 如果鼠标没有移动就释放，则开始从该节点连线
     */
    startControlPointDragOrWiring(wireId, pointIndex, e) {
        const wire = this.circuit.getWire(wireId);
        if (!wire || !wire.controlPoints || !wire.controlPoints[pointIndex]) return;
        
        const startX = e.clientX;
        const startY = e.clientY;
        const moveThreshold = 5; // 移动超过5像素才算拖动
        let hasMoved = false;
        let isDragging = false;
        
        // 选中该导线
        this.selectWire(wireId);
        
        // 清除自动隐藏计时器
        if (this.wireAutoHideTimer) {
            clearTimeout(this.wireAutoHideTimer);
            this.wireAutoHideTimer = null;
        }
        
        const onMove = (moveE) => {
            const dx = moveE.clientX - startX;
            const dy = moveE.clientY - startY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > moveThreshold) {
                hasMoved = true;
                
                // 第一次确认是拖动时，切换到拖动模式
                if (!isDragging) {
                    isDragging = true;
                }
                
                // 执行拖动逻辑
                const canvasCoords = this.screenToCanvas(moveE.clientX, moveE.clientY);
                let x = canvasCoords.x;
                let y = canvasCoords.y;
                
                // 检测附近的端点或其他导线节点（用于连接）
                const nearbyTerminal = this.findNearbyTerminal(x, y, 20);
                const nearbyWireNode = !nearbyTerminal ? this.findNearbyWireNode(x, y, 15, wireId, pointIndex) : null;
                
                if (nearbyTerminal) {
                    const termPos = this.renderer.getTerminalPosition(
                        nearbyTerminal.componentId, 
                        nearbyTerminal.terminalIndex
                    );
                    if (termPos) {
                        x = termPos.x;
                        y = termPos.y;
                    }
                    this.renderer.highlightTerminal(nearbyTerminal.componentId, nearbyTerminal.terminalIndex);
                    this.hideAlignmentGuides();
                } else if (nearbyWireNode) {
                    x = nearbyWireNode.x;
                    y = nearbyWireNode.y;
                    this.renderer.highlightWireNode(nearbyWireNode.x, nearbyWireNode.y);
                    this.hideAlignmentGuides();
                } else {
                    this.renderer.clearTerminalHighlight();
                    
                    // 检测与其他点的对齐
                    const otherPoints = this.getWireAlignmentPoints(wire, pointIndex);
                    const snapThreshold = 8;
                    let snapInfo = { guideLines: [] };
                    
                    for (const p of otherPoints) {
                        if (Math.abs(y - p.y) < snapThreshold) {
                            y = p.y;
                            snapInfo.guideLines.push({
                                type: 'horizontal',
                                y: p.y,
                                x1: Math.min(x, p.x) - 20,
                                x2: Math.max(x, p.x) + 20
                            });
                        }
                        if (Math.abs(x - p.x) < snapThreshold) {
                            x = p.x;
                            snapInfo.guideLines.push({
                                type: 'vertical',
                                x: p.x,
                                y1: Math.min(y, p.y) - 20,
                                y2: Math.max(y, p.y) + 20
                            });
                        }
                    }
                    this.showAlignmentGuides(snapInfo);
                }
                
                wire.controlPoints[pointIndex] = { x, y };
                this.renderer.refreshWire(wireId);
            }
        };
        
        const onUp = (upE) => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            this.hideAlignmentGuides();
            this.renderer.clearTerminalHighlight();
            
            if (hasMoved) {
                // 是拖动操作，检查是否需要连接到端点
                const finalPos = wire.controlPoints[pointIndex];
                const nearbyTerminal = this.findNearbyTerminal(finalPos.x, finalPos.y, 20);
                
                if (nearbyTerminal) {
                    this.createConnectionFromWireNode(wireId, pointIndex, nearbyTerminal);
                } else {
                    const nearbyNode = this.findNearbyWireNode(finalPos.x, finalPos.y, 15, wireId, pointIndex);
                    if (nearbyNode) {
                        wire.controlPoints[pointIndex] = { x: nearbyNode.x, y: nearbyNode.y };
                        this.renderer.refreshWire(wireId);
                    }
                }
            } else {
                // 是点击操作（没有移动），开始从该节点连线
                this.startWiringFromNode(wireId, pointIndex, upE);
            }
            
            // 重新设置自动隐藏计时器
            this.resetWireAutoHideTimer(wireId);
        };
        
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }
    
    /**
     * 拖动导线控制点（平滑移动，可选网格吸附，支持连接到端点）
     */
    startControlPointDrag(wireId, pointIndex, e) {
        const wire = this.circuit.getWire(wireId);
        if (!wire || !wire.controlPoints || !wire.controlPoints[pointIndex]) return;
        
        // 选中该导线
        this.selectWire(wireId);
        
        let nearbyTerminal = null; // 记录附近的端点
        
        // 清除自动隐藏计时器（用户正在操作）
        if (this.wireAutoHideTimer) {
            clearTimeout(this.wireAutoHideTimer);
            this.wireAutoHideTimer = null;
        }
        
        const onMove = (moveE) => {
            // 使用统一的坐标转换
            const canvasCoords = this.screenToCanvas(moveE.clientX, moveE.clientY);
            
            let x = canvasCoords.x;
            let y = canvasCoords.y;
            
            // 检测附近的端点或其他导线节点（用于连接）
            nearbyTerminal = this.findNearbyTerminal(x, y, 20);
            const nearbyWireNode = !nearbyTerminal ? this.findNearbyWireNode(x, y, 15, wireId, pointIndex) : null;
            
            // 如果有附近的端点，吸附到它并高亮
            if (nearbyTerminal) {
                const termPos = this.renderer.getTerminalPosition(
                    nearbyTerminal.componentId, 
                    nearbyTerminal.terminalIndex
                );
                if (termPos) {
                    x = termPos.x;
                    y = termPos.y;
                }
                // 高亮端点
                this.renderer.highlightTerminal(nearbyTerminal.componentId, nearbyTerminal.terminalIndex);
                this.hideAlignmentGuides();
            } else if (nearbyWireNode) {
                // 吸附到其他导线节点
                x = nearbyWireNode.x;
                y = nearbyWireNode.y;
                this.renderer.highlightWireNode(nearbyWireNode.x, nearbyWireNode.y);
                this.hideAlignmentGuides();
            } else {
                // 清除高亮
                this.renderer.clearTerminalHighlight();
                
                // 检测与其他点的对齐（水平/垂直）
                const otherPoints = this.getWireAlignmentPoints(wire, pointIndex);
                const snapThreshold = 8;
                
                let snapInfo = { guideLines: [] };
                
                for (const p of otherPoints) {
                    // 水平对齐
                    if (Math.abs(y - p.y) < snapThreshold) {
                        y = p.y;
                        snapInfo.guideLines.push({
                            type: 'horizontal',
                            y: p.y,
                            x1: Math.min(x, p.x) - 20,
                            x2: Math.max(x, p.x) + 20
                        });
                    }
                    // 垂直对齐
                    if (Math.abs(x - p.x) < snapThreshold) {
                        x = p.x;
                        snapInfo.guideLines.push({
                            type: 'vertical',
                            x: p.x,
                            y1: Math.min(y, p.y) - 20,
                            y2: Math.max(y, p.y) + 20
                        });
                    }
                }
                this.showAlignmentGuides(snapInfo);
            }
            
            wire.controlPoints[pointIndex] = { x, y };
            this.renderer.refreshWire(wireId);
        };
        
        const onUp = (upE) => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            this.hideAlignmentGuides();
            this.renderer.clearTerminalHighlight();
            
            // 获取最终位置
            const finalPos = wire.controlPoints[pointIndex];
            
            // 如果释放时在端点附近，创建新的连接
            if (nearbyTerminal) {
                this.createConnectionFromWireNode(wireId, pointIndex, nearbyTerminal);
            } else {
                // 检查是否在其他导线节点附近
                const nearbyNode = this.findNearbyWireNode(finalPos.x, finalPos.y, 15, wireId, pointIndex);
                if (nearbyNode) {
                    // 合并两个节点位置
                    wire.controlPoints[pointIndex] = { x: nearbyNode.x, y: nearbyNode.y };
                    this.renderer.refreshWire(wireId);
                }
            }
            
            // 重新设置自动隐藏计时器
            this.resetWireAutoHideTimer(wireId);
        };
        
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }
    
    /**
     * 重置导线自动隐藏计时器
     */
    resetWireAutoHideTimer(wireId) {
        if (this.wireAutoHideTimer) {
            clearTimeout(this.wireAutoHideTimer);
        }
        this.wireAutoHideTimer = setTimeout(() => {
            if (this.selectedWire === wireId) {
                this.renderer.setWireSelected(wireId, false);
                this.selectedWire = null;
                const content = document.getElementById('property-content');
                clearElement(content);
                const hint = createElement('p', { className: 'hint', textContent: '选择一个元器件查看和编辑属性' });
                content.appendChild(hint);
            }
        }, 10000);
    }
    
    /**
     * 查找附近的导线节点
     */
    findNearbyWireNode(x, y, threshold, excludeWireId = null, excludePointIndex = null) {
        for (const [wireId, wire] of this.circuit.wires) {
            if (!wire.controlPoints) continue;
            
            for (let i = 0; i < wire.controlPoints.length; i++) {
                // 排除当前正在拖动的节点
                if (wireId === excludeWireId && i === excludePointIndex) continue;
                
                const cp = wire.controlPoints[i];
                const dist = Math.sqrt((x - cp.x) ** 2 + (y - cp.y) ** 2);
                if (dist < threshold) {
                    return { wireId, pointIndex: i, x: cp.x, y: cp.y };
                }
            }
        }
        return null;
    }

    /**
     * 查找附近的端点
     * @param {number} x - x坐标
     * @param {number} y - y坐标  
     * @param {number} threshold - 距离阈值
     * @returns {Object|null} 端点信息 {componentId, terminalIndex} 或 null
     */
    findNearbyTerminal(x, y, threshold) {
        for (const [id, comp] of this.circuit.components) {
            // 检查每个端点
            const terminalCount = comp.type === 'Rheostat' ? 3 : 2;
            for (let ti = 0; ti < terminalCount; ti++) {
                const pos = this.renderer.getTerminalPosition(id, ti);
                if (pos) {
                    const dist = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
                    if (dist < threshold) {
                        return { componentId: id, terminalIndex: ti };
                    }
                }
            }
        }
        return null;
    }

    /**
     * 在导线节点处分割导线并连接到新端点
     * @param {string} wireId - 原导线ID
     * @param {number} nodeIndex - 节点索引
     * @param {Object} terminal - 目标端点 {componentId, terminalIndex}
     */
    splitWireAtNode(wireId, nodeIndex, terminal) {
        // 调用新的实现
        this.createConnectionFromWireNode(wireId, nodeIndex, terminal);
    }

    /**
     * 从导线节点创建到端点的连接
     * 实现方式：将原导线分成两段，都连接到目标端点
     */
    createConnectionFromWireNode(wireId, nodeIndex, terminal) {
        const wire = this.circuit.getWire(wireId);
        if (!wire || !wire.controlPoints) return;
        
        // 获取节点位置
        const nodePos = wire.controlPoints[nodeIndex];
        if (!nodePos) return;
        
        // 保存原导线信息
        const originalStart = {
            componentId: wire.startComponentId,
            terminalIndex: wire.startTerminalIndex
        };
        const originalEnd = {
            componentId: wire.endComponentId,
            terminalIndex: wire.endTerminalIndex
        };
        
        // 分割控制点
        const controlPointsBefore = wire.controlPoints.slice(0, nodeIndex);
        const controlPointsAfter = wire.controlPoints.slice(nodeIndex + 1);
        
        // 删除原导线
        this.circuit.removeWire(wireId);
        this.renderer.removeWire(wireId);
        
        // 创建导线1：原起点 -> 目标端点
        const wire1 = {
            id: `wire_${Date.now()}_1`,
            startComponentId: originalStart.componentId,
            startTerminalIndex: originalStart.terminalIndex,
            endComponentId: terminal.componentId,
            endTerminalIndex: terminal.terminalIndex,
            controlPoints: [...controlPointsBefore, nodePos]
        };
        this.circuit.addWire(wire1);
        this.renderer.addWire(wire1);
        
        // 创建导线2：目标端点 -> 原终点
        const wire2 = {
            id: `wire_${Date.now()}_2`,
            startComponentId: terminal.componentId,
            startTerminalIndex: terminal.terminalIndex,
            endComponentId: originalEnd.componentId,
            endTerminalIndex: originalEnd.terminalIndex,
            controlPoints: [...controlPointsAfter]
        };
        this.circuit.addWire(wire2);
        this.renderer.addWire(wire2);
        
        // 重建节点
        this.circuit.rebuildNodes();
        
        // 选中新创建的第一条导线
        this.selectWire(wire1.id);
        
        this.updateStatus('已连接到端点');
    }

    /**
     * 获取导线上用于对齐的所有点（排除当前拖动的点）
     */
    getWireAlignmentPoints(wire, excludeIndex) {
        const points = [];
        
        // 添加起点和终点
        const startPos = this.renderer.getTerminalPosition(wire.startComponentId, wire.startTerminalIndex);
        const endPos = this.renderer.getTerminalPosition(wire.endComponentId, wire.endTerminalIndex);
        
        if (startPos) points.push(startPos);
        if (endPos) points.push(endPos);
        
        // 添加其他控制点
        if (wire.controlPoints) {
            wire.controlPoints.forEach((cp, i) => {
                if (i !== excludeIndex) {
                    points.push(cp);
                }
            });
        }
        
        return points;
    }

    /**
     * 在导线上的任意位置添加节点
     * @param {string} wireId - 导线ID
     * @param {number} clickX - 点击的x坐标
     * @param {number} clickY - 点击的y坐标
     * @param {MouseEvent} e - 鼠标事件
     */
    addWireNodeAtPosition(wireId, clickX, clickY, e) {
        const wire = this.circuit.getWire(wireId);
        if (!wire) return;
        
        // 获取导线的所有路径点
        const startPos = this.renderer.getTerminalPosition(wire.startComponentId, wire.startTerminalIndex);
        const endPos = this.renderer.getTerminalPosition(wire.endComponentId, wire.endTerminalIndex);
        
        if (!startPos || !endPos) return;
        
        const controlPoints = wire.controlPoints || [];
        const allPoints = [startPos, ...controlPoints, endPos];
        
        // 找到点击位置最近的线段
        let bestSegment = 0;
        let minDist = Infinity;
        
        for (let i = 0; i < allPoints.length - 1; i++) {
            const p1 = allPoints[i];
            const p2 = allPoints[i + 1];
            const dist = this.pointToSegmentDistance(clickX, clickY, p1.x, p1.y, p2.x, p2.y);
            if (dist < minDist) {
                minDist = dist;
                bestSegment = i;
            }
        }
        
        // 初始化控制点数组
        if (!wire.controlPoints) {
            wire.controlPoints = [];
        }
        
        // 在最近的线段位置插入新控制点（使用点击位置，不吸附到网格）
        const newPoint = { x: clickX, y: clickY };
        wire.controlPoints.splice(bestSegment, 0, newPoint);
        
        // 选中导线并刷新显示
        this.selectWire(wireId);
        this.renderer.refreshWire(wireId);
        
        // 立即开始拖动新控制点
        this.startControlPointDrag(wireId, bestSegment, e);
    }

    /**
     * 计算点到线段的距离
     */
    pointToSegmentDistance(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len2 = dx * dx + dy * dy;
        
        if (len2 === 0) {
            // 线段退化为点
            return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
        }
        
        // 投影参数 t，限制在 [0, 1] 范围内
        let t = ((px - x1) * dx + (py - y1) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        
        // 最近点
        const nearestX = x1 + t * dx;
        const nearestY = y1 + t * dy;
        
        return Math.sqrt((px - nearestX) ** 2 + (py - nearestY) ** 2);
    }

    /**
     * 添加导线控制点
     */
    addWireControlPoint(wireId, segmentIndex, e) {
        const wire = this.circuit.getWire(wireId);
        if (!wire) return;
        
        if (!wire.controlPoints) {
            wire.controlPoints = [];
        }
        
        // 使用统一的坐标转换
        const canvasCoords = this.screenToCanvas(e.clientX, e.clientY);
        const x = Math.round(canvasCoords.x / 20) * 20;
        const y = Math.round(canvasCoords.y / 20) * 20;
        
        // 在指定段插入新控制点
        wire.controlPoints.splice(segmentIndex, 0, { x, y });
        
        // 刷新导线显示
        this.renderer.refreshWire(wireId);
        
        // 立即开始拖动新控制点
        this.startControlPointDrag(wireId, segmentIndex, e);
    }

    /**
     * 删除导线控制点
     */
    removeWireControlPoint(wireId, pointIndex) {
        const wire = this.circuit.getWire(wireId);
        if (!wire || !wire.controlPoints) return;
        
        wire.controlPoints.splice(pointIndex, 1);
        this.renderer.refreshWire(wireId);
        this.selectWire(wireId); // 刷新属性面板
    }

    /**
     * 清除选择
     */
    clearSelection() {
        // 清除自动隐藏计时器
        if (this.wireAutoHideTimer) {
            clearTimeout(this.wireAutoHideTimer);
            this.wireAutoHideTimer = null;
        }
        
        this.renderer.clearSelection();
        this.selectedComponent = null;
        this.selectedWire = null;
        
        const content = document.getElementById('property-content');
        clearElement(content);
        const hint = createElement('p', { className: 'hint', textContent: '选择一个元器件查看和编辑属性' });
        content.appendChild(hint);
    }

    /**
     * 更新属性面板（使用安全的 DOM 操作防止 XSS）
     */
    updatePropertyPanel(comp) {
        const content = document.getElementById('property-content');
        clearElement(content);
        
        // 基础属性
        content.appendChild(createPropertyRow('类型', ComponentNames[comp.type]));
        content.appendChild(createPropertyRow('ID', comp.id));
        
        // 添加自定义标签编辑
        const labelGroup = createFormGroup('标签 (例如 V1, R1)', {
            id: 'comp-label',
            type: 'text',
            value: comp.label || '',
            placeholder: '输入标签名称'
        }, '自定义标签将显示在元器件上');
        const labelInput = labelGroup.querySelector('#comp-label');
        labelInput.addEventListener('change', () => {
            const newLabel = labelInput.value.trim();
            comp.label = newLabel || null;
            this.renderer.render();
            this.app.observationPanel?.refreshComponentOptions();
            this.app.observationPanel?.refreshDialGauges();
            this.app.updateStatus(`已更新标签: ${newLabel || '（空）'}`);
        });
        content.appendChild(labelGroup);

        // 数值显示（每个元器件单独配置）
        const displayKeys = (() => {
            switch (comp.type) {
                case 'Switch':
                case 'BlackBox':
                    return [];
                case 'Ammeter':
                    return ['current'];
                case 'Voltmeter':
                    return ['voltage'];
                default:
                    return ['current', 'voltage', 'power'];
            }
        })();

        if (displayKeys.length > 0) {
            const displayHeader = createElement('h3', { textContent: '数值显示' });
            content.appendChild(displayHeader);

            const chipRow = createElement('div', { className: 'display-chip-row' });
            const chipLabels = {
                current: 'I 电流',
                voltage: 'U 电压',
                power: 'P 功率'
            };

            // 确保 display 结构存在
            if (!comp.display || typeof comp.display !== 'object') {
                comp.display = { current: true, voltage: false, power: false };
            }

            displayKeys.forEach((key) => {
                const isOn = !!comp.display[key];
                const btn = createElement('button', {
                    className: 'display-chip' + (isOn ? ' active' : ''),
                    textContent: chipLabels[key] || key,
                    attrs: {
                        type: 'button',
                        'data-key': key,
                        'aria-pressed': isOn ? 'true' : 'false'
                    }
                });

                btn.addEventListener('click', () => {
                    const next = !comp.display[key];
                    comp.display[key] = next;
                    btn.classList.toggle('active', next);
                    btn.setAttribute('aria-pressed', next ? 'true' : 'false');
                    this.renderer.updateValues();
                });

                chipRow.appendChild(btn);
            });

            content.appendChild(chipRow);
        }
        
        // 根据类型显示不同的属性
        switch (comp.type) {
            case 'PowerSource':
                content.appendChild(createPropertyRow('电动势', `${comp.voltage} V`));
                content.appendChild(createPropertyRow('内阻', `${comp.internalResistance} Ω`));
                break;
                
            case 'Resistor':
                content.appendChild(createPropertyRow('电阻值', `${comp.resistance} Ω`));
                break;
                
            case 'Rheostat': {
                const connectionModeText = {
                    'left-slider': '左端-滑块',
                    'right-slider': '右端-滑块', 
                    'left-right': '左端-右端（全阻）',
                    'all': '并联（三端）',
                    'slider-only': '未接通',
                    'none': '未接通'
                };
                const directionText = {
                    'slider-right-increase': '→增大',
                    'slider-right-decrease': '→减小',
                    'fixed': '固定',
                    'parallel': '并联',
                    'disconnected': '-'
                };
                content.appendChild(createPropertyRow('阻值范围', `${comp.minResistance} ~ ${comp.maxResistance} Ω`));
                content.appendChild(createPropertyRow('接入方式', connectionModeText[comp.connectionMode] || '未接通', { valueId: 'rheostat-mode' }));
                content.appendChild(createPropertyRow('接入电阻', `${(comp.activeResistance || 0).toFixed(1)} Ω`, { 
                    valueId: 'rheostat-current-r', 
                    small: directionText[comp.resistanceDirection] || '' 
                }));
                content.appendChild(createPropertyRow('滑块位置', `${(comp.position * 100).toFixed(0)}%`, { valueId: 'rheostat-position' }));
                break;
            }
                
            case 'Bulb':
                content.appendChild(createPropertyRow('灯丝电阻', `${comp.resistance} Ω`));
                content.appendChild(createPropertyRow('额定功率', `${comp.ratedPower} W`));
                break;
                
            case 'Capacitor':
                content.appendChild(createPropertyRow('电容值', `${(comp.capacitance * 1000000).toFixed(0)} μF`));
                break;

            case 'ParallelPlateCapacitor': {
                // 先用当前物理参数同步一次电容值（不改变已存电荷）
                this.recomputeParallelPlateCapacitance(comp, { updateVisual: false, updatePanel: false });

                content.appendChild(createElement('h3', { textContent: '探索模式' }));

                const exploreGroup = createElement('div', { className: 'form-group' });
                exploreGroup.appendChild(createElement('label', { textContent: '开启探索（拖动右侧极板）' }));
                const exploreToggle = createElement('input', {
                    id: 'ppc-toggle-explore',
                    attrs: { type: 'checkbox' }
                });
                exploreToggle.checked = !!comp.explorationMode;
                exploreToggle.addEventListener('change', () => {
                    comp.explorationMode = !!exploreToggle.checked;
                    this.recomputeParallelPlateCapacitance(comp, { updateVisual: true, updatePanel: true });
                });
                exploreGroup.appendChild(exploreToggle);
                exploreGroup.appendChild(createElement('p', { className: 'hint', textContent: '左右拖动改变 d，上下拖动改变重叠面积' }));
                content.appendChild(exploreGroup);

                const distanceGroup = createFormGroup('极板间距 d', {
                    id: 'ppc-input-distance',
                    value: ((comp.plateDistance || 0) * 1000).toFixed(3),
                    min: 0.001,
                    step: 0.1,
                    unit: 'mm'
                });
                const areaGroup = createFormGroup('极板面积 A', {
                    id: 'ppc-input-area',
                    value: ((comp.plateArea || 0) * 10000).toFixed(2),
                    min: 0.01,
                    step: 1,
                    unit: 'cm²'
                });
                const erGroup = createFormGroup('介电常数 εr', {
                    id: 'ppc-input-er',
                    value: comp.dielectricConstant ?? 1,
                    min: 1,
                    step: 0.1,
                    unit: ''
                });

                content.appendChild(distanceGroup);
                content.appendChild(areaGroup);
                content.appendChild(erGroup);

                const distanceInput = distanceGroup.querySelector('#ppc-input-distance');
                if (distanceInput) {
                    distanceInput.addEventListener('change', () => {
                        const distanceMm = this.safeParseFloat(distanceInput.value, (comp.plateDistance || 0.001) * 1000, 0.001, 1e9);
                        comp.plateDistance = distanceMm / 1000;
                        this.recomputeParallelPlateCapacitance(comp, { updateVisual: true, updatePanel: true });
                    });
                }

                const areaInput = areaGroup.querySelector('#ppc-input-area');
                if (areaInput) {
                    areaInput.addEventListener('change', () => {
                        const areaCm2 = this.safeParseFloat(areaInput.value, (comp.plateArea || 0.01) * 10000, 0.01, 1e12);
                        comp.plateArea = areaCm2 / 10000;
                        this.recomputeParallelPlateCapacitance(comp, { updateVisual: true, updatePanel: true });
                    });
                }

                const erInput = erGroup.querySelector('#ppc-input-er');
                if (erInput) {
                    erInput.addEventListener('change', () => {
                        comp.dielectricConstant = this.safeParseFloat(erInput.value, comp.dielectricConstant ?? 1, 1, 1e9);
                        this.recomputeParallelPlateCapacitance(comp, { updateVisual: true, updatePanel: true });
                    });
                }

                content.appendChild(createElement('h3', { textContent: '演示量' }));
                content.appendChild(createPropertyRow('电容 C', '—', { valueId: 'ppc-readout-capacitance' }));
                content.appendChild(createPropertyRow('板间距 d', '—', { valueId: 'ppc-readout-distance' }));
                content.appendChild(createPropertyRow('重叠比例', '—', { valueId: 'ppc-readout-overlap' }));
                content.appendChild(createPropertyRow('有效面积 A_eff', '—', { valueId: 'ppc-readout-area' }));
                content.appendChild(createPropertyRow('电场强度 E', '—', { valueId: 'ppc-readout-field' }));
                content.appendChild(createPropertyRow('电荷 |Q|', '—', { valueId: 'ppc-readout-charge' }));

                // 初始化一次读数
                this.updateParallelPlateCapacitorPanelValues(comp);
                break;
            }
                
            case 'Motor':
                content.appendChild(createPropertyRow('电枢电阻', `${comp.resistance} Ω`));
                content.appendChild(createPropertyRow('转速', `${((comp.speed || 0) * 60 / (2 * Math.PI)).toFixed(0)} rpm`));
                break;
                
            case 'Switch':
                content.appendChild(createPropertyRow('状态', comp.closed ? '闭合' : '断开'));
                break;
                
            case 'Ammeter':
                content.appendChild(createPropertyRow('内阻', comp.resistance > 0 ? `${comp.resistance} Ω` : '理想（0Ω）'));
                content.appendChild(createPropertyRow('量程', `${comp.range} A`));
                content.appendChild(createPropertyRow('读数', `${(Math.abs(comp.currentValue) || 0).toFixed(3)} A`, { 
                    rowClass: 'reading', 
                    valueClass: 'ammeter-reading' 
                }));
                break;
                
            case 'Voltmeter':
                content.appendChild(createPropertyRow('内阻', comp.resistance === Infinity ? '理想（∞）' : `${comp.resistance} Ω`));
                content.appendChild(createPropertyRow('量程', `${comp.range} V`));
                content.appendChild(createPropertyRow('读数', `${(Math.abs(comp.voltageValue) || 0).toFixed(3)} V`, { 
                    rowClass: 'reading', 
                    valueClass: 'voltmeter-reading' 
                }));
                break;

            case 'BlackBox': {
                const w = Math.max(80, comp.boxWidth || 180);
                const h = Math.max(60, comp.boxHeight || 110);
                const modeLabel = comp.viewMode === 'opaque' ? '隐藏（黑箱）' : '透明（可观察）';

                // 自动统计当前“盒内”组件数量（不含自身）
                const contained = this.getBlackBoxContainedComponentIds(comp, { includeBoxes: true });

                content.appendChild(createPropertyRow('大小', `${w.toFixed(0)} × ${h.toFixed(0)} px`));
                content.appendChild(createPropertyRow('显示模式', modeLabel));
                content.appendChild(createPropertyRow('内部元件数', `${contained.length} 个`));

                content.appendChild(createElement('h3', { textContent: '黑箱设置' }));

                const modeGroup = createElement('div', { className: 'form-group' });
                modeGroup.appendChild(createElement('label', { textContent: '内部可见性' }));
                const modeSelect = createElement('select', { id: 'blackbox-viewmode' });
                modeSelect.appendChild(createElement('option', { textContent: '透明（观察内部）', attrs: { value: 'transparent' } }));
                modeSelect.appendChild(createElement('option', { textContent: '隐藏（黑箱）', attrs: { value: 'opaque' } }));
                modeSelect.value = comp.viewMode === 'opaque' ? 'opaque' : 'transparent';
                modeSelect.addEventListener('change', () => {
                    comp.viewMode = modeSelect.value === 'opaque' ? 'opaque' : 'transparent';
                    this.renderer.render();
                    this.selectComponent(comp.id);
                });
                modeGroup.appendChild(modeSelect);
                modeGroup.appendChild(createElement('p', { className: 'hint', textContent: '隐藏模式下，盒内元件与导线会被遮挡/隐藏，电路计算不受影响。' }));
                content.appendChild(modeGroup);

                const widthGroup = createFormGroup('宽度', {
                    id: 'blackbox-width',
                    value: w.toFixed(0),
                    min: 80,
                    step: 10,
                    unit: 'px'
                });
                const heightGroup = createFormGroup('高度', {
                    id: 'blackbox-height',
                    value: h.toFixed(0),
                    min: 60,
                    step: 10,
                    unit: 'px'
                });
                const widthInput = widthGroup.querySelector('#blackbox-width');
                const heightInput = heightGroup.querySelector('#blackbox-height');
                if (widthInput) {
                    widthInput.addEventListener('change', () => {
                        comp.boxWidth = this.safeParseFloat(widthInput.value, w, 80, 5000);
                        this.renderer.render();
                        this.selectComponent(comp.id);
                    });
                }
                if (heightInput) {
                    heightInput.addEventListener('change', () => {
                        comp.boxHeight = this.safeParseFloat(heightInput.value, h, 60, 5000);
                        this.renderer.render();
                        this.selectComponent(comp.id);
                    });
                }
                content.appendChild(widthGroup);
                content.appendChild(heightGroup);
                break;
            }
        }
        
        // 实时测量（不再每帧重建面板，改为更新这些读数节点）
        content.appendChild(createElement('h3', { textContent: '实时测量' }));
        content.appendChild(createPropertyRow('电流', `${(comp.currentValue || 0).toFixed(4)} A`, { valueId: 'measure-current' }));
        content.appendChild(createPropertyRow('电压', `${(comp.voltageValue || 0).toFixed(4)} V`, { valueId: 'measure-voltage' }));
        content.appendChild(createPropertyRow('功率', `${(comp.powerValue || 0).toFixed(4)} W`, { valueId: 'measure-power' }));
        
	        content.appendChild(createHintParagraph([
	            '双击或右键编辑属性',
	            '按 R 旋转，按 Delete 删除',
	            'Shift + 点击空白处开始画导线',
	            'Alt + 拖动端子可伸长/缩短元器件引脚'
	        ]));
	    }

    /**
     * 仅更新属性面板里的“实时测量”等动态值，避免每帧重建 DOM 导致闪烁/输入框失焦
     */
    updateSelectedComponentReadouts(comp) {
        if (!comp) return;

        const currentEl = document.getElementById('measure-current');
        const voltageEl = document.getElementById('measure-voltage');
        const powerEl = document.getElementById('measure-power');

        if (currentEl) currentEl.textContent = `${(comp.currentValue || 0).toFixed(4)} A`;
        if (voltageEl) voltageEl.textContent = `${(comp.voltageValue || 0).toFixed(4)} V`;
        if (powerEl) powerEl.textContent = `${(comp.powerValue || 0).toFixed(4)} W`;

        // 仪表读数行（如果存在）
        const ammeterReading = document.querySelector('.ammeter-reading');
        if (ammeterReading && comp.type === 'Ammeter') {
            ammeterReading.textContent = `${(Math.abs(comp.currentValue) || 0).toFixed(3)} A`;
        }
        const voltmeterReading = document.querySelector('.voltmeter-reading');
        if (voltmeterReading && comp.type === 'Voltmeter') {
            voltmeterReading.textContent = `${(Math.abs(comp.voltageValue) || 0).toFixed(3)} V`;
        }

        // 特殊组件的动态字段
        if (comp.type === 'Rheostat') {
            this.updateRheostatPanelValues(comp);
        }
        if (comp.type === 'ParallelPlateCapacitor') {
            this.updateParallelPlateCapacitorPanelValues(comp);
        }
    }

    /**
     * 仅更新滑动变阻器属性面板的动态值（避免闪烁）
     */
    updateRheostatPanelValues(comp) {
        if (!comp || comp.type !== 'Rheostat') return;
        
        // 重新计算接入电路的电阻
        this.circuit.calculateRheostatActiveResistance(comp);
        
        const currentREl = document.getElementById('rheostat-current-r');
        const positionEl = document.getElementById('rheostat-position');
        
        const directionText = {
            'slider-right-increase': '→增大',
            'slider-right-decrease': '→减小',
            'fixed': '固定',
            'parallel': '并联',
            'disconnected': '-'
        };
        
        if (currentREl && positionEl) {
            // 使用安全的 DOM 操作
            clearElement(currentREl);
            currentREl.appendChild(document.createTextNode(`${(comp.activeResistance || 0).toFixed(1)} Ω `));
            const small = createElement('small', { textContent: directionText[comp.resistanceDirection] || '' });
            currentREl.appendChild(small);
            
            positionEl.textContent = `${(comp.position * 100).toFixed(0)}%`;
        }
    }

    /**
     * 根据平行板电容的物理参数重算电容值，并可选更新图形/面板。
     * 注意：不修改 prevCharge（用于保持“断开后 Q 近似守恒”的演示效果）。
     */
    recomputeParallelPlateCapacitance(comp, options = {}) {
        if (!comp || comp.type !== 'ParallelPlateCapacitor') return;

        const plateLengthPx = 24;
        const overlapFraction = computeOverlapFractionFromOffsetPx(comp.plateOffsetYPx || 0, plateLengthPx);
        const C = computeParallelPlateCapacitance({
            plateArea: comp.plateArea,
            plateDistance: comp.plateDistance,
            dielectricConstant: comp.dielectricConstant,
            overlapFraction
        });
        comp.capacitance = C;

        if (options.updateVisual) {
            const g = this.renderer.componentElements.get(comp.id);
            if (g) {
                SVGRenderer.updateParallelPlateCapacitorVisual(g, comp);
            } else {
                this.renderer.refreshComponent(comp);
            }
        }

        if (options.updatePanel) {
            this.updateParallelPlateCapacitorPanelValues(comp);
        }
    }

    /**
     * 仅更新平行板电容在属性面板中的动态字段
     */
    updateParallelPlateCapacitorPanelValues(comp) {
        if (!comp || comp.type !== 'ParallelPlateCapacitor') return;

        const plateLengthPx = 24;
        const overlapFraction = computeOverlapFractionFromOffsetPx(comp.plateOffsetYPx || 0, plateLengthPx);
        const distanceMm = (comp.plateDistance || 0) * 1000;
        const areaCm2 = (comp.plateArea || 0) * 10000;
        const effAreaCm2 = areaCm2 * overlapFraction;

        const voltage = Math.abs(comp.voltageValue || 0);
        const field = comp.plateDistance ? voltage / comp.plateDistance : 0; // V/m
        const charge = Math.abs(comp.prevCharge ?? (comp.capacitance || 0) * (comp.prevVoltage || 0));

        const capEl = document.getElementById('ppc-readout-capacitance');
        const distanceEl = document.getElementById('ppc-readout-distance');
        const overlapEl = document.getElementById('ppc-readout-overlap');
        const areaEl = document.getElementById('ppc-readout-area');
        const fieldEl = document.getElementById('ppc-readout-field');
        const chargeEl = document.getElementById('ppc-readout-charge');

        const formatCap = (C) => {
            if (!Number.isFinite(C)) return '0 F';
            const absC = Math.abs(C);
            if (absC >= 1e-3) return `${(C * 1e3).toFixed(3)} mF`;
            if (absC >= 1e-6) return `${(C * 1e6).toFixed(3)} μF`;
            if (absC >= 1e-9) return `${(C * 1e9).toFixed(3)} nF`;
            return `${(C * 1e12).toFixed(3)} pF`;
        };

        const formatCharge = (Q) => {
            if (!Number.isFinite(Q)) return '0 C';
            const absQ = Math.abs(Q);
            if (absQ >= 1e-3) return `${(Q * 1e3).toFixed(3)} mC`;
            if (absQ >= 1e-6) return `${(Q * 1e6).toFixed(3)} μC`;
            if (absQ >= 1e-9) return `${(Q * 1e9).toFixed(3)} nC`;
            return `${(Q * 1e12).toFixed(3)} pC`;
        };

        const formatField = (E) => {
            if (!Number.isFinite(E)) return '0 V/m';
            const absE = Math.abs(E);
            if (absE >= 1e6) return `${(E / 1e6).toFixed(3)} MV/m`;
            if (absE >= 1e3) return `${(E / 1e3).toFixed(3)} kV/m`;
            return `${E.toFixed(3)} V/m`;
        };

        if (capEl) capEl.textContent = formatCap(comp.capacitance || 0);
        if (distanceEl) distanceEl.textContent = `${distanceMm.toFixed(3)} mm`;
        if (overlapEl) overlapEl.textContent = `${(overlapFraction * 100).toFixed(1)}%`;
        if (areaEl) areaEl.textContent = `${effAreaCm2.toFixed(2)} cm²`;
        if (fieldEl) fieldEl.textContent = formatField(field);
        if (chargeEl) chargeEl.textContent = formatCharge(charge);

        // 输入框（如果存在）也同步当前值，避免拖动时显示滞后
        const distanceInput = document.getElementById('ppc-input-distance');
        if (distanceInput && document.activeElement !== distanceInput) {
            distanceInput.value = distanceMm.toFixed(3);
        }
    }

    /**
     * 显示属性编辑对话框（使用安全的 DOM 操作防止 XSS）
     */
    showPropertyDialog(id) {
        const comp = this.circuit.getComponent(id);
        if (!comp) return;
        
        this.editingComponent = comp;
        
        const dialog = document.getElementById('dialog-overlay');
        const title = document.getElementById('dialog-title');
        const content = document.getElementById('dialog-content');
        
        title.textContent = `编辑 ${ComponentNames[comp.type]}`;
        
        // 使用安全的 DOM 操作构建对话框内容
        clearElement(content);
        
        switch (comp.type) {
            case 'PowerSource':
                content.appendChild(createFormGroup('电动势 (V)', {
                    id: 'edit-voltage',
                    value: comp.voltage,
                    min: 0,
                    step: 0.1,
                    unit: 'V'
                }));
                content.appendChild(createFormGroup('内阻 (Ω)', {
                    id: 'edit-internal-resistance',
                    value: comp.internalResistance,
                    min: 0,
                    step: 0.1,
                    unit: 'Ω'
                }));
                break;
                
            case 'Resistor':
                content.appendChild(createFormGroup('电阻值 (Ω)', {
                    id: 'edit-resistance',
                    value: comp.resistance,
                    min: 0.001,
                    step: 1,
                    unit: 'Ω'
                }));
                break;
                
            case 'Rheostat':
                content.appendChild(createFormGroup('最小电阻 (Ω)', {
                    id: 'edit-min-resistance',
                    value: comp.minResistance,
                    min: 0,
                    step: 1,
                    unit: 'Ω'
                }));
                content.appendChild(createFormGroup('最大电阻 (Ω)', {
                    id: 'edit-max-resistance',
                    value: comp.maxResistance,
                    min: 0.001,
                    step: 1,
                    unit: 'Ω'
                }));
                content.appendChild(createSliderFormGroup('滑块位置', {
                    id: 'edit-position',
                    valueId: 'position-value',
                    value: (comp.position * 100).toFixed(0),
                    displayValue: `${(comp.position * 100).toFixed(0)}%`,
                    min: 0,
                    max: 100,
                    step: 1
                }));
                break;
                
            case 'Bulb':
                content.appendChild(createFormGroup('灯丝电阻 (Ω)', {
                    id: 'edit-resistance',
                    value: comp.resistance,
                    min: 0.001,
                    step: 1,
                    unit: 'Ω'
                }));
                content.appendChild(createFormGroup('额定功率 (W)', {
                    id: 'edit-rated-power',
                    value: comp.ratedPower,
                    min: 0.001,
                    step: 0.1,
                    unit: 'W'
                }));
                break;
                
            case 'Capacitor':
                content.appendChild(createFormGroup('电容值 (μF)', {
                    id: 'edit-capacitance',
                    value: comp.capacitance * 1000000,
                    min: 0.001,
                    step: 100,
                    unit: 'μF'
                }));
                break;

            case 'ParallelPlateCapacitor': {
                content.appendChild(createFormGroup('极板面积 A (cm²)', {
                    id: 'edit-plate-area',
                    value: (comp.plateArea || 0) * 10000,
                    min: 0.01,
                    step: 1,
                    unit: 'cm²'
                }));
                content.appendChild(createFormGroup('极板间距 d (mm)', {
                    id: 'edit-plate-distance',
                    value: (comp.plateDistance || 0) * 1000,
                    min: 0.01,
                    step: 0.1,
                    unit: 'mm'
                }));
                content.appendChild(createFormGroup('相对介电常数 εr', {
                    id: 'edit-dielectric-constant',
                    value: comp.dielectricConstant ?? 1,
                    min: 1,
                    step: 0.1,
                    unit: ''
                }));

                const exploreGroup = createElement('div', { className: 'form-group' });
                exploreGroup.appendChild(createElement('label', { textContent: '探索模式（可拖动极板）' }));
                const checkbox = createElement('input', {
                    id: 'edit-exploration-mode',
                    attrs: { type: 'checkbox' }
                });
                checkbox.checked = !!comp.explorationMode;
                exploreGroup.appendChild(checkbox);
                content.appendChild(exploreGroup);
                break;
            }
                
            case 'Motor':
                content.appendChild(createFormGroup('电枢电阻 (Ω)', {
                    id: 'edit-resistance',
                    value: comp.resistance,
                    min: 0.001,
                    step: 0.1,
                    unit: 'Ω'
                }));
                content.appendChild(createFormGroup('负载转矩 (N·m)', {
                    id: 'edit-load-torque',
                    value: comp.loadTorque,
                    min: 0,
                    step: 0.001,
                    unit: 'N·m'
                }));
                break;
                
            case 'Switch':
                content.appendChild(createSwitchToggleGroup(comp.closed));
                break;
                
            case 'Ammeter':
                content.appendChild(createFormGroup('内阻 (Ω)', {
                    id: 'edit-resistance',
                    value: comp.resistance,
                    min: 0,
                    step: 0.01,
                    unit: 'Ω'
                }, '设为 0 表示理想电流表'));
                content.appendChild(createFormGroup('量程 (A)', {
                    id: 'edit-range',
                    value: comp.range,
                    min: 0.001,
                    step: 0.1,
                    unit: 'A'
                }));
                break;
                
            case 'Voltmeter':
                content.appendChild(createFormGroup('内阻 (Ω)', {
                    id: 'edit-resistance',
                    value: comp.resistance === Infinity ? '' : comp.resistance,
                    min: 0,
                    step: 100,
                    unit: 'Ω',
                    placeholder: '留空表示无穷大'
                }, '留空或填 0 表示理想电压表（无穷大内阻）'));
                content.appendChild(createFormGroup('量程 (V)', {
                    id: 'edit-range',
                    value: comp.range,
                    min: 0.001,
                    step: 1,
                    unit: 'V'
                }));
                break;

            case 'BlackBox': {
                const w = Math.max(80, comp.boxWidth || 180);
                const h = Math.max(60, comp.boxHeight || 110);
                content.appendChild(createFormGroup('宽度 (px)', {
                    id: 'edit-box-width',
                    value: w,
                    min: 80,
                    step: 10,
                    unit: 'px'
                }));
                content.appendChild(createFormGroup('高度 (px)', {
                    id: 'edit-box-height',
                    value: h,
                    min: 60,
                    step: 10,
                    unit: 'px'
                }));

                const modeGroup = createElement('div', { className: 'form-group' });
                modeGroup.appendChild(createElement('label', { textContent: '显示模式' }));
                const select = createElement('select', { id: 'edit-box-mode' });
                select.appendChild(createElement('option', { textContent: '透明（观察内部）', attrs: { value: 'transparent' } }));
                select.appendChild(createElement('option', { textContent: '隐藏（黑箱）', attrs: { value: 'opaque' } }));
                select.value = comp.viewMode === 'opaque' ? 'opaque' : 'transparent';
                modeGroup.appendChild(select);
                modeGroup.appendChild(createElement('p', { className: 'hint', textContent: '隐藏模式下会遮挡盒内电路，但电学计算不变。' }));
                content.appendChild(modeGroup);
                break;
            }
        }
        
        dialog.classList.remove('hidden');
        
        // 滑块实时更新
        const positionSlider = document.getElementById('edit-position');
        const positionValue = document.getElementById('position-value');
        if (positionSlider && positionValue) {
            positionSlider.addEventListener('input', () => {
                positionValue.textContent = `${positionSlider.value}%`;
            });
        }
        
        // 开关状态切换按钮
        const switchOpen = document.getElementById('switch-open');
        const switchClose = document.getElementById('switch-close');
        if (switchOpen && switchClose) {
            switchOpen.addEventListener('click', () => {
                switchOpen.classList.add('active');
                switchClose.classList.remove('active');
            });
            switchClose.addEventListener('click', () => {
                switchClose.classList.add('active');
                switchOpen.classList.remove('active');
            });
        }
    }

    /**
     * 隐藏对话框
     */
    hideDialog() {
        document.getElementById('dialog-overlay').classList.add('hidden');
        this.editingComponent = null;
    }

    /**
     * 安全解析数值，返回有效值或默认值
     */
    safeParseFloat(value, defaultValue, minValue = null, maxValue = null) {
        let result = parseFloat(value);
        if (!Number.isFinite(result)) {
            result = defaultValue;
        }
        if (minValue !== null && result < minValue) {
            result = minValue;
        }
        if (maxValue !== null && result > maxValue) {
            result = maxValue;
        }
        return result;
    }

    /**
     * 获取黑箱内部包含的元器件（按中心点是否落在盒子范围内判断）
     * @param {Object} boxComp
     * @param {Object} options
     * @param {boolean} [options.includeBoxes=false] - 是否包含其它黑箱
     * @returns {string[]} component ids
     */
    getBlackBoxContainedComponentIds(boxComp, options = {}) {
        if (!boxComp || boxComp.type !== 'BlackBox') return [];
        const includeBoxes = !!options.includeBoxes;
        const w = Math.max(80, boxComp.boxWidth || 180);
        const h = Math.max(60, boxComp.boxHeight || 110);
        const left = (boxComp.x || 0) - w / 2;
        const right = (boxComp.x || 0) + w / 2;
        const top = (boxComp.y || 0) - h / 2;
        const bottom = (boxComp.y || 0) + h / 2;

        const ids = [];
        for (const [id, comp] of this.circuit.components) {
            if (!comp || id === boxComp.id) continue;
            if (!includeBoxes && comp.type === 'BlackBox') continue;
            const x = comp.x || 0;
            const y = comp.y || 0;
            if (x >= left && x <= right && y >= top && y <= bottom) {
                ids.push(id);
            }
        }
        return ids;
    }

    /**
     * 应用对话框更改
     */
    applyDialogChanges() {
        if (!this.editingComponent) return;
        
        const comp = this.editingComponent;
        
        try {
            switch (comp.type) {
                case 'PowerSource':
                    comp.voltage = this.safeParseFloat(
                        document.getElementById('edit-voltage').value, 12, 0, 10000
                    );
                    // 内阻不能为0，会导致矩阵奇异；最小设为极小值
                    let internalR = this.safeParseFloat(
                        document.getElementById('edit-internal-resistance').value, 0.5, 0, 10000
                    );
                    // 如果用户输入0，使用极小值避免求解器奇异
                    comp.internalResistance = internalR < 1e-9 ? 1e-9 : internalR;
                    break;
                    
                case 'Resistor':
                    // 电阻最小值为极小正数，避免除零
                    comp.resistance = this.safeParseFloat(
                        document.getElementById('edit-resistance').value, 100, 1e-9, 1e12
                    );
                    break;
                    
                case 'Rheostat':
                    comp.minResistance = this.safeParseFloat(
                        document.getElementById('edit-min-resistance').value, 0, 0, 1e12
                    );
                    comp.maxResistance = this.safeParseFloat(
                        document.getElementById('edit-max-resistance').value, 100, comp.minResistance + 0.001, 1e12
                    );
                    comp.position = this.safeParseFloat(
                        document.getElementById('edit-position').value, 50, 0, 100
                    ) / 100;
                    break;
                    
                case 'Bulb':
                    comp.resistance = this.safeParseFloat(
                        document.getElementById('edit-resistance').value, 50, 1e-9, 1e12
                    );
                    comp.ratedPower = this.safeParseFloat(
                        document.getElementById('edit-rated-power').value, 5, 0.001, 1e9
                    );
                    break;
                    
                case 'Capacitor':
                    // 电容值以μF输入，转换为F
                    const capValue = this.safeParseFloat(
                        document.getElementById('edit-capacitance').value, 1000, 0.001, 1e12
                    );
                    comp.capacitance = capValue / 1000000;
                    break;

                case 'ParallelPlateCapacitor': {
                    const areaCm2 = this.safeParseFloat(
                        document.getElementById('edit-plate-area').value,
                        (comp.plateArea || 0.01) * 10000,
                        0.01,
                        1e12
                    );
                    const distanceMm = this.safeParseFloat(
                        document.getElementById('edit-plate-distance').value,
                        (comp.plateDistance || 0.001) * 1000,
                        0.001,
                        1e9
                    );
                    comp.plateArea = areaCm2 / 10000;
                    comp.plateDistance = distanceMm / 1000;
                    comp.dielectricConstant = this.safeParseFloat(
                        document.getElementById('edit-dielectric-constant').value,
                        comp.dielectricConstant ?? 1,
                        1,
                        1e9
                    );
                    const exploreEl = document.getElementById('edit-exploration-mode');
                    comp.explorationMode = !!(exploreEl && exploreEl.checked);

                    this.recomputeParallelPlateCapacitance(comp, { updateVisual: false });
                    break;
                }
                    
                case 'Motor':
                    comp.resistance = this.safeParseFloat(
                        document.getElementById('edit-resistance').value, 5, 1e-9, 1e12
                    );
                    comp.loadTorque = this.safeParseFloat(
                        document.getElementById('edit-load-torque').value, 0.01, 0, 1e9
                    );
                    break;
                    
                case 'Switch':
                    // 检查哪个按钮被选中
                    const switchClose = document.getElementById('switch-close');
                    comp.closed = switchClose && switchClose.classList.contains('active');
                    break;
                    
                case 'Ammeter':
                    comp.resistance = this.safeParseFloat(
                        document.getElementById('edit-resistance').value, 0, 0, 1e12
                    );
                    comp.range = this.safeParseFloat(
                        document.getElementById('edit-range').value, 3, 0.001, 1e9
                    );
                    break;
                    
                case 'Voltmeter':
                    const voltmeterR = document.getElementById('edit-resistance').value;
                    // 空值或0表示理想电压表（无穷大内阻）
                    if (voltmeterR === '' || parseFloat(voltmeterR) <= 0) {
                        comp.resistance = Infinity;
                    } else {
                        comp.resistance = this.safeParseFloat(voltmeterR, Infinity, 0, 1e12);
                    }
                    comp.range = this.safeParseFloat(
                        document.getElementById('edit-range').value, 15, 0.001, 1e9
                    );
                    break;

                case 'BlackBox': {
                    comp.boxWidth = this.safeParseFloat(
                        document.getElementById('edit-box-width').value,
                        comp.boxWidth || 180,
                        80,
                        5000
                    );
                    comp.boxHeight = this.safeParseFloat(
                        document.getElementById('edit-box-height').value,
                        comp.boxHeight || 110,
                        60,
                        5000
                    );
                    const mode = document.getElementById('edit-box-mode')?.value;
                    comp.viewMode = mode === 'opaque' ? 'opaque' : 'transparent';
                    break;
                }
            }

            // 刷新渲染
            if (comp.type === 'BlackBox') {
                // 黑箱会影响“内部元件/导线是否显示”，需要全量重绘
                this.renderer.render();
                this.selectComponent(comp.id);
            } else {
                this.renderer.refreshComponent(comp);
                this.renderer.setSelected(comp.id, true);
                // 更新连接到该元器件的导线
                this.renderer.updateConnectedWires(comp.id);
                this.updatePropertyPanel(comp);
            }
            
            this.hideDialog();
            this.updateStatus('属性已更新');
        } catch (error) {
            console.error('Error applying dialog changes:', error);
            this.updateStatus('更新失败：' + error.message);
        }
    }

    /**
     * 显示元器件上下文菜单
     */
    showContextMenu(e, componentId) {
        this.hideContextMenu();
        
        const menu = document.createElement('div');
        menu.id = 'context-menu';
        menu.className = 'context-menu';
        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';
        
        const comp = this.circuit.getComponent(componentId);
        const menuItems = [
            { label: '编辑属性', action: () => this.showPropertyDialog(componentId) },
            { label: '旋转 (R)', action: () => this.rotateComponent(componentId) },
            { label: '复制', action: () => this.duplicateComponent(componentId) },
            { label: '删除 (Del)', action: () => this.deleteComponent(componentId), className: 'danger' }
        ];

        // 仪表：自主读数（右侧指针表盘）
        if (comp && (comp.type === 'Ammeter' || comp.type === 'Voltmeter')) {
            const enabled = !!comp.selfReading;
            menuItems.splice(1, 0, {
                label: enabled ? '关闭自主读数（右侧表盘）' : '开启自主读数（右侧表盘）',
                action: () => {
                    comp.selfReading = !enabled;
                    this.app.observationPanel?.refreshDialGauges();
                    this.app.updateStatus(comp.selfReading ? '已开启自主读数：请在右侧“观察”查看表盘' : '已关闭自主读数');
                }
            });
        }

        // 黑箱：快速切换显示模式
        if (comp && comp.type === 'BlackBox') {
            const isOpaque = comp.viewMode === 'opaque';
            menuItems.splice(1, 0, {
                label: isOpaque ? '设为透明（显示内部）' : '设为隐藏（黑箱）',
                action: () => {
                    comp.viewMode = isOpaque ? 'transparent' : 'opaque';
                    this.renderer.render();
                    this.selectComponent(comp.id);
                    this.app.updateStatus(comp.viewMode === 'opaque' ? '黑箱已设为隐藏模式' : '黑箱已设为透明模式');
                }
            });
        }
        
        menuItems.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.className = 'context-menu-item' + (item.className ? ' ' + item.className : '');
            menuItem.textContent = item.label;
            menuItem.addEventListener('click', () => {
                item.action();
                this.hideContextMenu();
            });
            menu.appendChild(menuItem);
        });
        
        document.body.appendChild(menu);
        
        // 点击其他地方关闭菜单
        setTimeout(() => {
            document.addEventListener('click', this.hideContextMenuHandler);
        }, 0);
    }
    
    /**
     * 显示导线上下文菜单
     */
    showWireContextMenu(e, wireId) {
        this.hideContextMenu();
        
        const menu = document.createElement('div');
        menu.id = 'context-menu';
        menu.className = 'context-menu';
        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';

        const wire = this.circuit.getWire(wireId);
        const canvas = this.screenToCanvas(e.clientX, e.clientY);

        // Decide which endpoint to keep fixed for "straighten" actions based on click proximity.
        let anchorEnd = 'a';
        if (wire && wire.a && wire.b) {
            const dA = Math.hypot(canvas.x - wire.a.x, canvas.y - wire.a.y);
            const dB = Math.hypot(canvas.x - wire.b.x, canvas.y - wire.b.y);
            anchorEnd = dA <= dB ? 'a' : 'b';
        }

        const straightenWire = (mode) => {
            const w = this.circuit.getWire(wireId);
            if (!w || !w.a || !w.b) return;
            const fixed = anchorEnd === 'a' ? w.a : w.b;
            const moveEnd = anchorEnd === 'a' ? 'b' : 'a';
            const moving = w[moveEnd];
            if (!moving) return;

            if (mode === 'horizontal') {
                w[moveEnd] = { x: moving.x, y: fixed.y };
            } else if (mode === 'vertical') {
                w[moveEnd] = { x: fixed.x, y: moving.y };
            }

            // Moving an endpoint manually detaches it from any terminal binding.
            const refKey = moveEnd === 'a' ? 'aRef' : 'bRef';
            delete w[refKey];

            this.renderer.refreshWire(wireId);
            this.circuit.rebuildNodes();
            this.updateStatus(mode === 'horizontal' ? '已水平拉直导线' : '已垂直拉直导线');
        };

        const menuItems = [
            { label: '在此处分割', action: () => this.splitWireAtPoint(wireId, canvas.x, canvas.y) },
            { label: '拉直为水平', action: () => straightenWire('horizontal') },
            { label: '拉直为垂直', action: () => straightenWire('vertical') },
            { label: '删除导线 (Del)', action: () => this.deleteWire(wireId), className: 'danger' }
        ];

        menuItems.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.className = 'context-menu-item' + (item.className ? ' ' + item.className : '');
            menuItem.textContent = item.label;
            menuItem.addEventListener('click', () => {
                item.action();
                this.hideContextMenu();
            });
            menu.appendChild(menuItem);
        });
        
        document.body.appendChild(menu);
        
        setTimeout(() => {
            document.addEventListener('click', this.hideContextMenuHandler);
        }, 0);
    }
    
    /**
     * 隐藏上下文菜单
     */
    hideContextMenu() {
        const menu = document.getElementById('context-menu');
        if (menu) {
            menu.remove();
            document.removeEventListener('click', this.hideContextMenuHandler);
        }
    }
    
    /**
     * 上下文菜单关闭处理器
     */
    hideContextMenuHandler = () => {
        this.hideContextMenu();
    }
    
    /**
     * 复制元器件
     */
    duplicateComponent(id) {
        const comp = this.circuit.getComponent(id);
        if (!comp) return;
        
        // 在原位置偏移一点创建新元器件
        this.addComponent(comp.type, comp.x + 40, comp.y + 40);
    }

    /**
     * 更新状态栏
     */
    updateStatus(text) {
        document.getElementById('status-text').textContent = text;
    }

    /**
     * 检测与其他元器件的对齐
     * @param {string} draggedId - 正在拖动的元器件ID
     * @param {number} x - 当前x坐标
     * @param {number} y - 当前y坐标
     * @returns {Object} 对齐信息
     */
    detectAlignment(draggedId, x, y) {
        const result = {
            snapX: null,
            snapY: null,
            guideLines: []
        };
        
        const threshold = this.snapThreshold;
        
        // 收集所有其他元器件的位置
        const otherPositions = [];
        for (const [id, comp] of this.circuit.components) {
            if (id !== draggedId) {
                otherPositions.push({ x: comp.x, y: comp.y, id });
            }
        }
        
        // 检测水平对齐（y相同）
        for (const other of otherPositions) {
            const diffY = Math.abs(y - other.y);
            if (diffY < threshold) {
                result.snapY = other.y;
                result.guideLines.push({
                    type: 'horizontal',
                    y: other.y,
                    x1: Math.min(x, other.x) - 50,
                    x2: Math.max(x, other.x) + 50
                });
                break;
            }
        }
        
        // 检测垂直对齐（x相同）
        for (const other of otherPositions) {
            const diffX = Math.abs(x - other.x);
            if (diffX < threshold) {
                result.snapX = other.x;
                result.guideLines.push({
                    type: 'vertical',
                    x: other.x,
                    y1: Math.min(y, other.y) - 50,
                    y2: Math.max(y, other.y) + 50
                });
                break;
            }
        }
        
        return result;
    }

    /**
     * 显示对齐辅助线
     */
    showAlignmentGuides(alignment) {
        // 获取或创建辅助线容器
        let guidesGroup = this.svg.querySelector('#alignment-guides');
        if (!guidesGroup) {
            guidesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            guidesGroup.id = 'alignment-guides';
            // 应用与其他图层相同的变换
            guidesGroup.setAttribute('transform', 
                `translate(${this.viewOffset.x}, ${this.viewOffset.y}) scale(${this.scale})`
            );
            this.svg.appendChild(guidesGroup);
        }
        
        // 清除旧的辅助线
        guidesGroup.innerHTML = '';
        
        // 绘制新的辅助线
        for (const guide of alignment.guideLines) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('class', 'alignment-guide');
            
            if (guide.type === 'horizontal') {
                line.setAttribute('x1', guide.x1);
                line.setAttribute('y1', guide.y);
                line.setAttribute('x2', guide.x2);
                line.setAttribute('y2', guide.y);
            } else {
                line.setAttribute('x1', guide.x);
                line.setAttribute('y1', guide.y1);
                line.setAttribute('x2', guide.x);
                line.setAttribute('y2', guide.y2);
            }
            
            guidesGroup.appendChild(line);
        }
    }

    /**
     * 隐藏对齐辅助线
     */
    hideAlignmentGuides() {
        const guidesGroup = this.svg.querySelector('#alignment-guides');
        if (guidesGroup) {
            guidesGroup.innerHTML = '';
        }
    }
}
