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
        // 首先检测哪些端子有导线连接
        const connectedTerminals = new Set();
        for (const [wireId, wire] of this.wires) {
            connectedTerminals.add(`${wire.startComponentId}:${wire.startTerminalIndex}`);
            connectedTerminals.add(`${wire.endComponentId}:${wire.endTerminalIndex}`);
        }
        
        // 收集所有有导线连接的端点
        // 只有实际连接了导线的端子才会被添加，避免产生孤立节点
        const terminals = [];
        for (const [id, comp] of this.components) {
            // 只添加有导线连接的端子
            if (connectedTerminals.has(`${id}:0`)) {
                terminals.push({ componentId: id, terminalIndex: 0 });
            }
            if (connectedTerminals.has(`${id}:1`)) {
                terminals.push({ componentId: id, terminalIndex: 1 });
            }
            // 滑动变阻器的第三个端子
            if (comp.type === 'Rheostat' && connectedTerminals.has(`${id}:2`)) {
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
        // 未连接导线的端子节点索引设为 -1
        for (const [id, comp] of this.components) {
            const key0 = `${id}:0`;
            const key1 = `${id}:1`;
            
            // 检查端子是否有导线连接
            const node0 = parent.has(key0) ? nodeMap.get(find(key0)) : undefined;
            const node1 = parent.has(key1) ? nodeMap.get(find(key1)) : undefined;
            
            if (comp.type === 'Rheostat') {
                // 滑动变阻器有三个节点，未连接的端子设为 -1
                const key2 = `${id}:2`;
                const node2 = parent.has(key2) ? nodeMap.get(find(key2)) : undefined;
                comp.nodes = [
                    node0 !== undefined ? node0 : -1,
                    node1 !== undefined ? node1 : -1,
                    node2 !== undefined ? node2 : -1
                ];
            } else {
                comp.nodes = [
                    node0 !== undefined ? node0 : -1,
                    node1 !== undefined ? node1 : -1
                ];
            }
        }

        // 生成节点列表
        this.nodes = Array.from({ length: nodeIndex }, (_, i) => ({ id: i }));
        
        // 调试：打印节点与端子映射，帮助排查错误连接
        console.warn('--- Node mapping ---');
        const nodeTerminals = Array.from({ length: nodeIndex }, () => []);
        for (const [id, comp] of this.components) {
            const append = (node, terminalIdx) => {
                if (node !== undefined && node >= 0) {
                    nodeTerminals[node].push(`${id}:${terminalIdx}`);
                }
            };
            append(comp.nodes[0], 0);
            append(comp.nodes[1], 1);
            if (comp.type === 'Rheostat') {
                append(comp.nodes[2], 2);
            }
        }
        nodeTerminals.forEach((ts, idx) => {
            console.warn(`node ${idx}: ${ts.join(', ')}`);
        });
        
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
            
            console.log(`Rheostat ${id}: terminals connected = [left:${terminalConnected[0]}, right:${terminalConnected[1]}, slider:${terminalConnected[2]}]`);
            
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
            
            console.log(`Rheostat ${id}: connectionMode = ${comp.connectionMode}`);
            
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
                    comp._isShorted = false;
                    if (comp.type === 'Bulb') {
                        comp.brightness = 0;
                    }
                    continue;
                }
                
                // 检查元器件是否被短路（两端节点相同）
                if (comp._isShorted) {
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
                } else if (comp.type === 'Rheostat') {
                    // 滑动变阻器根据连接模式计算电压
                    // 安全获取电压值，未连接的端子电压视为0
                    const getVoltage = (nodeIdx) => {
                        if (nodeIdx === undefined || nodeIdx < 0) return 0;
                        return this.lastResults.voltages[nodeIdx] || 0;
                    };
                    
                    const v_left = getVoltage(comp.nodes[0]);
                    const v_right = getVoltage(comp.nodes[1]);
                    const v_slider = getVoltage(comp.nodes[2]);
                    // 保存分段电压供 UI 显示
                    comp.voltageSegLeft = 0;
                    comp.voltageSegRight = 0;
                    
                    let voltage = 0;
                    switch (comp.connectionMode) {
                        case 'left-slider':
                            voltage = Math.abs(v_left - v_slider);
                            comp.voltageSegLeft = voltage;
                            comp.voltageSegRight = undefined;
                            break;
                        case 'right-slider':
                            voltage = Math.abs(v_slider - v_right);
                            comp.voltageSegLeft = undefined;
                            comp.voltageSegRight = voltage;
                            break;
                        case 'left-right':
                            voltage = Math.abs(v_left - v_right);
                            comp.voltageSegLeft = voltage;
                            comp.voltageSegRight = undefined;
                            break;
                        case 'all':
                            // 三端都连接时，显示左右两端的总电压
                            voltage = Math.abs(v_left - v_right);
                            comp.voltageSegLeft = Math.abs(v_left - v_slider);
                            comp.voltageSegRight = Math.abs(v_slider - v_right);
                            break;
                        default:
                            voltage = 0;
                            comp.voltageSegLeft = undefined;
                            comp.voltageSegRight = undefined;
                    }
                    comp.voltageValue = voltage;
                    comp.powerValue = Math.abs(current * voltage);
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
     * 获取导线的电流信息
     * @param {Object} wire - 导线对象
     * @param {Object} results - 求解结果
     * @returns {Object} 包含电流、电势和短路信息
     */
    getWireCurrentInfo(wire, results) {
        if (!wire || !results || !results.valid) return null;
        
        // 获取导线两端连接的元器件和端子
        const startComp = this.components.get(wire.startComponentId);
        const endComp = this.components.get(wire.endComponentId);
        
        if (!startComp || !endComp) return null;
        
        // 获取两端端子对应的节点
        const startNode = startComp.nodes[wire.startTerminalIndex];
        const endNode = endComp.nodes[wire.endTerminalIndex];
        
        // 安全获取电压
        const getVoltage = (nodeIdx) => {
            if (nodeIdx === undefined || nodeIdx < 0) return 0;
            return results.voltages[nodeIdx] || 0;
        };
        
        const voltage1 = getVoltage(startNode);
        const voltage2 = getVoltage(endNode);
        
        const isShorted = false;
        
        // 获取连接元器件的电流
        const startCurrent = results.currents.get(wire.startComponentId) || 0;
        const endCurrent = results.currents.get(wire.endComponentId) || 0;
        
        // 取电流较大的那个作为导线电流（用于强度展示）
        let current = Math.abs(startCurrent) > Math.abs(endCurrent) ? startCurrent : endCurrent;
        
        // 判断电流方向
        // 核心逻辑：判断起点端子是"电流流出"还是"电流流入"
        // - 如果起点端子是电流流出端，则导线电流从start流向end (flowDirection = 1)
        // - 如果起点端子是电流流入端，则导线电流从end流向start (flowDirection = -1)
        let flowDirection = 0;
        
        if (Math.abs(current) < 1e-9) {
            flowDirection = 0;
        } else {
            // 使用更可靠的方法：基于元器件端子的电势来判断
            // 电流从高电势流向低电势
            
            // 获取起点元器件两端的电势
            const getVoltageForComp = (comp, termIdx) => {
                const node = comp.nodes[termIdx];
                if (node === undefined || node < 0) return 0;
                return results.voltages[node] || 0;
            };
            
            // 对于起点元器件，判断电流是流入还是流出该端子
            const v0 = getVoltageForComp(startComp, 0);
            const v1 = getVoltageForComp(startComp, 1);
            const terminalVoltage = getVoltageForComp(startComp, wire.startTerminalIndex);
            const otherVoltage = wire.startTerminalIndex === 0 ? v1 : v0;
            
            // 如果该端子电势高于另一端，电流从该端子流出
            // 如果该端子电势低于另一端，电流流入该端子
            let isFlowingOut;
            
            if (startComp.type === 'PowerSource') {
                // 电源特殊处理：正极流出，负极流入
                if (wire.startTerminalIndex === 0) {
                    isFlowingOut = startCurrent > 0;
                } else {
                    isFlowingOut = startCurrent < 0;
                }
            } else if (startComp.type === 'Rheostat') {
                // 滑动变阻器：根据该端子与其他端子的电势差判断
                // 如果该端子电势高，电流流出
                const v_left = getVoltageForComp(startComp, 0);
                const v_right = getVoltageForComp(startComp, 1);
                const v_slider = getVoltageForComp(startComp, 2);
                const myV = getVoltageForComp(startComp, wire.startTerminalIndex);
                
                // 找到与该端子相连的最低电势点
                let minV = Infinity;
                if (wire.startTerminalIndex !== 0) minV = Math.min(minV, v_left);
                if (wire.startTerminalIndex !== 1) minV = Math.min(minV, v_right);
                if (wire.startTerminalIndex !== 2) minV = Math.min(minV, v_slider);
                
                isFlowingOut = myV > minV + 1e-6;
            } else {
                // 普通元器件：电流从高电势端流向低电势端
                // 如果该端子电势高于另一端，电流从该端子流入元器件
                // 所以该端子不是流出端
                if (Math.abs(terminalVoltage - otherVoltage) > 1e-6) {
                    isFlowingOut = terminalVoltage < otherVoltage;
                } else {
                    // 电压相同，用电流方向判断
                    if (wire.startTerminalIndex === 0) {
                        isFlowingOut = startCurrent < 0;
                    } else {
                        isFlowingOut = startCurrent > 0;
                    }
                }
            }
            
            flowDirection = isFlowingOut ? 1 : -1;
            
            // 调试输出
            console.log(`Wire ${wire.id}: start=${startComp.type}:${wire.startTerminalIndex}, I=${startCurrent.toFixed(4)}, flowOut=${isFlowingOut}, dir=${flowDirection}`);
        }
        
        return {
            current,
            voltage1,
            voltage2,
            isShorted,
            flowDirection,
            voltageDiff: voltage1 - voltage2
        };
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
