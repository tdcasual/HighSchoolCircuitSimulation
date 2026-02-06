/**
 * Circuit.js - 电路管理器
 * 管理电路中的节点、元器件和连接
 */

import { MNASolver } from './Solver.js';
import { Matrix } from './Matrix.js';
import { createComponent } from '../components/Component.js';
import { computeOverlapFractionFromOffsetPx, computeParallelPlateCapacitance } from '../utils/Physics.js';
import { getTerminalWorldPosition } from '../utils/TerminalGeometry.js';
import { normalizeCanvasPoint, pointKey, toCanvasInt } from '../utils/CanvasCoords.js';

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
        this.simTime = 0;             // 仿真时间（秒）
        this._wireFlowCache = { version: null, map: new Map() };
        this.terminalConnectionMap = new Map();
        this.shortedPowerNodes = new Set(); // node indices that contain a shorted PowerSource
        this.debugMode = false;
        this.loadDebugFlag();
        this.solver.debugMode = this.debugMode;
    }

    /**
     * 添加元器件
     * @param {Object} component - 元器件对象
     */
    addComponent(component) {
        if (!component || !component.id) return;
        if (component) {
            component.x = toCanvasInt(component.x || 0);
            component.y = toCanvasInt(component.y || 0);
            if (component.terminalExtensions && typeof component.terminalExtensions === 'object') {
                for (const key of Object.keys(component.terminalExtensions)) {
                    const ext = component.terminalExtensions[key];
                    if (!ext || typeof ext !== 'object') continue;
                    component.terminalExtensions[key] = {
                        x: toCanvasInt(ext.x || 0),
                        y: toCanvasInt(ext.y || 0)
                    };
                }
            }
        }
        this.components.set(component.id, component);
        this.rebuildNodes();
    }

    /**
     * 删除元器件
     * @param {string} id - 元器件ID
     */
    removeComponent(id) {
        this.components.delete(id);
        this.rebuildNodes();
    }

    /**
     * 添加导线连接
     * @param {Object} wire - 导线对象
     */
    addWire(wire) {
        if (!wire || !wire.id) return;
        const a = normalizeCanvasPoint(wire.a);
        const b = normalizeCanvasPoint(wire.b);
        if (!a || !b) return;

        wire.a = a;
        wire.b = b;
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
        // Keep any terminal-bound wire endpoints synced to the current terminal geometry
        // before we rebuild the coordinate-based connectivity graph.
        this.syncWireEndpointsToTerminalRefs();

        // Union-find over "posts" (component terminals + wire endpoints).
        const parent = new Map(); // postId -> parentPostId

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
            if (root1 !== root2) parent.set(root1, root2);
        };

        // Coordinate buckets: posts at the same (quantized) coordinate belong to the same electrical node.
        const coordRepresentative = new Map(); // coordKey -> postId
        const coordTerminalCount = new Map(); // coordKey -> count of component terminals
        const coordWireEndpointCount = new Map(); // coordKey -> count of wire endpoints
        const terminalCoordKey = new Map(); // terminalKey -> coordKey

        const noteCoord = (coordKey, postId) => {
            if (!coordKey) return;
            if (!coordRepresentative.has(coordKey)) {
                coordRepresentative.set(coordKey, postId);
            } else {
                union(postId, coordRepresentative.get(coordKey));
            }
        };

        const registerTerminal = (componentId, terminalIndex, comp) => {
            const pos = getTerminalWorldPosition(comp, terminalIndex);
            const coordKey = pointKey(pos);
            const postId = `T:${componentId}:${terminalIndex}`;
            parent.set(postId, postId);
            noteCoord(coordKey, postId);
            const tKey = `${componentId}:${terminalIndex}`;
            terminalCoordKey.set(tKey, coordKey);
            coordTerminalCount.set(coordKey, (coordTerminalCount.get(coordKey) || 0) + 1);
        };

        // Register all component terminals (even if isolated; we will later mark unconnected ones as -1).
        for (const [id, comp] of this.components) {
            registerTerminal(id, 0, comp);
            registerTerminal(id, 1, comp);
            if (comp.type === 'Rheostat') {
                registerTerminal(id, 2, comp);
            }
        }

        const registerWireEndpoint = (wireId, which, pt) => {
            const coordKey = pointKey(pt);
            const postId = `W:${wireId}:${which}`;
            parent.set(postId, postId);
            noteCoord(coordKey, postId);
            coordWireEndpointCount.set(coordKey, (coordWireEndpointCount.get(coordKey) || 0) + 1);
            return postId;
        };

        // Register wire endpoints and union each wire's endpoints (ideal conductor).
        for (const wire of this.wires.values()) {
            const aPt = wire?.a;
            const bPt = wire?.b;
            if (!aPt || !bPt) continue;
            const aId = registerWireEndpoint(wire.id, 'a', aPt);
            const bId = registerWireEndpoint(wire.id, 'b', bPt);
            union(aId, bId);
        }

        // Build terminal "degree" map (junction degree at the coordinate point).
        const connectedTerminals = new Map();
        for (const [id, comp] of this.components) {
            const terminalCount = comp.type === 'Rheostat' ? 3 : 2;
            for (let ti = 0; ti < terminalCount; ti++) {
                const tKey = `${id}:${ti}`;
                const coordKey = terminalCoordKey.get(tKey);
                const wireCount = coordWireEndpointCount.get(coordKey) || 0;
                const otherTerminalCount = Math.max(0, (coordTerminalCount.get(coordKey) || 0) - 1);
                const degree = wireCount + otherTerminalCount;
                if (degree > 0) connectedTerminals.set(tKey, degree);
            }
        }
        this.terminalConnectionMap = connectedTerminals;

        // Assign node indices to union roots that contain at least one connected component terminal.
        const nodeMap = new Map(); // root -> nodeIndex
        let nodeIndex = 0;

        const assignNodeIfNeeded = (root) => {
            if (!nodeMap.has(root)) nodeMap.set(root, nodeIndex++);
        };

        const getTerminalPostId = (componentId, terminalIndex) => `T:${componentId}:${terminalIndex}`;

        // Prefer power source negative terminal as ground if it is actually connected.
        let groundRoot = null;
        for (const [id, comp] of this.components) {
            if (comp.type !== 'PowerSource') continue;
            const negKey = `${id}:1`;
            const negPostId = getTerminalPostId(id, 1);
            const root = find(negPostId);
            if (connectedTerminals.has(negKey)) {
                groundRoot = root;
                assignNodeIfNeeded(root);
                break;
            }
        }

        // If no connected power negative terminal, pick the first connected terminal as ground.
        if (!groundRoot) {
            for (const tKey of connectedTerminals.keys()) {
                const [cid, tidxRaw] = tKey.split(':');
                const tidx = Number.parseInt(tidxRaw, 10);
                const root = find(getTerminalPostId(cid, tidx));
                groundRoot = root;
                assignNodeIfNeeded(root);
                break;
            }
        }

        // If still none (completely disconnected layout), fall back to first power source negative terminal if any.
        if (!groundRoot) {
            for (const [id, comp] of this.components) {
                if (comp.type !== 'PowerSource') continue;
                const negPostId = getTerminalPostId(id, 1);
                groundRoot = find(negPostId);
                assignNodeIfNeeded(groundRoot);
                break;
            }
        }

        // Assign remaining connected roots.
        for (const tKey of connectedTerminals.keys()) {
            const [cid, tidxRaw] = tKey.split(':');
            const tidx = Number.parseInt(tidxRaw, 10);
            const root = find(getTerminalPostId(cid, tidx));
            assignNodeIfNeeded(root);
        }

        // Update component node references. Unconnected terminals remain -1 to avoid phantom currents.
        for (const [id, comp] of this.components) {
            const terminalCount = comp.type === 'Rheostat' ? 3 : 2;
            comp.nodes = Array.from({ length: terminalCount }, () => -1);
            for (let ti = 0; ti < terminalCount; ti++) {
                const tKey = `${id}:${ti}`;
                const connected = connectedTerminals.has(tKey);
                const postId = getTerminalPostId(id, ti);
                const root = find(postId);
                const mapped = nodeMap.has(root) ? nodeMap.get(root) : undefined;
                // Always allow the chosen ground root terminal to map (helps maintain a reference node).
                if ((connected || (groundRoot && root === groundRoot)) && mapped !== undefined) {
                    comp.nodes[ti] = mapped;
                }
            }
        }

        // Record which electrical node each wire belongs to (for short-circuit warnings / animations).
        for (const wire of this.wires.values()) {
            const aId = `W:${wire.id}:a`;
            if (!parent.has(aId)) {
                wire.nodeIndex = -1;
                continue;
            }
            const root = find(aId);
            wire.nodeIndex = nodeMap.has(root) ? nodeMap.get(root) : -1;
        }

        // Generate node list.
        this.nodes = Array.from({ length: nodeIndex }, (_, i) => ({ id: i }));

        // Debug: print node to terminal mapping.
        if (this.debugMode) {
            console.warn('--- Node mapping ---');
            const nodeTerminals = Array.from({ length: nodeIndex }, () => []);
            for (const [id, comp] of this.components) {
                const append = (node, terminalIdx) => {
                    if (node !== undefined && node >= 0) {
                        nodeTerminals[node].push(`${id}:${terminalIdx}`);
                    }
                };
                (comp.nodes || []).forEach((node, terminalIdx) => append(node, terminalIdx));
            }
            nodeTerminals.forEach((ts, idx) => {
                console.warn(`node ${idx}: ${ts.join(', ')}`);
            });
        }

        // Topology changed: clear flow cache
        this._wireFlowCache = { version: null, map: new Map() };

        // Detect rheostat connection modes (based on terminal degrees)
        this.detectRheostatConnections();

        // Track nodes that contain a shorted power source (both terminals on the same electrical node).
        const shorted = new Set();
        for (const comp of this.components.values()) {
            if (comp.type !== 'PowerSource') continue;
            const n0 = comp.nodes?.[0];
            const n1 = comp.nodes?.[1];
            if (n0 !== undefined && n0 >= 0 && n0 === n1) {
                shorted.add(n0);
            }
        }
        this.shortedPowerNodes = shorted;
    }

    /**
     * Sync wire endpoints that are bound to component terminals.
     * This is a UX/interaction helper: it lets wires stay attached when components move/rotate/extend terminals.
     */
    syncWireEndpointsToTerminalRefs() {
        for (const wire of this.wires.values()) {
            if (!wire) continue;
            const applyRef = (endKey) => {
                const refKey = endKey === 'a' ? 'aRef' : 'bRef';
                const ref = wire[refKey];
                const componentId = ref?.componentId;
                const terminalIndex = ref?.terminalIndex;
                if (componentId === undefined || componentId === null) return;
                if (!Number.isInteger(terminalIndex) || terminalIndex < 0) return;
                const comp = this.components.get(componentId);
                if (!comp) return;
                const pos = getTerminalWorldPosition(comp, terminalIndex);
                if (!pos) return;
                const normalizedPos = normalizeCanvasPoint(pos);
                if (!normalizedPos) return;
                wire[endKey] = normalizedPos;
            };
            applyRef('a');
            applyRef('b');
        }
    }

    /**
     * 检测滑动变阻器的连接模式
     * 确定哪些端子被实际接入电路
     */
    detectRheostatConnections() {
        for (const [id, comp] of this.components) {
            if (comp.type !== 'Rheostat') continue;
            
            // 端子是否“接入电路”：该端子所在坐标是否有其他端子/导线端点
            const terminalConnected = [false, false, false];
            for (let ti = 0; ti < 3; ti++) {
                const key = `${id}:${ti}`;
                terminalConnected[ti] = (this.terminalConnectionMap.get(key) || 0) > 0;
            }
            
            if (this.debugMode) {
                console.log(`Rheostat ${id}: terminals connected = [left:${terminalConnected[0]}, right:${terminalConnected[1]}, slider:${terminalConnected[2]}]`);
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
            
            if (this.debugMode) {
                console.log(`Rheostat ${id}: connectionMode = ${comp.connectionMode}`);
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
        this.simTime = 0;
        
        // 重置动态元器件状态
        for (const [id, comp] of this.components) {
            if (comp.type === 'Capacitor' || comp.type === 'ParallelPlateCapacitor') {
                comp.prevVoltage = 0;
                comp.prevCharge = 0;
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
            this.simTime += this.dt;
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
        const wiresByNode = new Map(); // nodeIndex -> wire[]
        const cache = new Map();

        for (const wire of this.wires.values()) {
            const nodeId = wire?.nodeIndex;
            if (nodeId === undefined || nodeId === null || nodeId < 0) continue;
            if (!wiresByNode.has(nodeId)) wiresByNode.set(nodeId, []);
            wiresByNode.get(nodeId).push(wire);
        }

        for (const [, nodeWires] of wiresByNode) {
            const nodeMap = this.computeNodeWireFlow(nodeWires, results);
            for (const [wireId, info] of nodeMap) {
                cache.set(wireId, info);
            }
        }

        return cache;
    }

    computeNodeWireFlow(nodeWires, results) {
        const physical = this.computeNodeWireFlowPhysical(nodeWires, results);
        if (physical) return physical;
        const nodeResult = new Map();
        for (const wire of nodeWires || []) {
            nodeResult.set(wire.id, { flowDirection: 0, currentMagnitude: 0 });
        }
        return nodeResult;
    }

    /**
     * Compute wire currents inside a single electrical node by solving a resistive
     * network on the wire graph (unit conductance per wire).
     *
     * This produces a KCL-consistent, physically-plausible distribution and avoids
     * "phantom current" on bridge wires that connect equipotential points.
     *
     * @param {Object[]} nodeWires
     * @param {Object} results
     * @returns {Map<string, {flowDirection:number, currentMagnitude:number}>|null}
     */
    computeNodeWireFlowPhysical(nodeWires, results) {
        if (!nodeWires || nodeWires.length === 0) return new Map();
        const nodeId = nodeWires[0]?.nodeIndex;
        if (nodeId === undefined || nodeId === null || nodeId < 0) return null;

        // Build vertices from wire endpoint coordinates within this electrical node.
        const keys = [];
        const indexOfKey = new Map(); // coordKey -> idx
        const ensureVertex = (coordKey) => {
            if (!coordKey) return null;
            if (indexOfKey.has(coordKey)) return indexOfKey.get(coordKey);
            const idx = keys.length;
            indexOfKey.set(coordKey, idx);
            keys.push(coordKey);
            return idx;
        };

        const edges = [];
        const degrees = [];
        for (const wire of nodeWires) {
            const aKey = pointKey(wire?.a);
            const bKey = pointKey(wire?.b);
            const u = ensureVertex(aKey);
            const v = ensureVertex(bKey);
            if (u === null || v === null) continue;
            edges.push({ wireId: wire.id, startIdx: u, endIdx: v, conductance: 1 });
        }

        const n = keys.length;
        if (n <= 1 || edges.length === 0) {
            const nodeResult = new Map();
            for (const wire of nodeWires) {
                nodeResult.set(wire.id, { flowDirection: 0, currentMagnitude: 0 });
            }
            return nodeResult;
        }

        // Degree heuristic for picking a stable anchor (reference vertex).
        for (let i = 0; i < n; i++) degrees[i] = 0;
        for (const edge of edges) {
            const u = edge.startIdx;
            const v = edge.endIdx;
            if (u === v) continue;
            degrees[u] += 1;
            degrees[v] += 1;
        }
        let anchor = 0;
        for (let i = 1; i < n; i++) {
            if ((degrees[i] || 0) > (degrees[anchor] || 0)) anchor = i;
        }

        // Injection per vertex: sum of component terminal flows at this coordinate.
        const injections = new Array(n).fill(0);
        const tiny = 1e-12;
        for (const comp of this.components.values()) {
            if (!Array.isArray(comp.nodes)) continue;
            for (let ti = 0; ti < comp.nodes.length; ti++) {
                if (comp.nodes[ti] !== nodeId) continue;
                const pos = getTerminalWorldPosition(comp, ti);
                const vKey = pointKey(pos);
                if (!vKey || !indexOfKey.has(vKey)) continue;
                const idx = indexOfKey.get(vKey);
                const rawFlow = this.getTerminalCurrentFlow(comp, ti, results);
                const flow = Math.abs(rawFlow) < tiny ? 0 : rawFlow;
                injections[idx] += flow;
            }
        }

        const size = n - 1;
        const A = Array.from({ length: size }, () => Array(size).fill(0));
        const b = Array(size).fill(0);
        const toReduced = (idx) => (idx < anchor ? idx : idx - 1);

        for (let i = 0; i < n; i++) {
            if (i === anchor) continue;
            b[toReduced(i)] = injections[i] || 0;
        }

        for (const edge of edges) {
            const u = edge.startIdx;
            const v = edge.endIdx;
            const g = edge.conductance;
            if (u === v) continue;

            if (u !== anchor) {
                const ui = toReduced(u);
                A[ui][ui] += g;
            }
            if (v !== anchor) {
                const vi = toReduced(v);
                A[vi][vi] += g;
            }
            if (u !== anchor && v !== anchor) {
                const ui = toReduced(u);
                const vi = toReduced(v);
                A[ui][vi] -= g;
                A[vi][ui] -= g;
            }
        }

        const x = Matrix.solve(A, b);
        if (!x) return null;

        const potentials = new Array(n).fill(0);
        for (let i = 0; i < n; i++) {
            if (i === anchor) continue;
            potentials[i] = x[toReduced(i)] || 0;
        }

        const eps = 1e-9;
        const nodeResult = new Map();
        for (const wire of nodeWires) {
            nodeResult.set(wire.id, { flowDirection: 0, currentMagnitude: 0 });
        }
        for (const edge of edges) {
            const u = edge.startIdx;
            const v = edge.endIdx;
            const g = edge.conductance;
            const current = g * ((potentials[u] || 0) - (potentials[v] || 0));
            let mag = Math.abs(current);
            let dir = 0;
            if (mag >= eps) {
                dir = current > 0 ? 1 : -1;
            } else {
                mag = 0;
            }
            nodeResult.set(edge.wireId, { flowDirection: dir, currentMagnitude: mag });
        }

        return nodeResult;
    }

    computeNodeWireFlowHeuristic(nodeWires, results) {
        return null;
    }

    // Model C: wires are ideal conductors and junctions are represented by endpoints.
    // Wire current display is derived from node-internal flow solving (computeWireFlowCache),
    // so we no longer need control-point/junction heuristics here.

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
     * Whether a wire is on a node that contains a shorted power source.
     * This is a topology-only check; it does not depend on the solver result.
     * @param {Object} wire
     * @returns {boolean}
     */
    isWireInShortCircuit(wire) {
        if (!wire) return false;
        const node = Number.isFinite(wire.nodeIndex) ? wire.nodeIndex : -1;
        if (node < 0) return false;
        return !!(this.shortedPowerNodes && this.shortedPowerNodes.has(node));
    }

    /**
     * 获取导线的电流信息
     * @param {Object} wire - 导线对象
     * @param {Object} results - 求解结果
     * @returns {Object} 包含电流、电势和短路信息
     */
    getWireCurrentInfo(wire, results) {
        if (!wire || !results || !results.valid) return null;

        const nodeId = Number.isFinite(wire.nodeIndex) ? wire.nodeIndex : -1;
        const nodeVoltage = nodeId >= 0 ? (results.voltages[nodeId] || 0) : 0;
        const isShorted = this.isWireInShortCircuit(wire);

        if (isShorted) {
            return {
                current: 0,
                voltage1: nodeVoltage,
                voltage2: nodeVoltage,
                isShorted: true,
                flowDirection: 0,
                voltageDiff: 0
            };
        }

        this.ensureWireFlowCache(results);
        const cachedFlow = this._wireFlowCache.map.get(wire.id);
        const current = cachedFlow ? (cachedFlow.currentMagnitude || 0) : 0;
        const flowDirection = cachedFlow ? (cachedFlow.flowDirection || 0) : 0;

        return {
            current,
            voltage1: nodeVoltage,
            voltage2: nodeVoltage,
            isShorted: false,
            flowDirection,
            voltageDiff: 0
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
        this.terminalConnectionMap = new Map();
        this._wireFlowCache = { version: null, map: new Map() };
        this.shortedPowerNodes = new Set();
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
                version: '2.0',
                timestamp: Date.now(),
                name: '电路设计'
            },
            components: Array.from(this.components.values()).map(comp => ({
                id: comp.id,
                type: comp.type,
                label: comp.label || null,  // 包含自定义标签
                x: toCanvasInt(comp.x),
                y: toCanvasInt(comp.y),
                rotation: comp.rotation || 0,
                properties: this.getComponentProperties(comp),
                display: comp.display || null,
                terminalExtensions: comp.terminalExtensions || null
            })),
            wires: Array.from(this.wires.values()).map(wire => ({
                id: wire.id,
                a: { x: toCanvasInt(wire?.a?.x ?? 0), y: toCanvasInt(wire?.a?.y ?? 0) },
                b: { x: toCanvasInt(wire?.b?.x ?? 0), y: toCanvasInt(wire?.b?.y ?? 0) },
                ...(wire?.aRef ? { aRef: wire.aRef } : {}),
                ...(wire?.bRef ? { bRef: wire.bRef } : {})
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
            case 'ParallelPlateCapacitor':
                return {
                    plateArea: comp.plateArea,
                    plateDistance: comp.plateDistance,
                    dielectricConstant: comp.dielectricConstant,
                    plateOffsetYPx: comp.plateOffsetYPx,
                    explorationMode: comp.explorationMode,
                    capacitance: comp.capacitance
                };
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
                    range: comp.range,
                    selfReading: !!comp.selfReading
                };
            case 'Voltmeter':
                return {
                    resistance: comp.resistance,
                    range: comp.range,
                    selfReading: !!comp.selfReading
                };
            case 'BlackBox':
                return {
                    boxWidth: comp.boxWidth,
                    boxHeight: comp.boxHeight,
                    viewMode: comp.viewMode === 'opaque' ? 'opaque' : 'transparent'
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
                toCanvasInt(compData.x),
                toCanvasInt(compData.y),
                compData.id  // 使用保存的ID
            );
            
            // 恢复保存的属性
            comp.rotation = compData.rotation || 0;
            if (compData.label) {
                comp.label = compData.label;  // 恢复自定义标签
            }
            Object.assign(comp, compData.properties);

            // 平行板电容：始终用物理参数刷新电容值，避免保存文件中 C 与参数不一致
            if (comp.type === 'ParallelPlateCapacitor') {
                const plateLengthPx = 24;
                const overlapFraction = computeOverlapFractionFromOffsetPx(comp.plateOffsetYPx || 0, plateLengthPx);
                comp.capacitance = computeParallelPlateCapacitance({
                    plateArea: comp.plateArea,
                    plateDistance: comp.plateDistance,
                    dielectricConstant: comp.dielectricConstant,
                    overlapFraction
                });
            }

            // 恢复数值显示开关（单元件配置）
            if (compData.display && typeof compData.display === 'object') {
                comp.display = {
                    ...(comp.display || {}),
                    ...compData.display
                };
            }

            // 恢复端子延伸
            if (compData.terminalExtensions) {
                // Normalize to integer pixels for stable connectivity.
                const normalized = {};
                for (const [k, v] of Object.entries(compData.terminalExtensions)) {
                    if (!v || typeof v !== 'object') continue;
                    const x = toCanvasInt(v.x || 0);
                    const y = toCanvasInt(v.y || 0);
                    normalized[k] = { x, y };
                }
                comp.terminalExtensions = normalized;
            }
            
            this.components.set(comp.id, comp);
        }

        // 导入导线
        const ensureUniqueWireId = (baseId) => {
            if (!this.wires.has(baseId)) return baseId;
            let i = 1;
            while (this.wires.has(`${baseId}_${i}`)) i++;
            return `${baseId}_${i}`;
        };

        const safePoint = (pt) => {
            return normalizeCanvasPoint(pt);
        };

        const getTerminalPoint = (componentId, terminalIndex) => {
            const comp = this.components.get(componentId);
            if (!comp) return null;
            return safePoint(getTerminalWorldPosition(comp, terminalIndex));
        };

        for (const wireData of json.wires || []) {
            if (!wireData || !wireData.id) continue;

            // v2 format: explicit endpoints (a/b points)
            if (wireData.a && wireData.b) {
                const a = safePoint(wireData.a);
                const b = safePoint(wireData.b);
                if (!a || !b) continue;
                const id = ensureUniqueWireId(wireData.id);
                const wire = { id, a, b };
                if (wireData.aRef) wire.aRef = wireData.aRef;
                if (wireData.bRef) wire.bRef = wireData.bRef;
                this.wires.set(id, wire);
                continue;
            }

            // Legacy formats: start/end component terminal references (optionally with controlPoints polyline)
            const startRef = wireData.start
                ? { componentId: wireData.start.componentId, terminalIndex: wireData.start.terminalIndex }
                : (wireData.startComponentId != null
                    ? { componentId: wireData.startComponentId, terminalIndex: wireData.startTerminalIndex }
                    : null);
            const endRef = wireData.end
                ? { componentId: wireData.end.componentId, terminalIndex: wireData.end.terminalIndex }
                : (wireData.endComponentId != null
                    ? { componentId: wireData.endComponentId, terminalIndex: wireData.endTerminalIndex }
                    : null);

            if (!startRef || !endRef) continue;

            const start = getTerminalPoint(startRef.componentId, startRef.terminalIndex);
            const end = getTerminalPoint(endRef.componentId, endRef.terminalIndex);
            if (!start || !end) continue;

            const controlPoints = Array.isArray(wireData.controlPoints) ? wireData.controlPoints : [];
            const poly = [start, ...controlPoints.map(safePoint).filter(Boolean), end];

            // Convert polyline into multiple 2-terminal wire segments.
            for (let i = 0; i < poly.length - 1; i++) {
                const a = poly[i];
                const b = poly[i + 1];
                if (!a || !b) continue;
                const segBase = i === 0 ? wireData.id : `${wireData.id}_${i}`;
                const id = ensureUniqueWireId(segBase);
                const seg = { id, a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y } };
                if (i === 0) seg.aRef = startRef;
                if (i === poly.length - 2) seg.bRef = endRef;
                this.wires.set(id, seg);
            }
        }

        this.rebuildNodes();
    }
}
