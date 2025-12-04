/**
 * main.js - 应用程序入口
 * 初始化并连接所有模块
 */

import { Circuit } from './engine/Circuit.js';
import { Renderer } from './ui/Renderer.js';
import { InteractionManager } from './ui/Interaction.js';
import { resetIdCounter, updateIdCounterFromExisting } from './components/Component.js';

class CircuitSimulatorApp {
    constructor() {
        // 获取SVG画布
        this.svg = document.getElementById('circuit-canvas');
        
        // 初始化电路引擎
        this.circuit = new Circuit();
        
        // 初始化渲染器
        this.renderer = new Renderer(this.svg, this.circuit);
        
        // 初始化交互管理器
        this.interaction = new InteractionManager(this);
        
        // 设置电路更新回调
        this.circuit.onUpdate = (results) => this.onCircuitUpdate(results);
        
        // 初始化完成
        this.updateStatus('电路模拟器已就绪');
        console.log('Circuit Simulator initialized');
        
        // 暴露调试接口到全局
        window.debugCircuit = () => this.debugCircuit();
    }
    
    /**
     * 调试电路状态
     */
    debugCircuit() {
        // 启用 solver 调试模式
        this.circuit.solver.debugMode = true;
        
        console.log('=== Circuit Debug Info ===');
        console.log('Components:', this.circuit.components.size);
        console.log('Wires:', this.circuit.wires.size);
        console.log('Nodes:', this.circuit.nodes.length);
        
        console.log('\n--- Components ---');
        for (const [id, comp] of this.circuit.components) {
            console.log(`${id} (${comp.type}): nodes=[${comp.nodes}], V=${comp.voltageValue?.toFixed(3)}, I=${comp.currentValue?.toFixed(3)}, R=${comp.resistance || comp.maxResistance || 'N/A'}`);
        }
        
        console.log('\n--- Wires ---');
        for (const [id, wire] of this.circuit.wires) {
            console.log(`${id}: ${wire.startComponentId}:${wire.startTerminalIndex} -> ${wire.endComponentId}:${wire.endTerminalIndex}`);
        }
        
        console.log('\n--- Node Connections ---');
        // 分析每个节点连接了哪些端子
        const nodeConnections = {};
        for (const [id, comp] of this.circuit.components) {
            comp.nodes.forEach((node, termIdx) => {
                if (!nodeConnections[node]) nodeConnections[node] = [];
                nodeConnections[node].push(`${id}:${termIdx}`);
            });
        }
        for (const [node, terminals] of Object.entries(nodeConnections)) {
            console.log(`Node ${node}: ${terminals.join(', ')}`);
        }
        
        // 强制运行一次求解
        console.log('\n--- Running Solve ---');
        this.circuit.rebuildNodes();
        
        console.log('\n--- After rebuildNodes ---');
        console.log('Total nodes:', this.circuit.nodes.length);
        for (const [id, comp] of this.circuit.components) {
            console.log(`  ${id}: nodes = [${comp.nodes}]`);
        }
        
        this.circuit.solver.setCircuit(
            Array.from(this.circuit.components.values()),
            this.circuit.nodes
        );
        
        console.log('VoltageSourceCount:', this.circuit.solver.voltageSourceCount);
        
        const results = this.circuit.solver.solve(this.circuit.dt);
        
        console.log('\n--- Solve Results ---');
        console.log('Valid:', results.valid);
        console.log('Voltages:', results.voltages);
        if (results.currents instanceof Map) {
            console.log('Currents:', Object.fromEntries(results.currents));
        } else {
            console.log('Currents:', results.currents);
        }
        
        // 禁用调试模式
        this.circuit.solver.debugMode = false;
        
        return { circuit: this.circuit, results };
    }

    /**
     * 电路更新回调
     */
    onCircuitUpdate(results) {
        if (results.valid) {
            this.renderer.updateValues();
            
            // 更新选中元器件的属性面板
            if (this.interaction.selectedComponent) {
                const comp = this.circuit.getComponent(this.interaction.selectedComponent);
                if (comp) {
                    this.interaction.updatePropertyPanel(comp);
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
        this.updateStatus('电路已清空');
    }

    /**
     * 导出电路
     */
    exportCircuit() {
        const data = this.circuit.toJSON();
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
                
                // 更新ID计数器以防止冲突
                const allIds = [
                    ...data.components.map(c => c.id),
                    ...data.wires.map(w => w.id)
                ];
                updateIdCounterFromExisting(allIds);
                
                this.renderer.render();
                this.interaction.clearSelection();
                
                this.updateStatus(`已导入电路: ${data.meta?.name || '未命名'}`);
            } catch (err) {
                console.error('Import error:', err);
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
}

// 应用启动
document.addEventListener('DOMContentLoaded', () => {
    window.app = new CircuitSimulatorApp();
});
