/**
 * main.js - 应用程序入口
 * 初始化并连接所有模块
 */

import { Circuit } from '../core/runtime/Circuit.js';
import { Renderer } from '../ui/Renderer.js';
import { InteractionManager } from '../ui/Interaction.js';
import { loadAIPanelClass } from '../ui/ai/loadAIPanel.js';
import { ResponsiveLayoutController } from '../ui/ResponsiveLayoutController.js';
import { MobileRestoreBroker } from '../ui/mobile/MobileRestoreBroker.js';
import { MobileRestoreEntryController } from '../ui/mobile/MobileRestoreEntryController.js';
import { parseEmbedRuntimeOptionsFromSearch } from '../embed/EmbedRuntimeOptions.js';
import {
    createDeferredChartWorkspaceFacade,
    createDeferredClassroomModeFacade,
    createDeferredExerciseBoardFacade,
    createDeferredFirstRunGuideFacade,
    createDeferredToolboxCategoryFacade,
    createDeferredTopActionMenuFacade,
    loadEmbedRuntimeBridgeClass,
    scheduleDeferredUiHydration as scheduleDeferredUiHydrationInternal
} from './DeferredRuntimeFeatures.js';
import { RuntimeActionRouter } from '../app/RuntimeActionRouter.js';
import { RuntimeUiBridge } from '../app/RuntimeUiBridge.js';
import { createRuntimeLogger } from '../utils/Logger.js';
import { RuntimeStorageEntries } from '../utils/storage/StorageRegistry.js';
import { buildAppSaveData } from '../app/AppSerialization.js';
import { safeGetStorageItem, safeSetStorageItem } from '../utils/storage/SafeStorage.js';
import { InteractionModeStore } from './interaction/InteractionModeStore.js';
import {
    bindLazyAIPanelTriggers as bindLazyAIPanelTriggersDelegate,
    debugRuntimeCircuit,
    detachLazyAIPanelTriggers as detachLazyAIPanelTriggersDelegate,
    ensureAIPanelLoaded as ensureAIPanelLoadedDelegate,
    openAIPanel as openAIPanelDelegate
} from './AppRuntimeV2Delegates.js';

export class AppRuntimeV2 {
    constructor() {
        this.runtimeOptions = parseEmbedRuntimeOptionsFromSearch(
            typeof window !== 'undefined' ? window.location.search : ''
        );

        // 获取SVG画布
        this.runtimeVersion = 2;
        this.svg = document.getElementById('circuit-canvas');
        this.logger = createRuntimeLogger({ scope: 'app' });
        this.interactionModeStore = new InteractionModeStore();
        this.interactionModeSnapshot = this.interactionModeStore.getState();
        this.circuitStorageOwnership = {
            source: 'boot',
            sequence: 0
        };
        
        // 初始化电路引擎
        this.circuit = new Circuit();
        this.circuit.setLogger?.(this.logger.child('circuit'));
        
        // 初始化渲染器
        this.renderer = new Renderer(this.svg, this.circuit);
        
        // 初始化交互管理器
        this.interaction = new InteractionManager(this);

        // 初始化延迟水合的重型 UI 子系统
        this.chartWorkspace = createDeferredChartWorkspaceFacade(this);

        // AI 助手改为延迟加载：首屏不初始化重型面板。
        this.aiPanel = null;
        this.aiPanelLoadingPromise = null;
        this.aiPanelClassLoader = loadAIPanelClass;
        this.aiLazyTriggerElements = [];
        this.boundLazyAIOpen = null;
        this.bindLazyAIPanelTriggers();

        // 初始化习题板（延迟水合）
        this.exerciseBoard = createDeferredExerciseBoardFacade(this);

        // 初始化响应式布局控制
        this.responsiveLayout = new ResponsiveLayoutController(this);

        // 初始化手机端顶部更多菜单（延迟水合）
        this.topActionMenu = createDeferredTopActionMenuFacade(this);

        // 初始化手机端统一恢复入口
        this.mobileRestoreBroker = new MobileRestoreBroker();
        this.mobileRestoreEntry = new MobileRestoreEntryController(this, this.mobileRestoreBroker);

        // 初始化工具箱分类折叠控制（延迟水合）
        this.toolboxCategoryController = createDeferredToolboxCategoryFacade(this);

        // 初始化课堂模式控制（延迟水合）
        this.classroomMode = createDeferredClassroomModeFacade(this);

        // 初始化首开引导（延迟水合）
        this.firstRunGuide = createDeferredFirstRunGuideFacade(this, {
            enabled: !this.runtimeOptions.enabled
        });
        this.scheduleDeferredUiHydration();

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
            void this.initializeEmbedRuntimeBridge();
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
        return debugRuntimeCircuit(this);
    }

