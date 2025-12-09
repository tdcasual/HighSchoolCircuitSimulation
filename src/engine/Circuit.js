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
        this._wireFlowCache = { version: null, map: new Map() };
        this.terminalConnectionMap = new Map();
        this.debugMode = false;
        this.loadDebugFlag();
        this.solver.debugMode = this.debugMode;
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
        const connectedTerminals = new Map();
        const incrementConnection = (key) => {
            connectedTerminals.set(key, (connectedTerminals.get(key) || 0) + 1);
        };
        for (const [wireId, wire] of this.wires) {
            incrementConnection(`${wire.startComponentId}:${wire.startTerminalIndex}`);
            incrementConnection(`${wire.endComponentId}:${wire.endTerminalIndex}`);
        }
        this.terminalConnectionMap = connectedTerminals;
        
        // 收集所有有导线连接的端点
        // 只有实际连接了导线的端子才会被添加，避免产生孤立节点
        const terminals = [];
        const hasWire = (componentId, terminalIndex) => connectedTerminals.has(`${componentId}:${terminalIndex}`);
        for (const [id, comp] of this.components) {
            // 只添加有导线连接的端子
            if (hasWire(id, 0)) {
                terminals.push({ componentId: id, terminalIndex: 0 });
            }
            if (hasWire(id, 1)) {
                terminals.push({ componentId: id, terminalIndex: 1 });
            }
            // 滑动变阻器的第三个端子
            if (comp.type === 'Rheostat' && hasWire(id, 2)) {
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
                // 三端都连接：只显示左端到滑块的电阻（R1）
                // 实际电路中两段是分开工作的，显示左侧电阻即可
                comp.activeResistance = R_left_to_slider;
                comp.resistanceDirection = 'slider-right-increase'; // 滑块右移增大
                // 保存右侧电阻供需要时使用
                comp.rightResistance = R_slider_to_right;
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
        if (!comp || !Array.isArray(comp.nodes)) return false;

        const hasValidNode = (idx) => idx !== undefined && idx !== null && idx >= 0;
        const hasTerminalWire = (terminalIndex) => {
            const key = `${componentId}:${terminalIndex}`;
            return (this.terminalConnectionMap.get(key) || 0) > 0;
        };

        if (comp.type !== 'Rheostat') {
            return hasValidNode(comp.nodes[0]) && hasValidNode(comp.nodes[1])
                && hasTerminalWire(0) && hasTerminalWire(1);
        }

        // 滑动变阻器需要至少两个不同节点接入，且端子必须真正接线
        const connectedTerminals = comp.nodes
            .map((nodeIdx, idx) => ({ nodeIdx, idx }))
            .filter(({ nodeIdx, idx }) => hasValidNode(nodeIdx) && hasTerminalWire(idx));
        if (connectedTerminals.length < 2) return false;
        const uniqueNodes = new Set(connectedTerminals.map(t => t.nodeIdx));
        return uniqueNodes.size >= 2;
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
        this.solver.debugMode = this.debugMode;

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
        this.solver.debugMode = this.debugMode;

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
                
                // 特殊处理：理想电压表必须强制电流为0
                if (this.isIdealVoltmeter(comp)) {
                    comp.currentValue = 0;
                }
                
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
     * 计算指定端子的电流方向（正值表示元件向节点供电）
     * @param {Object} comp
     * @param {number} terminalIndex
     * @param {Object} results
     * @returns {number}
     */
    getTerminalCurrentFlow(comp, terminalIndex, results) {
        if (!comp || !results || terminalIndex == null) return 0;
        if (!comp.nodes || terminalIndex >= comp.nodes.length) return 0;
        const nodeIndex = comp.nodes[terminalIndex];
        if (nodeIndex === undefined || nodeIndex < 0) return 0;

        const compCurrent = results.currents.get(comp.id) || 0;
        const eps = 1e-9;

        // 三端器件单独处理
        if (comp.type === 'Rheostat') {
            const flows = this.getRheostatTerminalFlows(comp, results.voltages);
            return flows[terminalIndex] || 0;
        }
        
        // 理想电压表：内阻无穷大，不应该有电流
        if (this.isIdealVoltmeter(comp)) {
            return 0; // 理想电压表的端子不输出电流
        }

        // 判定为"主动"器件的列表（正电流表示端子0向外输出）
        const isActiveSource = (
            comp.type === 'PowerSource' ||
            comp.type === 'Motor' ||
            (comp.type === 'Ammeter' && (!comp.resistance || comp.resistance <= 0))
        );

        if (Math.abs(compCurrent) < eps) {
            return 0;
        }

        if (isActiveSource) {
            return terminalIndex === 0 ? compCurrent : -compCurrent;
        }

        // 其余双端被视为被动器件
        return terminalIndex === 0 ? -compCurrent : compCurrent;
    }

    /**
     * 计算滑动变阻器各端子的等效电流流向
     * @param {Object} comp
     * @param {number[]} voltages
     * @returns {number[]}
     */
    getRheostatTerminalFlows(comp, voltages) {
        const flows = [0, 0, 0];
        const getVoltage = (nodeIdx) => {
            if (nodeIdx === undefined || nodeIdx < 0) return 0;
            return voltages[nodeIdx] || 0;
        };

        const vLeft = getVoltage(comp.nodes[0]);
        const vRight = getVoltage(comp.nodes[1]);
        const vSlider = getVoltage(comp.nodes[2]);

        const position = comp.position == null ? 0.5 : Math.min(Math.max(comp.position, 0), 1);
        const range = Math.max(0, (comp.maxResistance ?? 100) - (comp.minResistance ?? 0));
        const baseMin = comp.minResistance ?? 0;
        const leftToSlider = Math.max(1e-9, baseMin + range * position);
        const sliderToRight = Math.max(1e-9, (comp.maxResistance ?? 100) - range * position);

        const mode = comp.connectionMode || 'none';

        switch (mode) {
            case 'left-slider': {
                const I = (vLeft - vSlider) / leftToSlider;
                flows[0] = -I;
                flows[2] = I;
                break;
            }
            case 'right-slider': {
                const I = (vSlider - vRight) / sliderToRight;
                flows[2] = -I;
                flows[1] = I;
                break;
            }
            case 'left-right': {
                const R = Math.max(1e-9, comp.maxResistance ?? leftToSlider + sliderToRight);
                const I = (vLeft - vRight) / R;
                flows[0] = -I;
                flows[1] = I;
                break;
            }
            case 'all': {
                const I_ls = (vLeft - vSlider) / leftToSlider;
                const I_sr = (vSlider - vRight) / sliderToRight;
                flows[0] = -I_ls;
                flows[1] = I_sr;
                flows[2] = I_ls - I_sr;
                break;
            }
            default:
                // 未接入电路或只有滑块等情况，都视为无电流
                break;
        }

        return flows;
    }

    ensureWireFlowCache(results) {
        if (this._wireFlowCache.version === results && this._wireFlowCache.map) {
            return;
        }
        this._wireFlowCache = {
            version: results,
            map: this.computeWireFlowCache(results)
        };
    }

    computeWireFlowCache(results) {
        const wiresByNode = new Map();
        const cache = new Map();

        for (const [wireId, wire] of this.wires) {
            const startComp = this.components.get(wire.startComponentId);
            const endComp = this.components.get(wire.endComponentId);
            if (!startComp || !endComp) continue;
            const startNode = startComp.nodes?.[wire.startTerminalIndex];
            const endNode = endComp.nodes?.[wire.endTerminalIndex];
            if (startNode === undefined || startNode < 0 || endNode === undefined || endNode < 0) continue;
            if (startNode !== endNode) {
                // 理论上不会发生，但为了安全直接根据元件电流决定方向
                const startFlow = this.getTerminalCurrentFlow(startComp, wire.startTerminalIndex, results);
                const endFlow = this.getTerminalCurrentFlow(endComp, wire.endTerminalIndex, results);
                const direction = Math.abs(startFlow) >= Math.abs(endFlow)
                    ? (startFlow >= 0 ? 1 : -1)
                    : (endFlow >= 0 ? -1 : 1);
                cache.set(wireId, {
                    flowDirection: direction,
                    currentMagnitude: Math.max(Math.abs(startFlow), Math.abs(endFlow))
                });
                continue;
            }
            if (!wiresByNode.has(startNode)) {
                wiresByNode.set(startNode, []);
            }
            wiresByNode.get(startNode).push(wire);
        }

        for (const [nodeId, nodeWires] of wiresByNode) {
            const nodeMap = this.computeNodeWireFlow(nodeWires, results);
            for (const [wireId, info] of nodeMap) {
                cache.set(wireId, info);
            }
        }

        return cache;
    }

    computeNodeWireFlow(nodeWires, results) {
        const adjacency = new Map(); // terminalKey -> [{wireId, neighbor}]
        const wireEndpoints = new Map(); // wireId -> {startKey, endKey}
        const terminalFlows = new Map(); // terminalKey -> flow value
        const eps = 1e-9;

        const addAdjacency = (key, wireId, neighbor) => {
            if (!adjacency.has(key)) adjacency.set(key, []);
            adjacency.get(key).push({ wireId, neighbor });
        };

        const ensureTerminalFlow = (componentId, terminalIndex, key) => {
            if (terminalFlows.has(key)) return;
            const comp = this.components.get(componentId);
            if (!comp) {
                terminalFlows.set(key, 0);
                return;
            }
            const flow = this.getTerminalCurrentFlow(comp, terminalIndex, results);
            terminalFlows.set(key, flow);
        };

        const remainingWires = [];
        const directAssignments = new Map();

        for (const wire of nodeWires) {
            const startKey = `${wire.startComponentId}:${wire.startTerminalIndex}`;
            const endKey = `${wire.endComponentId}:${wire.endTerminalIndex}`;
            wireEndpoints.set(wire.id, { startKey, endKey });
            addAdjacency(startKey, wire.id, endKey);
            addAdjacency(endKey, wire.id, startKey);
            ensureTerminalFlow(wire.startComponentId, wire.startTerminalIndex, startKey);
            ensureTerminalFlow(wire.endComponentId, wire.endTerminalIndex, endKey);

            const startFlow = terminalFlows.get(startKey) || 0;
            const endFlow = terminalFlows.get(endKey) || 0;
            if (startFlow > eps && endFlow < -eps) {
                directAssignments.set(wire.id, {
                    flowDirection: 1,
                    currentMagnitude: Math.min(Math.abs(startFlow), Math.abs(endFlow))
                });
            } else if (startFlow < -eps && endFlow > eps) {
                directAssignments.set(wire.id, {
                    flowDirection: -1,
                    currentMagnitude: Math.min(Math.abs(startFlow), Math.abs(endFlow))
                });
            } else {
                remainingWires.push(wire);
            }
        }

        const entries = Array.from(terminalFlows.entries());
        const sources = entries
            .filter(([, flow]) => flow > eps)
            .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
        const sinks = entries
            .filter(([, flow]) => flow < -eps)
            .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

        const wireDirections = new Map();
        const computeDistances = (list) => {
            const dist = new Map();
            const queue = [];
            for (const [key] of list) {
                if (!key || dist.has(key)) continue;
                dist.set(key, 0);
                queue.push(key);
            }
            while (queue.length > 0) {
                const key = queue.shift();
                const neighbors = adjacency.get(key) || [];
                for (const { neighbor } of neighbors) {
                    if (dist.has(neighbor)) continue;
                    dist.set(neighbor, (dist.get(key) || 0) + 1);
                    queue.push(neighbor);
                }
            }
            return dist;
        };

        const distanceFromSources = computeDistances(sources);
        const distanceFromSinks = computeDistances(sinks);
        const fallbackDistances = computeDistances(entries);
        const hasSources = sources.length > 0;
        const hasSinks = sinks.length > 0;
        const fallbackValue = Math.max(nodeWires.length * 2 + adjacency.size, 4);

        const getDistanceValue = (map, key, hasSeed) => {
            if (map.has(key)) return map.get(key);
            if (!hasSeed && fallbackDistances.has(key)) {
                return fallbackDistances.get(key);
            }
            return fallbackValue;
        };

        const computeScore = (key) => {
            const sourceDist = getDistanceValue(distanceFromSources, key, hasSources);
            const sinkDist = getDistanceValue(distanceFromSinks, key, hasSinks);
            const flow = terminalFlows.get(key) || 0;
            const bias = Math.sign(flow) * 0.001;
            return (sinkDist - sourceDist) + bias;
        };

        const unresolved = [];
        for (const wire of remainingWires) {
            const endpoints = wireEndpoints.get(wire.id);
            const startScore = computeScore(endpoints.startKey);
            const endScore = computeScore(endpoints.endKey);
            if (!Number.isFinite(startScore) || !Number.isFinite(endScore)) {
                unresolved.push(wire);
                continue;
            }
            const diff = startScore - endScore;
            if (Math.abs(diff) < 1e-6) {
                unresolved.push(wire);
                continue;
            }
            wireDirections.set(wire.id, diff > 0 ? 1 : -1);
        }

        for (const wire of unresolved) {
            if (!wireDirections.has(wire.id)) {
                wireDirections.set(wire.id, 1);
            }
        }

        for (const [wireId, info] of directAssignments) {
            wireDirections.set(wireId, info.flowDirection);
        }

        const nodeResult = new Map();
        for (const [wireId, direction] of wireDirections) {
            const endpoints = wireEndpoints.get(wireId);
            const startFlow = terminalFlows.get(endpoints.startKey) || 0;
            const endFlow = terminalFlows.get(endpoints.endKey) || 0;
            const startMag = Math.abs(startFlow);
            const endMag = Math.abs(endFlow);
            const startComp = this.components.get(endpoints.startKey.split(':')[0]);
            const endComp = this.components.get(endpoints.endKey.split(':')[0]);
            const startShorted = !!startComp?._isShorted;
            const endShorted = !!endComp?._isShorted;
            const hasTinyStart = startMag < eps && !startShorted;
            const hasTinyEnd = endMag < eps && !endShorted;
            // If a branch endpoint is effectively open, don't borrow the larger trunk current;
            // shorted components still propagate the bus magnitude
            const magnitude = (directAssignments.has(wireId) && directAssignments.get(wireId).currentMagnitude !== undefined)
                ? directAssignments.get(wireId).currentMagnitude
                : ((hasTinyStart || hasTinyEnd) ? Math.min(startMag, endMag) : Math.max(startMag, endMag));
            nodeResult.set(wireId, { flowDirection: direction, currentMagnitude: magnitude });
        }

        return nodeResult;
    }

    /**
     * 检查导线是否经过电气连接点（多条导线交汇的节点）
     * @param {Object} wire - 导线对象
     * @returns {boolean} 是否经过连接点
     */
    wirePassesThroughJunction(wire) {
        // 如果没有控制点，则是直接连接，不经过连接点
        if (!wire.controlPoints || wire.controlPoints.length === 0) {
            return false;
        }
        
        // 检查是否有其他导线的端点或控制点与该导线的控制点重合
        const threshold = 5; // 位置阈值（像素）
        
        for (const cp of wire.controlPoints) {
            // 检查所有其他导线
            for (const [otherId, otherWire] of this.wires) {
                if (otherId === wire.id) continue;
                
                // 收集其他导线的所有关键点（控制点）
                const keyPoints = [];
                
                // 添加控制点
                if (otherWire.controlPoints) {
                    keyPoints.push(...otherWire.controlPoints);
                }
                
                // 检查是否有任何关键点与当前控制点重合
                for (const kp of keyPoints) {
                    const dx = Math.abs(kp.x - cp.x);
                    const dy = Math.abs(kp.y - cp.y);
                    if (dx < threshold && dy < threshold) {
                        // 找到交汇点！
                        return true;
                    }
                }
            }
        }
        
        return false;
    }

    /**
     * 检查元器件是否为稳态电容器（充电完成）
     * @param {Object} comp - 元器件对象
     * @returns {boolean} 是否为稳态电容器
     */
    isSteadyStateCapacitor(comp) {
        if (!comp || comp.type !== 'Capacitor') return false;
        // 电流极小时认为充电完成
        return Math.abs(comp.currentValue || 0) < 1e-6;
    }

    /**
     * 检查导线是否与稳态电容器串联
     * 核心逻辑：只检查导线直接连接的两个组件，不检查节点上的其他组件
     * @param {Object} wire - 导线对象
     * @param {Object} results - 求解结果
     * @returns {boolean} 是否与稳态电容器串联
     */
    wireInSeriesWithSteadyCapacitor(wire, results) {
        const startComp = this.components.get(wire.startComponentId);
        const endComp = this.components.get(wire.endComponentId);
        if (!startComp || !endComp) return false;
        
        // 检查策略：
        // 1. 如果导线直接连接到稳态电容器 -> 无电流
        // 2. 如果导线两端的组件电流都接近0 -> 无电流
        // 关键：不检查节点上的其他组件（如并联的滑动变阻器）
        
        // 直接检查：如果导线的任一端直接连接到稳态电容器
        if (this.isSteadyStateCapacitor(startComp) || this.isSteadyStateCapacitor(endComp)) {
            return true;
        }
        
        // 检查导线两端直接连接的组件电流
        // 如果两个组件的电流都接近0，说明这是一个零电流支路
        const startCompCurrent = Math.abs(results.currents.get(wire.startComponentId) || 0);
        const endCompCurrent = Math.abs(results.currents.get(wire.endComponentId) || 0);
        
        const currentThreshold = 1e-6;
        
        // 只有两端的组件电流都接近0，才认为是零电流支路
        if (startCompCurrent < currentThreshold && endCompCurrent < currentThreshold) {
            return true;
        }
        
        return false;
    }

    /**
     * 检查元器件是否为理想电压表
     * @param {Object} comp - 元器件对象
     * @returns {boolean} 是否为理想电压表
     */
    isIdealVoltmeter(comp) {
        if (!comp || comp.type !== 'Voltmeter') return false;
        const r = comp.resistance;
        return r === null || r === undefined || r === Infinity || r >= 1e10;
    }

    /**
     * 获取导线的电流信息
     * @param {Object} wire - 导线对象
     * @param {Object} results - 求解结果
     * @returns {Object} 包含电流、电势和短路信息
     */
    getWireCurrentInfo(wire, results) {
        if (!wire || !results || !results.valid) return null;
        
        const startComp = this.components.get(wire.startComponentId);
        const endComp = this.components.get(wire.endComponentId);
        if (!startComp || !endComp) return null;
        
        // CRITICAL: Both components must be fully connected (both terminals wired) before showing current
        // This prevents phantom current animations on incomplete connections
        const startConnected = this.isComponentConnected(wire.startComponentId);
        const endConnected = this.isComponentConnected(wire.endComponentId);
        if (!startConnected || !endConnected) {
            // Return zero current info if either component is not fully connected
            return {
                current: 0,
                voltage1: 0,
                voltage2: 0,
                isShorted: false,
                flowDirection: 0,
                voltageDiff: 0
            };
        }
        
        const startNode = startComp.nodes[wire.startTerminalIndex];
        const endNode = endComp.nodes[wire.endTerminalIndex];
        
        const getVoltage = (nodeIdx) => {
            if (nodeIdx === undefined || nodeIdx < 0) return 0;
            return results.voltages[nodeIdx] || 0;
        };
        
        const voltage1 = getVoltage(startNode);
        const voltage2 = getVoltage(endNode);
        const voltageDiff = voltage1 - voltage2;
        const isShorted = false;

        const startFlow = this.getTerminalCurrentFlow(startComp, wire.startTerminalIndex, results);
        const endFlow = this.getTerminalCurrentFlow(endComp, wire.endTerminalIndex, results);
        const startMag = Math.abs(startFlow);
        const endMag = Math.abs(endFlow);
        const flowEps = 1e-9;
        const startShorted = !!startComp._isShorted;
        const endShorted = !!endComp._isShorted;
        const hasTinyStart = startMag < flowEps && !startShorted;
        const hasTinyEnd = endMag < flowEps && !endShorted;
        // Avoid leaking trunk current into a dead branch (open switch/charged cap) but still
        // propagate through shorted components that simply sit on the bus
        const baseCurrent = (hasTinyStart || hasTinyEnd)
            ? Math.min(startMag, endMag)
            : Math.max(startMag, endMag);
        
        // CRITICAL: Handle ideal voltmeters robustly
        // Wires connected to ideal voltmeters should show zero current
        // UNLESS the wire passes through an electrical junction where other wires bring current
        const startIsIdealV = this.isIdealVoltmeter(startComp);
        const endIsIdealV = this.isIdealVoltmeter(endComp);
        
        // CRITICAL: Handle steady-state capacitors
        // wireInSeriesWithSteadyCapacitor() now includes node-level junction detection
        // Returns true ONLY if wire is in true series with capacitor (no parallel connections)
        const inSeriesWithCapacitor = this.wireInSeriesWithSteadyCapacitor(wire, results);
        
        let current;
        
        // 优先检查稳态电容器
        if (inSeriesWithCapacitor) {
            // 真正的串联连接（已经排除并联连接点），强制电流为0
            current = 0;
        } else if (startIsIdealV && endIsIdealV) {
            // Both ends are ideal voltmeters - no current should flow
            current = 0;
        } else if (startIsIdealV || endIsIdealV) {
            // One end is ideal voltmeter
            // Check if this wire passes through a junction where other wires meet
            const hasJunction = this.wirePassesThroughJunction(wire);
            
            if (hasJunction) {
                // Wire passes through a junction - may have current from other circuit paths
                // Use normal calculation
                current = baseCurrent;
            } else {
                // Direct connection to ideal voltmeter - no current
                current = 0;
            }
        } else {
            // Normal case - use maximum current from either end
            current = baseCurrent;
        }
        
        const eps = 1e-9;

        this.ensureWireFlowCache(results);
        const cachedFlow = this._wireFlowCache.map.get(wire.id);
        let flowDirection = cachedFlow?.flowDirection ?? 0;
        if (!flowDirection) {
            if (startMag > eps && endMag > eps) {
                flowDirection = startFlow >= 0 ? 1 : -1;
            } else if (startMag > eps) {
                flowDirection = startFlow >= 0 ? 1 : -1;
            } else if (endMag > eps) {
                flowDirection = endFlow >= 0 ? -1 : 1;
            } else if (Math.abs(voltageDiff) > 1e-6) {
                flowDirection = voltageDiff > 0 ? 1 : -1;
            }
        }

        if (cachedFlow && cachedFlow.currentMagnitude !== undefined) {
            // 使用缓存的电流值，但要尊重特殊情况
            // 优先检查稳态电容器（已包含节点级别的连接点检查）
            if (inSeriesWithCapacitor) {
                current = 0;
            } else if ((startIsIdealV || endIsIdealV) && !this.wirePassesThroughJunction(wire)) {
                // 如果是直接连接到理想电压表且没有连接点，强制为0
                current = 0;
            } else {
                current = cachedFlow.currentMagnitude;
            }
        }
        if (current < eps) current = 0;
        
        return {
            current,
            voltage1,
            voltage2,
            isShorted,
            flowDirection,
            voltageDiff
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
     * 加载/保存调试开关
     */
    loadDebugFlag() {
        try {
            if (typeof localStorage !== 'undefined') {
                const flag = localStorage.getItem('solver_debug');
                if (flag === 'true') this.debugMode = true;
            }
        } catch (e) {
            // ignore in non-browser env
        }
    }

    setDebugMode(flag) {
        this.debugMode = !!flag;
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('solver_debug', this.debugMode ? 'true' : 'false');
            }
        } catch (e) {
            // ignore
        }
        this.solver.debugMode = this.debugMode;
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
                label: comp.label || null,  // 包含自定义标签
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
            if (compData.label) {
                comp.label = compData.label;  // 恢复自定义标签
            }
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
