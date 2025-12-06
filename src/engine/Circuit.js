/**
 * Circuit.js - 电路管理器
 * 管理电路中的节点、元器件和连接
 */

import { MNASolver } from './Solver.js';
import { createComponent } from '../components/Component.js';

export class Circuit {
    constructor() {
        this.components = new Map();  // id -> component
        this.wires = new Map();       // id -> wire
        this.nodes = [];              // 电气节点列表
        this.solver = new MNASolver();
        this.isRunning = false;
        this.lastResults = null;
        this.simulationInterval = null;
        this.dt = 0.01;               // 10ms 时间步长
    }

    /**
     * 添加元器件
     * @param {Object} component - 元器件对象
     */
    addComponent(component) {
        this.components.set(component.id, component);
        this.rebuildNodes();
    }

    /**
     * 删除元器件
     * @param {string} id - 元器件ID
     */
    removeComponent(id) {
        this.components.delete(id);
        // 删除与该元器件相关的所有导线
        for (const [wireId, wire] of this.wires) {
            if (wire.startComponentId === id || wire.endComponentId === id) {
                this.wires.delete(wireId);
            }
        }
        this.rebuildNodes();
    }

    /**
     * 添加导线连接
     * @param {Object} wire - 导线对象
     */
    addWire(wire) {
        this.wires.set(wire.id, wire);
        this.rebuildNodes();
    }

    /**
     * 删除导线
     * @param {string} id - 导线ID
     */
    removeWire(id) {
        this.wires.delete(id);
        this.rebuildNodes();
    }

    /**
     * 获取导线
     * @param {string} id - 导线ID
     * @returns {Object} 导线对象
     */
    getWire(id) {
        return this.wires.get(id);
    }

    /**
     * 重建电气节点
     * 使用并查集算法合并连接的端点
     */
    rebuildNodes() {
        // 收集所有端点
        const terminals = [];
        for (const [id, comp] of this.components) {
            terminals.push({ componentId: id, terminalIndex: 0 });
            terminals.push({ componentId: id, terminalIndex: 1 });
            // 滑动变阻器有第三个端子（滑动触点）
            if (comp.type === 'Rheostat') {
                terminals.push({ componentId: id, terminalIndex: 2 });
            }
        }

        // 并查集
        const parent = new Map();
        
        const getTerminalKey = (t) => `${t.componentId}:${t.terminalIndex}`;
        
        const find = (key) => {
            if (!parent.has(key)) parent.set(key, key);
            if (parent.get(key) !== key) {
                parent.set(key, find(parent.get(key)));
            }
            return parent.get(key);
        };
        
        const union = (key1, key2) => {
            const root1 = find(key1);
            const root2 = find(key2);
            if (root1 !== root2) {
                parent.set(root1, root2);
            }
        };

        // 初始化并查集
        for (const t of terminals) {
            const key = getTerminalKey(t);
            parent.set(key, key);
        }

        // 根据导线合并节点
        for (const [wireId, wire] of this.wires) {
            const key1 = `${wire.startComponentId}:${wire.startTerminalIndex}`;
            const key2 = `${wire.endComponentId}:${wire.endTerminalIndex}`;
            
            // 检查导线端点是否有效
            if (!parent.has(key1)) {
                console.warn(`Wire ${wireId}: start terminal ${key1} not found in components`);
                continue;
            }
            if (!parent.has(key2)) {
                console.warn(`Wire ${wireId}: end terminal ${key2} not found in components`);
                continue;
            }
            
            union(key1, key2);
        }

        // 生成节点映射
        // 重要：电源的负极应该是节点0（参考地）
        const nodeMap = new Map(); // root -> nodeIndex
        let nodeIndex = 0;
        
        // 首先，找到电源的负极端点，确保它是节点0
        for (const [id, comp] of this.components) {
            if (comp.type === 'PowerSource') {
                // 端点1是负极
                const negativeKey = `${id}:1`;
                const root = find(negativeKey);
                if (!nodeMap.has(root)) {
                    nodeMap.set(root, nodeIndex++);
                }
                break; // 只需要找到一个电源
            }
        }
        
        // 然后分配其他节点
        for (const t of terminals) {
            const key = getTerminalKey(t);
            const root = find(key);
            if (!nodeMap.has(root)) {
                nodeMap.set(root, nodeIndex++);
            }
        }

        // 更新元器件的节点引用
        for (const [id, comp] of this.components) {
            const key0 = `${id}:0`;
            const key1 = `${id}:1`;
            
            if (comp.type === 'Rheostat') {
                // 滑动变阻器有三个节点
                const key2 = `${id}:2`;
                comp.nodes = [
                    nodeMap.get(find(key0)),
                    nodeMap.get(find(key1)),
                    nodeMap.get(find(key2))
                ];
            } else {
                comp.nodes = [
                    nodeMap.get(find(key0)),
                    nodeMap.get(find(key1))
                ];
            }
        }

        // 生成节点列表
        this.nodes = Array.from({ length: nodeIndex }, (_, i) => ({ id: i }));
        
        // 检测滑动变阻器的连接模式
        this.detectRheostatConnections();
    }