    /**
     * 电路更新回调
     */
    onCircuitUpdate(results) {
        const runtimeUiBridge = this.runtimeUiBridge || new RuntimeUiBridge(this);
        return runtimeUiBridge.onCircuitUpdate(results);
    }

    getRuntimeCapabilityFlags() {
        const runtimeOptions = this.runtimeOptions || {};
        const embedEnabled = !!runtimeOptions.enabled;
        const readOnly = embedEnabled && (runtimeOptions.mode === 'readonly' || runtimeOptions.readOnly === true);
        const classroomEmbedMode = embedEnabled && runtimeOptions.mode === 'classroom';
        return {
            embedEnabled,
            readOnly,
            classroomEmbedMode,
            allowsCircuitMutation: !readOnly,
            allowsStorageMutation: !readOnly,
            allowsClassroomLevelControl: !embedEnabled || classroomEmbedMode
        };
    }

    reportRuntimeCapabilityBlock(message = '当前模式不允许修改电路') {
        const runtimeUiBridge = this.runtimeUiBridge || new RuntimeUiBridge(this);
        runtimeUiBridge.updateStatus(message);
        return false;
    }

    /**
     * 开始模拟
     */
    startSimulation() {
        const runtimeCapabilities = AppRuntimeV2.prototype.getRuntimeCapabilityFlags.call(this);
        if (!runtimeCapabilities.allowsCircuitMutation) {
            return AppRuntimeV2.prototype.reportRuntimeCapabilityBlock.call(this, '当前模式不允许修改电路');
        }
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
        const runtimeCapabilities = AppRuntimeV2.prototype.getRuntimeCapabilityFlags.call(this);
        if (!runtimeCapabilities.allowsCircuitMutation) {
            return AppRuntimeV2.prototype.reportRuntimeCapabilityBlock.call(this, '当前模式不允许修改电路');
        }
        const runtimeUiBridge = this.runtimeUiBridge || new RuntimeUiBridge(this);
        const actionRouter = this.actionRouter || new RuntimeActionRouter(this, { uiBridge: runtimeUiBridge });
        return actionRouter.clearCircuit();
    }

