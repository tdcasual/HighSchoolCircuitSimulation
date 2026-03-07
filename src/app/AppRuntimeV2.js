/**
 * main.js - 应用程序入口
 * 初始化并连接所有模块
 */

import { Circuit } from '../core/runtime/Circuit.js';
import { Renderer } from '../ui/Renderer.js';
import { InteractionManager } from '../ui/Interaction.js';
import { loadAIPanelClass } from '../ui/ai/loadAIPanel.js';
import { ChartWorkspaceController } from '../ui/charts/ChartWorkspaceController.js';
import { ExerciseBoard } from '../ui/ExerciseBoard.js';
import { ResponsiveLayoutController } from '../ui/ResponsiveLayoutController.js';
import { ClassroomModeController } from '../ui/ClassroomModeController.js';
import { ToolboxCategoryController } from '../ui/ToolboxCategoryController.js';
import { TopActionMenuController } from '../ui/TopActionMenuController.js';
import { MobileRestoreBroker } from '../ui/mobile/MobileRestoreBroker.js';
import { MobileRestoreEntryController } from '../ui/mobile/MobileRestoreEntryController.js';
import { FirstRunGuideController } from '../ui/FirstRunGuideController.js';
import { EmbedRuntimeBridge, parseEmbedRuntimeOptionsFromSearch } from '../embed/EmbedRuntimeBridge.js';
import { RuntimeActionRouter } from '../app/RuntimeActionRouter.js';
import { RuntimeUiBridge } from '../app/RuntimeUiBridge.js';
import { createRuntimeLogger } from '../utils/Logger.js';
import { RuntimeStorageEntries } from '../app/RuntimeStorageRegistry.js';
import { buildAppSaveData } from '../app/AppSerialization.js';
import { safeGetStorageItem, safeSetStorageItem } from '../app/AppStorage.js';

export class AppRuntimeV2 {
    constructor() {
        this.runtimeOptions = parseEmbedRuntimeOptionsFromSearch(
            typeof window !== 'undefined' ? window.location.search : ''
        );

        // 获取SVG画布
        this.svg = document.getElementById('circuit-canvas');
        this.logger = createRuntimeLogger({ scope: 'app' });
        
        // 初始化电路引擎
        this.circuit = new Circuit();
        this.circuit.setLogger?.(this.logger.child('circuit'));
        
        // 初始化渲染器
        this.renderer = new Renderer(this.svg, this.circuit);
        
        // 初始化交互管理器
        this.interaction = new InteractionManager(this);

        // 初始化图表工作区（画布悬浮窗）
        this.chartWorkspace = new ChartWorkspaceController(this);
        
        // AI 助手改为延迟加载：首屏不初始化重型面板。
        this.aiPanel = null;
        this.aiPanelLoadingPromise = null;
        this.aiPanelClassLoader = loadAIPanelClass;
        this.aiLazyTriggerElements = [];
        this.boundLazyAIOpen = null;
        this.bindLazyAIPanelTriggers();

        // 初始化习题板
        this.exerciseBoard = new ExerciseBoard(this);

        // 初始化响应式布局控制
        this.responsiveLayout = new ResponsiveLayoutController(this);

        // 初始化手机端顶部更多菜单
        this.topActionMenu = new TopActionMenuController(this);

        // 初始化手机端统一恢复入口
        this.mobileRestoreBroker = new MobileRestoreBroker();
        this.mobileRestoreEntry = new MobileRestoreEntryController(this, this.mobileRestoreBroker);

        // 初始化工具箱分类折叠控制
        this.toolboxCategoryController = new ToolboxCategoryController(this);

        // 初始化课堂模式控制（大屏演示可读性增强）
        this.classroomMode = new ClassroomModeController(this);

        // 初始化首开引导（嵌入模式默认关闭）
        this.firstRunGuide = new FirstRunGuideController(this, {
            enabled: !this.runtimeOptions.enabled
        });

        this.runtimeUiBridge = new RuntimeUiBridge(this);
        this.actionRouter = new RuntimeActionRouter(this, {
            uiBridge: this.runtimeUiBridge
        });
        
        // 尝试从 localStorage 恢复电路
        if (this.runtimeOptions.restoreFromStorage) {
            this.loadCircuitFromStorage();
        }
        
        // 设置电路更新回调（包括自动保存）
        this.setupAutoSave({
            enabled: this.runtimeOptions.autoSave
        });

        // 嵌入模式桥接（类似 deployggb.js 的 iframe API）
        this.embedBridge = null;
        if (this.runtimeOptions.enabled) {
            this.embedBridge = new EmbedRuntimeBridge(this, this.runtimeOptions);
        }
        
        // 初始化完成
        this.updateStatus('电路模拟器已就绪');
        this.logger.info('Circuit Simulator initialized');
        
        // 暴露调试接口到全局
        window.debugCircuit = () => this.debugCircuit();
    }
    
