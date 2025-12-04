/**
 * Interaction.js - 交互管理器
 * 处理拖放、连线、选择等用户交互
 */

import { createComponent, ComponentNames, ComponentDefaults } from '../components/Component.js';
import { 
    createElement, 
    createPropertyRow, 
    createMeasurementRows, 
    createHintParagraph,
    createFormGroup,
    createSliderFormGroup,
    createSwitchToggleGroup,
    clearElement
} from '../utils/SafeDOM.js';

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
        this.dragOffset = { x: 0, y: 0 };
        this.selectedComponent = null;
        this.selectedWire = null;
        
        // 连线状态
        this.wireStart = null;
        this.tempWire = null;
        
        // 画布平移状态
        this.isPanning = false;
        this.panStart = { x: 0, y: 0 };
        this.viewOffset = { x: 0, y: 0 };
        this.scale = 1;
        
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
     * 绑定所有事件
     */
    bindEvents() {
        // 工具箱拖放
        this.bindToolboxEvents();
        
        // SVG画布事件
        this.bindCanvasEvents();
        
        // 按钮事件
        this.bindButtonEvents();
        
        // 显示设置事件
        this.bindDisplayEvents();
        
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
        const validTypes = ['PowerSource', 'Resistor', 'Rheostat', 'Bulb', 'Capacitor', 'Motor', 'Switch', 'Ammeter', 'Voltmeter'];
        
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
            
            this.addComponent(type, x, y);
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
        
        // 缩放因子
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.min(Math.max(this.scale * zoomFactor, 0.25), 4); // 限制缩放范围 0.25x - 4x
        
        if (newScale === this.scale) return;
        
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
     * 显示设置事件
     */
    bindDisplayEvents() {
        const showCurrent = document.getElementById('show-current');
        const showVoltage = document.getElementById('show-voltage');
        const showPower = document.getElementById('show-power');
        
        const updateDisplay = () => {
            this.renderer.setDisplayOptions(
                showCurrent.checked,
                showVoltage.checked,
                showPower.checked
            );
        };
        
        showCurrent.addEventListener('change', updateDisplay);
        showVoltage.addEventListener('change', updateDisplay);
        showPower.addEventListener('change', updateDisplay);
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
        
        // 右键或中键 - 直接开始拖动画布
        if (e.button === 1 || e.button === 2) {
            this.startPanning(e);
            return;
        }
        
        const target = e.target;
        
        // 检查是否点击了端子
        if (target.classList.contains('terminal')) {
            const componentG = target.closest('.component');
            if (componentG) {
                const componentId = componentG.dataset.id;
                const terminalIndex = parseInt(target.dataset.terminal, 10);
                // 验证端子索引有效
                if (!isNaN(terminalIndex) && terminalIndex >= 0) {
                    // Alt + 拖动 = 延长端子；否则 = 连线
                    if (e.altKey) {
                        this.startTerminalExtend(componentId, terminalIndex, e);
                    } else {
                        this.startWiring(componentId, terminalIndex, e);
                    }
                    return;
                }
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
        
        // 检查是否点击了导线控制点（拖动控制点）
        if (target.classList.contains('wire-control-point')) {
            const wireGroup = target.closest('.wire-group');
            if (wireGroup) {
                const wireId = wireGroup.dataset.id;
                const pointIndex = parseInt(target.dataset.index, 10);
                this.startControlPointDrag(wireId, pointIndex, e);
                return;
            }
        }
        
        // 检查是否点击了添加控制点的位置
        if (target.classList.contains('wire-add-point')) {
            const wireGroup = target.closest('.wire-group');
            if (wireGroup) {
                const wireId = wireGroup.dataset.id;
                const segmentIndex = parseInt(target.dataset.segment, 10);
                this.addWireControlPoint(wireId, segmentIndex, e);
                return;
            }
        }
        
        // 检查是否点击了元器件
        const componentG = target.closest('.component');
        if (componentG) {
            this.startDragging(componentG, e);
            return;
        }
        
        // 检查是否点击了导线或导线组
        if (target.classList.contains('wire')) {
            const wireGroup = target.closest('.wire-group');
            const wireId = wireGroup ? wireGroup.dataset.id : target.dataset.id;
            this.selectWire(wireId);
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
        this.viewOffset = { x: 0, y: 0 };
        this.scale = 1;
        this.updateViewTransform();
        this.updateStatus('视图已重置');
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
        
        // 拖动元器件
        if (this.isDragging && this.dragTarget) {
            const comp = this.circuit.getComponent(this.dragTarget);
            if (comp) {
                // 计算新位置并对齐到网格
                comp.x = Math.round((canvasX - this.dragOffset.x) / 20) * 20;
                comp.y = Math.round((canvasY - this.dragOffset.y) / 20) * 20;
                this.renderer.updateComponentPosition(comp);
            }
        }
        
        // 连线预览
        if (this.isWiring && this.wireStart && this.tempWire) {
            const startPos = this.renderer.getTerminalPosition(
                this.wireStart.componentId, 
                this.wireStart.terminalIndex
            );
            if (startPos) {
                this.renderer.updateTempWire(this.tempWire, startPos.x, startPos.y, canvasX, canvasY);
            }
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
        
        // 结束拖动
        if (this.isDragging) {
            this.isDragging = false;
            this.dragTarget = null;
            this.isDraggingComponent = false; // 清除拖动标志
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
                    this.endWiring(componentId, terminalIndex);
                }
            } else {
                this.cancelWiring();
            }
        }
    }

    /**
     * 鼠标离开事件
     */
    onMouseLeave(e) {
        if (this.isDragging) {
            this.isDragging = false;
            this.dragTarget = null;
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
        } else if (e.target.classList.contains('wire')) {
            const id = e.target.dataset.id;
            this.selectWire(id);
            this.showWireContextMenu(e, id);
        } else {
            this.hideContextMenu();
        }
    }

    /**
     * 双击事件
     */
    onDoubleClick(e) {
        // 双击控制点删除它
        if (e.target.classList.contains('wire-control-point')) {
            const wireGroup = e.target.closest('.wire-group');
            if (wireGroup) {
                const wireId = wireGroup.dataset.id;
                const pointIndex = parseInt(e.target.dataset.index, 10);
                this.removeWireControlPoint(wireId, pointIndex);
                return;
            }
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
        
        // 删除相关导线的渲染
        for (const wire of this.circuit.getAllWires()) {
            if (wire.startComponentId === id || wire.endComponentId === id) {
                this.renderer.removeWire(wire.id);
            }
        }
        
        this.renderer.renderWires();
        this.clearSelection();
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
        
        // 使用统一的坐标转换，计算鼠标相对于元器件中心的偏移
        const canvasCoords = this.screenToCanvas(e.clientX, e.clientY);
        this.dragOffset = {
            x: canvasCoords.x - comp.x,
            y: canvasCoords.y - comp.y
        };
        
        this.selectComponent(id);
    }

    /**
     * 开始连线
     */
    startWiring(componentId, terminalIndex, e) {
        this.isWiring = true;
        this.wireStart = { componentId, terminalIndex };
        
        // 创建临时导线
        this.tempWire = this.renderer.createTempWire();
        
        const startPos = this.renderer.getTerminalPosition(componentId, terminalIndex);
        if (startPos) {
            // 使用统一的坐标转换
            const canvasCoords = this.screenToCanvas(e.clientX, e.clientY);
            this.renderer.updateTempWire(this.tempWire, startPos.x, startPos.y, canvasCoords.x, canvasCoords.y);
        }
    }

    /**
     * 结束连线
     */
    endWiring(componentId, terminalIndex) {
        if (!this.wireStart) return;
        
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
     * 取消连线
     */
    cancelWiring() {
        this.isWiring = false;
        this.wireStart = null;
        if (this.tempWire) {
            this.renderer.removeTempWire(this.tempWire);
            this.tempWire = null;
        }
    }

    /**
     * 端子延长拖动
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
            // 计算鼠标移动向量（屏幕坐标）
            const dx = moveE.clientX - startX;
            const dy = moveE.clientY - startY;
            
            // 将移动向量转换到元器件本地坐标系
            const cos = Math.cos(-rotation);
            const sin = Math.sin(-rotation);
            const localDx = dx * cos - dy * sin;
            const localDy = dx * sin + dy * cos;
            
            // 更新延长偏移（对齐到网格）
            comp.terminalExtensions[terminalIndex] = {
                x: Math.round((startExtX + localDx) / 20) * 20,
                y: Math.round((startExtY + localDy) / 20) * 20
            };
            
            // 重新渲染元器件
            this.renderer.refreshComponent(comp);
            this.renderer.setSelected(componentId, true);
            
            // 更新连接到该元器件的所有导线
            this.renderer.updateConnectedWires(componentId);
        };
        
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
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
     * 选择元器件
     */
    selectComponent(id) {
        this.clearSelection();
        this.selectedComponent = id;
        this.selectedWire = null;
        this.renderer.setSelected(id, true);
        
        const comp = this.circuit.getComponent(id);
        if (comp) {
            this.updatePropertyPanel(comp);
        }
    }

    /**
     * 选择导线
     */
    selectWire(id) {
        this.clearSelection();
        this.selectedWire = id;
        this.selectedComponent = null;
        this.renderer.setWireSelected(id, true);
        
        const wire = this.circuit.getWire(id);
        const controlPointCount = wire && wire.controlPoints ? wire.controlPoints.length : 0;
        
        // 显示导线信息（使用安全的 DOM 操作）
        const content = document.getElementById('property-content');
        clearElement(content);
        
        content.appendChild(createPropertyRow('类型', '导线'));
        content.appendChild(createPropertyRow('控制点', `${controlPointCount} 个`));
        content.appendChild(createHintParagraph([
            '点击蓝色圆点添加转折点',
            '拖动橙色圆点调整形状',
            '双击橙色圆点删除控制点',
            '按 Delete 键删除导线'
        ]));
    }

    /**
     * 拖动导线控制点
     */
    startControlPointDrag(wireId, pointIndex, e) {
        const wire = this.circuit.getWire(wireId);
        if (!wire || !wire.controlPoints || !wire.controlPoints[pointIndex]) return;
        
        const onMove = (moveE) => {
            // 使用统一的坐标转换
            const canvasCoords = this.screenToCanvas(moveE.clientX, moveE.clientY);
            
            // 对齐到网格
            wire.controlPoints[pointIndex] = {
                x: Math.round(canvasCoords.x / 20) * 20,
                y: Math.round(canvasCoords.y / 20) * 20
            };
            
            this.renderer.refreshWire(wireId);
        };
        
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
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
        }
        
        // 显示当前测量值
        if (this.circuit.isRunning) {
            content.appendChild(createMeasurementRows({
                current: comp.currentValue || 0,
                voltage: comp.voltageValue || 0,
                power: comp.powerValue || 0
            }));
        }
        
        content.appendChild(createHintParagraph([
            '双击或右键编辑属性',
            '按 R 旋转，按 Delete 删除',
            '<b>Alt + 拖动端子</b> 延长引脚'
        ]));
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
            }
            
            // 刷新渲染
            this.renderer.refreshComponent(comp);
            this.renderer.setSelected(comp.id, true);
            // 更新连接到该元器件的导线
            this.renderer.updateConnectedWires(comp.id);
            this.updatePropertyPanel(comp);
            
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
        
        const menuItem = document.createElement('div');
        menuItem.className = 'context-menu-item danger';
        menuItem.textContent = '删除导线 (Del)';
        menuItem.addEventListener('click', () => {
            this.deleteWire(wireId);
            this.hideContextMenu();
        });
        menu.appendChild(menuItem);
        
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
}