    /**
     * 程序化加载电路 JSON（供导入流程与嵌入 API 共用）
     */
    loadCircuitData(data, options = {}) {
        const runtimeCapabilities = AppRuntimeV2.prototype.getRuntimeCapabilityFlags.call(this);
        if (!runtimeCapabilities.allowsCircuitMutation) {
            return AppRuntimeV2.prototype.reportRuntimeCapabilityBlock.call(this, '当前模式不允许修改电路');
        }
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
        const runtimeCapabilities = AppRuntimeV2.prototype.getRuntimeCapabilityFlags.call(this);
        if (!runtimeCapabilities.allowsCircuitMutation) {
            return AppRuntimeV2.prototype.reportRuntimeCapabilityBlock.call(this, '当前模式不允许修改电路');
        }
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
        const saveCircuit = (saveOptions = {}) => {
            if (!enabled) return;
            try {
                const saved = this.saveCircuitToStorage(null, saveOptions);
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
            const expectedSequence = Number.isFinite(this.circuitStorageOwnership?.sequence)
                ? this.circuitStorageOwnership.sequence
                : 0;
            saveTimeout = setTimeout(() => {
                saveCircuit({
                    source: 'autosave',
                    expectedSequence
                });
            }, delayMs);
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

    getRuntimeReadSnapshot() {
        const circuitSnapshot = typeof this.circuit?.getRuntimeReadSnapshot === 'function'
            ? this.circuit.getRuntimeReadSnapshot()
            : {};
        return {
            ...circuitSnapshot,
            saveData: this.buildSaveData()
        };
    }

    beginCircuitStorageOwnership(source = 'runtime-load') {
        const currentSequence = Number.isFinite(this.circuitStorageOwnership?.sequence)
            ? this.circuitStorageOwnership.sequence
            : 0;
        this.circuitStorageOwnership = {
            source: typeof source === 'string' && source ? source : 'runtime-load',
            sequence: currentSequence + 1
        };
        return this.circuitStorageOwnership;
    }

    saveCircuitToStorage(circuitJSON = null, options = {}) {
        const runtimeCapabilities = AppRuntimeV2.prototype.getRuntimeCapabilityFlags.call(this);
        if (!runtimeCapabilities.allowsStorageMutation) {
            return AppRuntimeV2.prototype.reportRuntimeCapabilityBlock.call(this, '当前模式不允许修改电路');
        }
        const payload = circuitJSON ?? this.buildSaveData();
        const currentOwnership = this.circuitStorageOwnership || { source: 'manual-save', sequence: 0 };
        const expectedSequence = Number.isFinite(options.expectedSequence)
            ? options.expectedSequence
            : currentOwnership.sequence;
        if (
            Number.isFinite(options.expectedSequence)
            && Number.isFinite(currentOwnership.sequence)
            && options.expectedSequence !== currentOwnership.sequence
        ) {
            return false;
        }
        const storageOptions = options.storage ? { storage: options.storage } : {};
        const payloadSaved = safeSetStorageItem(
            RuntimeStorageEntries.circuitAutosave,
            JSON.stringify(payload),
            storageOptions
        );
        if (!payloadSaved) return false;
        return safeSetStorageItem(
            RuntimeStorageEntries.circuitAutosaveMeta,
            JSON.stringify({
                owner: RuntimeStorageEntries.circuitAutosave.owner,
                source: typeof options.source === 'string' && options.source ? options.source : currentOwnership.source,
                sequence: expectedSequence
            }),
            storageOptions
        );
    }
    
    /**
     * 从 localStorage 加载电路
     */
    loadCircuitFromStorage(options = {}) {
        try {
            const storageOptions = options.storage ? { storage: options.storage } : {};
            const saved = safeGetStorageItem(RuntimeStorageEntries.circuitAutosave, storageOptions);
            if (!saved) return false;

            const circuitJSON = JSON.parse(saved);
            const statusText = typeof options.statusText === 'string' && options.statusText
                ? options.statusText
                : `已从缓存恢复电路 (${circuitJSON.components.length} 个元器件)`;
            this.loadCircuitData(circuitJSON, {
                statusText,
                storageSource: options.storageSource || 'storage-restore'
            });
            return true;
        } catch (e) {
            this.logger.error('Failed to load saved circuit:', e);
            return false;
        }
    }

    scheduleDeferredUiHydration() {
        return scheduleDeferredUiHydrationInternal(this);
    }

    async initializeEmbedRuntimeBridge() {
        try {
            const EmbedRuntimeBridge = await loadEmbedRuntimeBridgeClass();
            this.embedBridge = new EmbedRuntimeBridge(this, this.runtimeOptions);
            return this.embedBridge;
        } catch (error) {
            this.logger?.error?.('Failed to initialize embed runtime bridge:', error);
            return null;
        }
    }
bindLazyAIPanelTriggers() {
        return bindLazyAIPanelTriggersDelegate(this);
    }
detachLazyAIPanelTriggers() {
        return detachLazyAIPanelTriggersDelegate(this);
    }
async ensureAIPanelLoaded() {
        return ensureAIPanelLoadedDelegate(this);
    }
async openAIPanel() {
        return openAIPanelDelegate(this);
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
        const runtimeCapabilities = AppRuntimeV2.prototype.getRuntimeCapabilityFlags.call(this);
        if (!runtimeCapabilities.allowsClassroomLevelControl) {
            AppRuntimeV2.prototype.reportRuntimeCapabilityBlock.call(this, '当前嵌入模式不允许切换课堂模式');
            return {
                preferredLevel: 'off',
                activeLevel: this.classroomMode?.activeLevel || 'off',
                supported: false
            };
        }
        if (!this.classroomMode || typeof this.classroomMode.setPreferredLevel !== 'function') {
            return null;
        }
        return this.classroomMode.setPreferredLevel(level, options);
    }
}