    /**
     * 调试电路状态
     */
    debugCircuit() {
        const logger = this.logger.child('debugCircuit');
        // 启用 solver 调试模式
        this.circuit.solver.debugMode = true;
        
        logger.info('=== Circuit Debug Info ===');
        logger.info('Components:', this.circuit.components.size);
        logger.info('Wires:', this.circuit.wires.size);
        logger.info('Nodes:', this.circuit.nodes.length);
        
        logger.info('\n--- Components ---');
        for (const [id, comp] of this.circuit.components) {
            logger.info(`${id} (${comp.type}): nodes=[${comp.nodes}], V=${comp.voltageValue?.toFixed(3)}, I=${comp.currentValue?.toFixed(3)}, R=${comp.resistance || comp.maxResistance || 'N/A'}`);
        }
        
        logger.info('\n--- Wires ---');
        for (const [id, wire] of this.circuit.wires) {
            const fmtEnd = (which) => {
                const ref = which === 'a' ? wire.aRef : wire.bRef;
                if (ref && ref.componentId !== undefined && ref.componentId !== null) {
                    return `${ref.componentId}:${ref.terminalIndex}`;
                }
                const pt = which === 'a' ? wire.a : wire.b;
                if (pt && Number.isFinite(Number(pt.x)) && Number.isFinite(Number(pt.y))) {
                    return `(${Math.round(Number(pt.x))},${Math.round(Number(pt.y))})`;
                }
                return '?';
            };
            logger.info(`${id}: ${fmtEnd('a')} -> ${fmtEnd('b')}`);
        }
        
        logger.info('\n--- Node Connections ---');
        // 分析每个节点连接了哪些端子
        const nodeConnections = {};
        for (const [id, comp] of this.circuit.components) {
            comp.nodes.forEach((node, termIdx) => {
                if (!nodeConnections[node]) nodeConnections[node] = [];
                nodeConnections[node].push(`${id}:${termIdx}`);
            });
        }
        for (const [node, terminals] of Object.entries(nodeConnections)) {
            logger.info(`Node ${node}: ${terminals.join(', ')}`);
        }
        
        // 强制运行一次求解
        logger.info('\n--- Running Solve ---');
        this.circuit.rebuildNodes();
        
        logger.info('\n--- After rebuildNodes ---');
        logger.info('Total nodes:', this.circuit.nodes.length);
        for (const [id, comp] of this.circuit.components) {
            logger.info(`  ${id}: nodes = [${comp.nodes}]`);
        }
        
        this.circuit.solver.setCircuit(
            Array.from(this.circuit.components.values()),
            this.circuit.nodes
        );
        
        logger.info('VoltageSourceCount:', this.circuit.solver.voltageSourceCount);
        
        const results = this.circuit.solver.solve(this.circuit.dt);
        
        logger.info('\n--- Solve Results ---');
        logger.info('Valid:', results.valid);
        logger.info('Voltages:', results.voltages);
        if (results.currents instanceof Map) {
            logger.info('Currents:', Object.fromEntries(results.currents));
        } else {
            logger.info('Currents:', results.currents);
        }
        
        // 禁用调试模式
        this.circuit.solver.debugMode = false;
        
        return { circuit: this.circuit, results };
    }

