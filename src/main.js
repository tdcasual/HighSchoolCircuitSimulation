/**
 * main.js - 应用程序入口
 * 初始化并连接所有模块
 */

import { Circuit } from './engine/Circuit.js';
import { Renderer } from './ui/Renderer.js';
import { InteractionManager } from './ui/Interaction.js';
import { AIPanel } from './ui/AIPanel.js';
import { ObservationPanel } from './ui/ObservationPanel.js';
import { ExerciseBoard } from './ui/ExerciseBoard.js';
import { resetIdCounter, updateIdCounterFromExisting } from './components/Component.js';
import { createRuntimeLogger } from './utils/Logger.js';

class CircuitSimulatorApp {
    constructor() {
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

        // 初始化观察面板
        this.observationPanel = new ObservationPanel(this);
        
        // 初始化 AI 助手面板
        this.aiPanel = new AIPanel(this);

        // 初始化习题板
        this.exerciseBoard = new ExerciseBoard(this);
        
        // 尝试从 localStorage 恢复电路
        this.loadCircuitFromStorage();
        
        // 设置电路更新回调（包括自动保存）
        this.setupAutoSave();
        
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
        // Always refresh value labels so the UI never stays blank.
        this.renderer.updateValues();

        // Update wire animations; short-circuit warnings can show even when solve is invalid.
        this.renderer.updateWireAnimations(this.circuit.isRunning, results);

        // 更新观察面板（采样、绘制与无效解提示）
        this.observationPanel?.onCircuitUpdate(results);

        if (results.valid) {
            // 更新选中元器件的属性面板
            if (this.interaction.selectedComponent) {
                const comp = this.circuit.getComponent(this.interaction.selectedComponent);
                if (comp) {
                    this.interaction.updateSelectedComponentReadouts(comp);
                }
            }
        }
    }

    /**
     * 开始模拟
     */
    startSimulation() {
        // 检查电路是否有效
        if (this.circuit.components.size === 0) {
            this.updateStatus('请先添加元器件');
            return;
        }

        // 检查是否有电源
        let hasPower = false;
        for (const comp of this.circuit.components.values()) {
            if (comp.type === 'PowerSource') {
                hasPower = true;
                break;
            }
        }
        
        if (!hasPower) {
            this.updateStatus('电路中需要至少一个电源');
            return;
        }

        this.circuit.startSimulation();
        
        // 更新UI状态
        document.getElementById('btn-run').disabled = true;
        document.getElementById('btn-stop').disabled = false;
        
        const statusEl = document.getElementById('simulation-status');
        statusEl.textContent = '模拟: 运行中';
        statusEl.classList.add('running');
        
        this.renderer.updateWireAnimations(true);
        this.updateStatus('模拟运行中');
    }

    /**
     * 停止模拟
     */
    stopSimulation() {
        this.circuit.stopSimulation();
        
        // 更新UI状态
        document.getElementById('btn-run').disabled = false;
        document.getElementById('btn-stop').disabled = true;
        
        const statusEl = document.getElementById('simulation-status');
        statusEl.textContent = '模拟: 停止';
        statusEl.classList.remove('running');
        
        this.renderer.updateWireAnimations(false);
        this.observationPanel?.setRuntimeStatus?.('');
        this.updateStatus('模拟已停止');
    }

    /**
     * 清空电路
     */
    clearCircuit() {
        this.stopSimulation();
        this.circuit.clear();
        this.renderer.clear();
        resetIdCounter();
        this.interaction.clearSelection();
        this.observationPanel?.clearAllPlots();
        this.observationPanel?.refreshDialGauges();
        this.exerciseBoard?.reset();
            
        // 清除缓存
        localStorage.removeItem('saved_circuit');
        
        this.updateStatus('电路已清空');
    }

    /**
     * 导出电路
     */
    exportCircuit() {
        const data = this.buildSaveData();
        const json = JSON.stringify(data, null, 2);
        
        // 创建下载链接
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `circuit_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.updateStatus('电路已导出');
    }

    /**
     * 导入电路
     */
    importCircuit(file) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                // 验证格式
                if (!data.components || !data.wires) {
                    throw new Error('无效的电路文件格式');
                }
                
                this.stopSimulation();
                this.circuit.fromJSON(data);
                this.exerciseBoard?.fromJSON(data.meta?.exerciseBoard);
                
                // 更新ID计数器以防止冲突
                const allIds = [
                    ...data.components.map(c => c.id),
                    ...data.wires.map(w => w.id)
                ];
                updateIdCounterFromExisting(allIds);
                
                this.renderer.render();
                this.interaction.clearSelection();
                this.observationPanel?.refreshComponentOptions();
                this.observationPanel?.refreshDialGauges();
                this.observationPanel?.fromJSON(data.meta?.observation);
                
                this.updateStatus(`已导入电路: ${data.meta?.name || '未命名'}`);
            } catch (err) {
                this.logger.error('Import error:', err);
                this.updateStatus('导入失败: ' + err.message);
                alert('导入失败: ' + err.message);
            }
        };
        
        reader.readAsText(file);
    }

    /**
     * 更新状态栏
     */
    updateStatus(text) {
        document.getElementById('status-text').textContent = text;
    }
    
    /**
     * 设置自动保存
     */
    setupAutoSave() {
        const saveCircuit = () => {
            try {
                const payload = this.buildSaveData();
                localStorage.setItem('saved_circuit', JSON.stringify(payload));
            } catch (e) {
                this.logger.error('Auto-save failed:', e);
            }
        };

        // 防抖，避免频繁保存（模拟运行时也不会疯狂写 localStorage）
        let saveTimeout = null;
        this.scheduleSave = (delayMs = 1000) => {
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
        const data = this.circuit.toJSON();
        data.meta = data.meta && typeof data.meta === 'object' ? data.meta : {};
        if (this.exerciseBoard?.toJSON) {
            data.meta.exerciseBoard = this.exerciseBoard.toJSON();
        }
        if (this.observationPanel?.toJSON) {
            data.meta.observation = this.observationPanel.toJSON();
        }
        return data;
    }
    
    /**
     * 从 localStorage 加载电路
     */
    loadCircuitFromStorage() {
        try {
            const saved = localStorage.getItem('saved_circuit');
            if (saved) {
                const circuitJSON = JSON.parse(saved);
                this.circuit.fromJSON(circuitJSON);
                this.exerciseBoard?.fromJSON(circuitJSON.meta?.exerciseBoard);
                
                // 更新 ID 计数器
                const allIds = [
                    ...circuitJSON.components.map(c => c.id),
                    ...circuitJSON.wires.map(w => w.id)
                ];
                updateIdCounterFromExisting(allIds);
                
                this.renderer.render();
                this.observationPanel?.refreshComponentOptions();
                this.observationPanel?.refreshDialGauges();
                this.observationPanel?.fromJSON(circuitJSON.meta?.observation);
                this.updateStatus(`已从缓存恢复电路 (${circuitJSON.components.length} 个元器件)`);
            }
        } catch (e) {
            this.logger.error('Failed to load saved circuit:', e);
        }
    }
}

// 应用启动
document.addEventListener('DOMContentLoaded', () => {
    window.app = new CircuitSimulatorApp();
});