    /**
     * 检测滑动变阻器的连接模式
     * 确定哪些端子被实际接入电路
     */
    detectRheostatConnections() {
        for (const [id, comp] of this.components) {
            if (comp.type !== 'Rheostat') continue;
            
            // 检查每个端子是否有导线连接
            const terminalConnected = [false, false, false]; // [左端, 右端, 滑动触点]
            
            for (const [wireId, wire] of this.wires) {
                if (wire.startComponentId === id) {
                    terminalConnected[wire.startTerminalIndex] = true;
                }
                if (wire.endComponentId === id) {
                    terminalConnected[wire.endTerminalIndex] = true;
                }
            }
            
            // 确定连接模式
            // connectionMode: 'left-slider' | 'right-slider' | 'left-right' | 'all' | 'none'
            const leftConnected = terminalConnected[0];
            const rightConnected = terminalConnected[1];
            const sliderConnected = terminalConnected[2];
            
            if (sliderConnected) {
                if (leftConnected && rightConnected) {
                    comp.connectionMode = 'all'; // 三端都连接
                } else if (leftConnected) {
                    comp.connectionMode = 'left-slider'; // 左端到滑动触点
                } else if (rightConnected) {
                    comp.connectionMode = 'right-slider'; // 右端到滑动触点
                } else {
                    comp.connectionMode = 'slider-only'; // 只有滑动触点连接
                }
            } else {
                if (leftConnected && rightConnected) {
                    comp.connectionMode = 'left-right'; // 左右两端（全阻值）
                } else {
                    comp.connectionMode = 'none'; // 没有形成回路
                }
            }
            
            // 计算接入电路的实际电阻
            this.calculateRheostatActiveResistance(comp);
        }
    }

    /**
     * 计算滑动变阻器接入电路的实际电阻
     */
    calculateRheostatActiveResistance(comp) {
        const totalR = comp.maxResistance - comp.minResistance;
        const R_left_to_slider = comp.minResistance + totalR * comp.position;  // 左端到滑块
        const R_slider_to_right = comp.maxResistance - totalR * comp.position; // 滑块到右端
        
        switch (comp.connectionMode) {
            case 'left-slider':
                // 左端到滑动触点：滑块右移电阻增大
                comp.activeResistance = R_left_to_slider;
                comp.resistanceDirection = 'slider-right-increase'; // 滑块右移增大
                break;
            case 'right-slider':
                // 右端到滑动触点：滑块右移电阻减小
                comp.activeResistance = R_slider_to_right;
                comp.resistanceDirection = 'slider-right-decrease'; // 滑块右移减小
                break;
            case 'left-right':
                // 左右两端（不经过滑块）：全阻值
                comp.activeResistance = comp.maxResistance;
                comp.resistanceDirection = 'fixed';
                break;
            case 'all':
                // 三端都连接：并联模式
                // R = (R_left_to_slider * R_slider_to_right) / (R_left_to_slider + R_slider_to_right)
                const R1 = Math.max(R_left_to_slider, 1e-9);
                const R2 = Math.max(R_slider_to_right, 1e-9);
                comp.activeResistance = (R1 * R2) / (R1 + R2);
                comp.resistanceDirection = 'parallel';
                break;
            default:
                comp.activeResistance = 0;
                comp.resistanceDirection = 'disconnected';
        }
    }