    /**
     * 电路更新回调
     */
    onCircuitUpdate(results) {
        const runtimeUiBridge = this.runtimeUiBridge || new RuntimeUiBridge(this);
        return runtimeUiBridge.onCircuitUpdate(results);
    }

    /**
     * 开始模拟
     */
    startSimulation() {
        const runtimeUiBridge = this.runtimeUiBridge || new RuntimeUiBridge(this);
        const actionRouter = this.actionRouter || new RuntimeActionRouter(this, { uiBridge: runtimeUiBridge });
        return actionRouter.startSimulation();
    }

    /**
     * 停止模拟
     */
    stopSimulation() {
        const runtimeUiBridge = this.runtimeUiBridge || new RuntimeUiBridge(this);
        const actionRouter = this.actionRouter || new RuntimeActionRouter(this, { uiBridge: runtimeUiBridge });
        return actionRouter.stopSimulation();
    }

    /**
     * 清空电路
     */
    clearCircuit() {
        const runtimeUiBridge = this.runtimeUiBridge || new RuntimeUiBridge(this);
        const actionRouter = this.actionRouter || new RuntimeActionRouter(this, { uiBridge: runtimeUiBridge });
        return actionRouter.clearCircuit();
    }

    /**
     * 程序化加载电路 JSON（供导入流程与嵌入 API 共用）
     */
    loadCircuitData(data, options = {}) {
        const runtimeUiBridge = this.runtimeUiBridge || new RuntimeUiBridge(this);
        const actionRouter = this.actionRouter || new RuntimeActionRouter(this, { uiBridge: runtimeUiBridge });
        return actionRouter.loadCircuitData(data, options);
    }

    /**
     * 导出电路
     */
    exportCircuit() {
        const runtimeUiBridge = this.runtimeUiBridge || new RuntimeUiBridge(this);
        const actionRouter = this.actionRouter || new RuntimeActionRouter(this, { uiBridge: runtimeUiBridge });
        return actionRouter.exportCircuit();
    }

    /**
     * 导入电路
     */
    importCircuit(file) {
        const runtimeUiBridge = this.runtimeUiBridge || new RuntimeUiBridge(this);
        const actionRouter = this.actionRouter || new RuntimeActionRouter(this, { uiBridge: runtimeUiBridge });
        return actionRouter.importCircuit(file);
    }

    /**
     * 更新状态栏
     */
    updateStatus(text) {
        const runtimeUiBridge = this.runtimeUiBridge || new RuntimeUiBridge(this);
        return runtimeUiBridge.updateStatus(text);
    }
    
    /**
     * 设置自动保存
     */
    setupAutoSave(options = {}) {
        const {
            enabled = true
        } = options;
        const saveCircuit = () => {
            if (!enabled) return;
            try {
                const saved = this.saveCircuitToStorage();
                if (!saved) {
                    throw new Error('autosave_storage_unavailable');
                }
            } catch (e) {
                this.logger.error('Auto-save failed:', e);
            }
        };

        // 防抖，避免频繁保存（模拟运行时也不会疯狂写 localStorage）
        let saveTimeout = null;
        this.scheduleSave = (delayMs = 1000) => {
            if (!enabled) return;
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(saveCircuit, delayMs);
        };

        this.circuit.onUpdate = (results) => {
            this.onCircuitUpdate(results);
            this.scheduleSave(1000);
        };
    }

    /**
     * 统一构建“可保存/可导出”的电路 JSON（包含习题板等 UI 元信息）
     */
    buildSaveData() {
        return buildAppSaveData({
            circuit: this.circuit,
            exerciseBoard: this.exerciseBoard,
            chartWorkspace: this.chartWorkspace
        });
    }

    saveCircuitToStorage(circuitJSON = null) {
        const payload = circuitJSON ?? this.buildSaveData();
        return safeSetStorageItem(
            RuntimeStorageEntries.circuitAutosave,
            JSON.stringify(payload)
        );
    }
    