    /**
     * 检查元器件是否真正连接到电路中
     * 对于双端子元器件，需要两个端子都有导线连接
     * @param {string} componentId - 元器件ID
     * @returns {boolean} 是否连接
     */
    isComponentConnected(componentId) {
        const comp = this.components.get(componentId);
        if (!comp) return false;
        
        const terminalCount = comp.type === 'Rheostat' ? 3 : 2;
        const terminalConnected = new Array(terminalCount).fill(false);
        
        for (const [wireId, wire] of this.wires) {
            if (wire.startComponentId === componentId) {
                terminalConnected[wire.startTerminalIndex] = true;
            }
            if (wire.endComponentId === componentId) {
                terminalConnected[wire.endTerminalIndex] = true;
            }
        }
        
        // 对于普通双端子元器件，需要两个端子都连接
        if (comp.type !== 'Rheostat') {
            return terminalConnected[0] && terminalConnected[1];
        }
        
        // 对于滑动变阻器，至少需要两个端子连接才能形成回路
        const connectedCount = terminalConnected.filter(x => x).length;
        return connectedCount >= 2;
    }

    /**
     * 开始模拟
     */
    startSimulation() {
        if (this.isRunning) return;
        
        // 清除任何现有的模拟计时器（防止内存泄漏）
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
            this.simulationInterval = null;
        }
        
        this.isRunning = true;
        
        // 重置动态元器件状态
        for (const [id, comp] of this.components) {
            if (comp.type === 'Capacitor') {
                comp.prevVoltage = 0;
            }
            if (comp.type === 'Motor') {
                comp.speed = 0;
                comp.backEmf = 0;
            }
        }

        // 设置求解器
        this.solver.setCircuit(
            Array.from(this.components.values()),
            this.nodes
        );

        // 开始模拟循环
        this.simulationInterval = setInterval(() => {
            this.step();
        }, this.dt * 1000);
    }

    /**
     * 停止模拟
     */
    stopSimulation() {
        this.isRunning = false;
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
            this.simulationInterval = null;
        }
    }

    /**
     * 执行一步模拟
     */
    step() {
        if (!this.isRunning) return;

        // 更新求解器的电路数据
        this.solver.setCircuit(
            Array.from(this.components.values()),
            this.nodes
        );

        // 求解
        this.lastResults = this.solver.solve(this.dt);
        
        // 调试输出
        if (this.debugMode) {
            console.log('Nodes:', this.nodes.length);
            console.log('Voltages:', this.lastResults.voltages);
            for (const [id, comp] of this.components) {
                console.log(`${comp.type} ${id}: nodes=[${comp.nodes}]`);
            }
        }

        if (this.lastResults.valid) {
            // 更新动态元器件
            this.solver.updateDynamicComponents(this.lastResults.voltages);

            // 更新各元器件的显示值
            for (const [id, comp] of this.components) {
                const current = this.lastResults.currents.get(id) || 0;
                const v1 = this.lastResults.voltages[comp.nodes[0]] || 0;
                const v2 = this.lastResults.voltages[comp.nodes[1]] || 0;
                
                // 检查元器件是否真正连接到电路（两个端子都有导线连接）
                const isConnected = this.isComponentConnected(id);
                
                // 如果元器件未连接，所有值都应该为0
                if (!isConnected) {
                    comp.currentValue = 0;
                    comp.voltageValue = 0;
                    comp.powerValue = 0;
                    if (comp.type === 'Bulb') {
                        comp.brightness = 0;
                    }
                    continue;
                }
                
                comp.currentValue = current;
                
                // 对于电源，显示的电压应该是端子电压
                if (comp.type === 'PowerSource') {
                    // 端子电压直接从节点电压差获取（诺顿模型下这就是正确的端子电压）
                    const terminalVoltage = Math.abs(v1 - v2);
                    comp.voltageValue = terminalVoltage;
                    // 电源输出功率 = 端子电压 * 电流
                    comp.powerValue = Math.abs(terminalVoltage * current);
                } else {
                    comp.voltageValue = Math.abs(v1 - v2);
                    comp.powerValue = Math.abs(current * (v1 - v2));
                }
                
                // 灯泡亮度
                if (comp.type === 'Bulb') {
                    comp.brightness = Math.min(1, comp.powerValue / comp.ratedPower);
                }
            }
        }

        // 触发更新事件
        if (this.onUpdate) {
            this.onUpdate(this.lastResults);
        }
    }

    /**
     * 获取元器件
     * @param {string} id - 元器件ID
     * @returns {Object} 元器件对象
     */
    getComponent(id) {
        return this.components.get(id);
    }

    /**
     * 获取所有元器件
     * @returns {Object[]} 元器件数组
     */
    getAllComponents() {
        return Array.from(this.components.values());
    }

    /**
     * 获取所有导线
     * @returns {Object[]} 导线数组
     */
    getAllWires() {
        return Array.from(this.wires.values());
    }

    /**
     * 清空电路
     */
    clear() {
        this.stopSimulation();
        this.components.clear();
        this.wires.clear();
        this.nodes = [];
        this.lastResults = null;
    }

    /**
     * 导出电路为JSON
     * @returns {Object} 电路JSON对象
     */
    toJSON() {
        return {
            meta: {
                version: '1.0',
                timestamp: Date.now(),
                name: '电路设计'
            },
            components: Array.from(this.components.values()).map(comp => ({
                id: comp.id,
                type: comp.type,
                x: comp.x,
                y: comp.y,
                rotation: comp.rotation || 0,
                properties: this.getComponentProperties(comp),
                terminalExtensions: comp.terminalExtensions || null
            })),
            wires: Array.from(this.wires.values()).map(wire => ({
                id: wire.id,
                start: {
                    componentId: wire.startComponentId,
                    terminalIndex: wire.startTerminalIndex
                },
                end: {
                    componentId: wire.endComponentId,
                    terminalIndex: wire.endTerminalIndex
                },
                controlPoints: wire.controlPoints || []
            }))
        };
    }

    /**
     * 获取元器件的可保存属性
     * @param {Object} comp - 元器件
     * @returns {Object} 属性对象
     */
    getComponentProperties(comp) {
        switch (comp.type) {
            case 'PowerSource':
                return {
                    voltage: comp.voltage,
                    internalResistance: comp.internalResistance
                };
            case 'Resistor':
                return { resistance: comp.resistance };
            case 'Rheostat':
                return {
                    minResistance: comp.minResistance,
                    maxResistance: comp.maxResistance,
                    position: comp.position
                };
            case 'Bulb':
                return {
                    resistance: comp.resistance,
                    ratedPower: comp.ratedPower
                };
            case 'Capacitor':
                return { capacitance: comp.capacitance };
            case 'Motor':
                return {
                    resistance: comp.resistance,
                    torqueConstant: comp.torqueConstant,
                    emfConstant: comp.emfConstant,
                    inertia: comp.inertia,
                    loadTorque: comp.loadTorque
                };
            case 'Switch':
                return { closed: comp.closed };
            case 'Ammeter':
                return {
                    resistance: comp.resistance,
                    range: comp.range
                };
            case 'Voltmeter':
                return {
                    resistance: comp.resistance,
                    range: comp.range
                };
            default:
                return {};
        }
    }

    /**
     * 从JSON导入电路
     * @param {Object} json - 电路JSON对象
     */
    fromJSON(json) {
        this.clear();
        
        // 导入元器件 - 使用 createComponent 确保完整初始化
        for (const compData of json.components) {
            // 使用 createComponent 创建完整的元器件对象
            const comp = createComponent(
                compData.type,
                compData.x,
                compData.y,
                compData.id  // 使用保存的ID
            );
            
            // 恢复保存的属性
            comp.rotation = compData.rotation || 0;
            Object.assign(comp, compData.properties);
            
            // 恢复端子延伸
            if (compData.terminalExtensions) {
                comp.terminalExtensions = compData.terminalExtensions;
            }
            
            this.components.set(comp.id, comp);
        }

        // 导入导线
        for (const wireData of json.wires) {
            // 支持两种格式：
            // 新格式: { start: { componentId, terminalIndex }, end: { componentId, terminalIndex } }
            // 旧格式: { startComponentId, startTerminalIndex, endComponentId, endTerminalIndex }
            let wire;
            if (wireData.start && wireData.end) {
                // 新格式
                wire = {
                    id: wireData.id,
                    startComponentId: wireData.start.componentId,
                    startTerminalIndex: wireData.start.terminalIndex,
                    endComponentId: wireData.end.componentId,
                    endTerminalIndex: wireData.end.terminalIndex,
                    controlPoints: wireData.controlPoints || []
                };
            } else {
                // 旧格式
                wire = {
                    id: wireData.id,
                    startComponentId: wireData.startComponentId,
                    startTerminalIndex: wireData.startTerminalIndex,
                    endComponentId: wireData.endComponentId,
                    endTerminalIndex: wireData.endTerminalIndex,
                    controlPoints: wireData.controlPoints || []
                };
            }
            this.wires.set(wire.id, wire);
        }

        this.rebuildNodes();
    }
}