    /**
     * 从 localStorage 加载电路
     */
    loadCircuitFromStorage(options = {}) {
        try {
            const saved = safeGetStorageItem(RuntimeStorageEntries.circuitAutosave);
            if (!saved) return false;

            const circuitJSON = JSON.parse(saved);
            const statusText = typeof options.statusText === 'string' && options.statusText
                ? options.statusText
                : `已从缓存恢复电路 (${circuitJSON.components.length} 个元器件)`;
            this.loadCircuitData(circuitJSON, { statusText });
            return true;
        } catch (e) {
            this.logger.error('Failed to load saved circuit:', e);
            return false;
        }
    }

    bindLazyAIPanelTriggers() {
        if (typeof document === 'undefined') return;
        const triggerIds = ['ai-fab-btn', 'ai-toggle-btn'];
        this.boundLazyAIOpen = (event) => {
            if (this.aiPanel) return;
            event?.preventDefault?.();
            event?.stopPropagation?.();
            void this.openAIPanel();
        };

        this.aiLazyTriggerElements = [];
        for (const id of triggerIds) {
            const element = document.getElementById(id);
            if (!element || typeof element.addEventListener !== 'function') continue;
            element.addEventListener('click', this.boundLazyAIOpen);
            this.aiLazyTriggerElements.push(element);
        }
    }

    detachLazyAIPanelTriggers() {
        if (!Array.isArray(this.aiLazyTriggerElements) || !this.boundLazyAIOpen) return;
        for (const element of this.aiLazyTriggerElements) {
            if (!element || typeof element.removeEventListener !== 'function') continue;
            element.removeEventListener('click', this.boundLazyAIOpen);
        }
        this.aiLazyTriggerElements = [];
    }

    async ensureAIPanelLoaded() {
        if (this.aiPanel) return this.aiPanel;
        if (this.aiPanelLoadingPromise) return this.aiPanelLoadingPromise;

        this.aiPanelLoadingPromise = (async () => {
            const AIPanelClass = await this.aiPanelClassLoader();
            this.aiPanel = new AIPanelClass(this);
            this.detachLazyAIPanelTriggers();
            return this.aiPanel;
        })();

        try {
            return await this.aiPanelLoadingPromise;
        } finally {
            this.aiPanelLoadingPromise = null;
        }
    }

    async openAIPanel() {
        const panel = await this.ensureAIPanelLoaded();
        panel?.setPanelCollapsed?.(false);
        panel?.markPanelActive?.();
        return panel;
    }

    markMobilePrimaryTask(taskId = 'build') {
        this.mobilePrimaryTask = taskId === 'observe' ? 'observe' : 'build';
        return this.mobilePrimaryTask;
    }

    getMobileRestoreLabel() {
        if (this.mobilePrimaryTask === 'observe') {
            return '回到观察';
        }
        return '返回编辑';
    }

    runMobileRestoreAction(action = {}) {
        switch (action?.type) {
        case 'show-guide':
            return this.firstRunGuide?.show?.() || false;
        case 'open-ai':
            return this.openAIPanel();
        case 'open-toolbox':
            return this.responsiveLayout?.openDrawer?.('toolbox') || false;
        case 'open-side-panel-tab':
            this.responsiveLayout?.openDrawer?.('side-panel');
            this.interaction?.activateSidePanelTab?.(action?.panel || 'properties');
            return true;
        case 'focus-canvas':
            this.aiPanel?.setPanelCollapsed?.(true);
            return this.responsiveLayout?.focusCanvas?.() || false;
        default:
            this.aiPanel?.setPanelCollapsed?.(true);
            return this.responsiveLayout?.focusCanvas?.() || false;
        }
    }

    setClassroomModeLevel(level, options = {}) {
        if (!this.classroomMode || typeof this.classroomMode.setPreferredLevel !== 'function') {
            return null;
        }
        return this.classroomMode.setPreferredLevel(level, options);
    }
}

