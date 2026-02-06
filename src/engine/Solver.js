/**
 * Solver.js - MNA（改进节点分析法）求解器
 * 实现电路的稳态和瞬态分析
 */

import { Matrix } from './Matrix.js';

const DynamicIntegrationMethods = Object.freeze({
    Auto: 'auto',
    Trapezoidal: 'trapezoidal',
    BackwardEuler: 'backward-euler'
});

export class MNASolver {
    constructor() {
        this.nodes = [];           // 节点列表
        this.components = [];       // 元器件列表
        this.groundNode = 0;        // 接地节点（参考节点）
        this.voltageSourceCount = 0; // 电压源数量（用于扩展矩阵）
        this.dt = 0.001;            // 时间步长（秒）
        this.simTime = 0;           // 当前仿真时刻（秒）
        // gmin 稳定化：给每个非接地节点加一个极小的对地电导，避免“悬浮子电路”导致矩阵奇异
        // 取值为 1e-12 S (≈ 1e12Ω) 基本不影响正常高中电路数值，但能显著提升鲁棒性
        this.gmin = 1e-12;
        this.hasConnectedSwitch = false;
    }

    /**
     * 设置电路数据
     * @param {Object[]} components - 元器件数组
     * @param {Object[]} nodes - 节点数组
     */
    setCircuit(components, nodes) {
        this.components = components;
        this.nodes = nodes;
        this.voltageSourceCount = 0;
        this.shortCircuitDetected = false;
        this.hasConnectedSwitch = false;
        const isValidNode = (nodeIdx) => nodeIdx !== undefined && nodeIdx !== null && nodeIdx >= 0;
        
        // 检测并标记被短路的元器件（两端节点相同）
        for (const comp of components) {
            comp.vsIndex = undefined;
            if (comp.type === 'Ground') {
                comp._isShorted = false;
                continue;
            }
            if (comp.nodes && comp.nodes.length >= 2) {
                const n1 = comp.nodes[0];
                const n2 = comp.nodes[1];
                // 如果两端节点相同且有效，说明被短路了
                comp._isShorted = (n1 === n2 && n1 >= 0);
                
                // 电源被短路是危险的
                if (comp._isShorted && (comp.type === 'PowerSource' || comp.type === 'ACVoltageSource')) {
                    this.shortCircuitDetected = true;
                    console.warn(`Power source ${comp.id} is short-circuited!`);
                }
            } else {
                comp._isShorted = false;
            }
        }
        
        // 统计电压源数量
        // 注意：有内阻的电源使用诺顿等效，不计入电压源
        // 被短路的电源不作为电压源处理
        for (const comp of components) {
            if (comp.type === 'PowerSource' || comp.type === 'ACVoltageSource') {
                const n1 = comp.nodes?.[0];
                const n2 = comp.nodes?.[1];
                // 只有零内阻且未被短路的电源才使用电压源模型
                if (!comp.internalResistance || comp.internalResistance < 1e-9) {
                    if (!comp._isShorted) {
                        if (isValidNode(n1) && isValidNode(n2)) {
                            comp.vsIndex = this.voltageSourceCount++;
                        }
                    }
                }
            } else if (comp.type === 'Motor') {
                if (!comp._isShorted) {
                    const n1 = comp.nodes?.[0];
                    const n2 = comp.nodes?.[1];
                    if (isValidNode(n1) && isValidNode(n2)) {
                        comp.vsIndex = this.voltageSourceCount++;
                    }
                }
            } else if (comp.type === 'Ammeter') {
                // 理想电流表使用电压源（V=0）来测量电流
                if (!comp.resistance || comp.resistance <= 0) {
                    if (!comp._isShorted) {
                        const n1 = comp.nodes?.[0];
                        const n2 = comp.nodes?.[1];
                        if (isValidNode(n1) && isValidNode(n2)) {
                            comp.vsIndex = this.voltageSourceCount++;
                        }
                    }
                }
            }

            if (comp.type === 'Inductor' && !Number.isFinite(comp.prevCurrent)) {
                comp.prevCurrent = Number.isFinite(comp.initialCurrent) ? comp.initialCurrent : 0;
            }
            if (comp.type === 'Inductor' && !Number.isFinite(comp.prevVoltage)) {
                comp.prevVoltage = 0;
            }
            if ((comp.type === 'Capacitor' || comp.type === 'ParallelPlateCapacitor') && !Number.isFinite(comp.prevCurrent)) {
                comp.prevCurrent = 0;
            }
            if ((comp.type === 'Capacitor' || comp.type === 'ParallelPlateCapacitor') && !Number.isFinite(comp.prevVoltage)) {
                comp.prevVoltage = 0;
            }
            if (comp.type === 'Switch') {
                const n1 = comp.nodes?.[0];
                const n2 = comp.nodes?.[1];
                if (isValidNode(n1) && isValidNode(n2)) {
                    this.hasConnectedSwitch = true;
                }
            }
        }
    }

    /**
     * 求解电路
     * @param {number} dt - 时间步长
     * @returns {Object} 解结果，包含节点电压和支路电流
     */
    solve(dt = 0.001, simTime = 0) {
        this.dt = dt;
        this.simTime = Number.isFinite(simTime) ? simTime : 0;
        
        const nodeCount = this.nodes.length;
        if (nodeCount < 2) {
            const voltages = Array.from({ length: nodeCount }, () => 0);
            const currents = new Map();
            for (const comp of this.components) {
                currents.set(comp.id, 0);
            }
            return { voltages, currents, valid: true };
        }

        // 矩阵大小：节点数-1（去掉地节点）+ 电压源数
        const n = nodeCount - 1 + this.voltageSourceCount;
        
        if (n <= 0) {
            const voltages = Array.from({ length: nodeCount }, () => 0);
            const currents = new Map();
            for (const comp of this.components) {
                currents.set(comp.id, 0);
            }
            return { voltages, currents, valid: true };
        }

        // 创建MNA矩阵和向量
        const A = Matrix.zeros(n, n);
        const z = Matrix.zeroVector(n);

        // 为每个元器件添加印记（stamp）
        for (const comp of this.components) {
            this.stampComponent(comp, A, z, nodeCount);
        }

        // gmin 稳定化：给每个非接地节点加一个极小对地电导
        // 目的：当画布上存在与参考地完全断开的“悬浮子电路”时，仍可得到可解的方程组
        if (this.gmin > 0) {
            for (let i = 0; i < nodeCount - 1; i++) {
                A[i][i] += this.gmin;
            }
        }

        // 调试输出矩阵
        if (this.debugMode) {
            console.log('MNA Matrix A:');
            for (let i = 0; i < n; i++) {
                console.log(`  [${A[i].map(v => v.toFixed(4)).join(', ')}]`);
            }
            console.log('Vector z:', z.map(v => v.toFixed(4)));
        }

        // 求解
        const x = Matrix.solve(A, z);
        
        if (!x) {
            console.warn('Matrix solve failed');
            return { voltages: [], currents: new Map(), valid: false };
        }

        if (this.debugMode) {
            console.log('Solution x:', x.map(v => v.toFixed(4)));
        }

        // 提取节点电压（添加地节点的0电压）
        const voltages = [0]; // 节点0是地
        for (let i = 0; i < nodeCount - 1; i++) {
            voltages.push(x[i] || 0);
        }

        // 计算各元器件的电流
        const currents = new Map();
        for (const comp of this.components) {
            const current = this.calculateCurrent(comp, voltages, x, nodeCount);
            currents.set(comp.id, current);
            
            if (this.debugMode) {
                console.log(`Current for ${comp.id}: ${current.toFixed(6)}A`);
            }
        }

        return { voltages, currents, valid: true };
    }

    /**
     * 为元器件添加MNA印记
     * @param {Object} comp - 元器件
     * @param {number[][]} A - 系数矩阵
     * @param {number[]} z - 常数向量
     * @param {number} nodeCount - 节点数量
     */
    stampComponent(comp, A, z, nodeCount) {
        if (comp.type === 'Ground') {
            return;
        }

        // 安全检查：确保 nodes 数组存在且有效
        if (!comp.nodes || comp.nodes.length < 2) {
            console.warn(`Component ${comp.id} has no valid nodes array`);
            return;
        }
        
        // 如果元器件被短路，跳过stamp（除了特殊处理的情况）
        if (comp._isShorted) {
            // 被短路的元器件不参与电路计算
            // 但需要记录状态以便显示
            return;
        }
        
        const n1 = comp.nodes[0]; // 正极节点
        const n2 = comp.nodes[1]; // 负极节点
        const isValidNode = (nodeIdx) => nodeIdx !== undefined && nodeIdx >= 0;
        
        // 检查节点是否有效（滑动变阻器在后续分支中单独判断）
        if (comp.type !== 'Rheostat' && (!isValidNode(n1) || !isValidNode(n2))) {
            return;
        }
        
        // 将节点索引转换为矩阵索引（去掉地节点0）
        const toMatrixIndex = (nodeIdx) => (isValidNode(nodeIdx) ? nodeIdx - 1 : null);
        const i1 = toMatrixIndex(n1);
        const i2 = toMatrixIndex(n2);
        
        if (this.debugMode) {
            console.log(`Stamp ${comp.type} ${comp.id}: nodes=[${n1},${n2}], matrix idx=[${i1},${i2}]`);
        }

        switch (comp.type) {
            case 'Resistor':
            case 'Bulb':
                this.stampResistor(A, i1, i2, comp.resistance);
                break;
                
            case 'Rheostat': {
                // 滑动变阻器模型：根据连接模式决定如何stamp
                // 内部结构：端子0(左) -- R1 -- 端子2(滑动触点) -- R2 -- 端子1(右)
                // 总电阻 = maxR，按位置分配
                const minR = comp.minResistance ?? 0;
                const maxR = comp.maxResistance ?? 100;
                const position = comp.position == null ? 0.5 : Math.min(Math.max(comp.position, 0), 1);
                const range = Math.max(0, maxR - minR);
                // R1 = 左端到滑块的电阻（支持 minResistance）
                const R1 = Math.max(1e-9, minR + range * position);
                // R2 = 滑块到右端的电阻（支持 minResistance）
                const R2 = Math.max(1e-9, maxR - range * position);
                
                // 获取三个节点
                const n_left = comp.nodes[0];
                const n_right = comp.nodes[1];
                const n_slider = comp.nodes[2];
                
                // 转换为矩阵索引，仅对有效节点进行转换
                const leftValid = isValidNode(n_left);
                const rightValid = isValidNode(n_right);
                const sliderValid = isValidNode(n_slider);
                const i_left = leftValid ? n_left - 1 : null;
                const i_right = rightValid ? n_right - 1 : null;
                const i_slider = sliderValid ? n_slider - 1 : null;
                
                const debugWarn = (...args) => {
                    if (this.debugMode) console.warn(...args);
                };

                debugWarn(`[Rheostat] nodes=[${n_left},${n_right},${n_slider}], idx=[${i_left},${i_right},${i_slider}], mode=${comp.connectionMode}, R1=${R1.toFixed(2)}, R2=${R2.toFixed(2)}`);
                
                // 根据连接模式决定stamp方式
                switch (comp.connectionMode) {
                    case 'left-slider':
                        debugWarn('  -> left-slider mode');
                        if (leftValid && sliderValid) {
                            this.stampResistor(A, i_left, i_slider, R1);
                        }
                        break;
                    case 'right-slider':
                        debugWarn('  -> right-slider mode');
                        if (sliderValid && rightValid) {
                            this.stampResistor(A, i_slider, i_right, R2);
                        }
                        break;
                    case 'left-right':
                        debugWarn('  -> left-right mode');
                        if (leftValid && rightValid) {
                            this.stampResistor(A, i_left, i_right, Math.max(1e-9, maxR));
                        }
                        break;
                    case 'all': {
                        // 三端都接入：需要根据节点连接情况判断
                        const leftEqSlider = (n_left === n_slider);
                        const rightEqSlider = (n_right === n_slider);
                        const leftEqRight = (n_left === n_right);
                        
                        debugWarn(`  -> all mode: L=S:${leftEqSlider}, R=S:${rightEqSlider}, L=R:${leftEqRight}`);
                        
                        if (leftEqSlider && rightEqSlider) {
                            debugWarn('    => completely shorted');
                        } else if (leftEqSlider) {
                            debugWarn('    => R1 shorted, stamp R2');
                            if (sliderValid && rightValid) {
                                this.stampResistor(A, i_slider, i_right, R2);
                            }
                        } else if (rightEqSlider) {
                            debugWarn('    => R2 shorted, stamp R1');
                            if (leftValid && sliderValid) {
                                this.stampResistor(A, i_left, i_slider, R1);
                            }
                        } else if (leftEqRight) {
                            const R_parallel = (R1 * R2) / (R1 + R2);
                            debugWarn(`    => R1||R2 = ${R_parallel.toFixed(2)}`);
                            if (leftValid && sliderValid) {
                                this.stampResistor(A, i_left, i_slider, R_parallel);
                            }
                        } else {
                            debugWarn('    => normal 3-terminal');
                            if (leftValid && sliderValid) {
                                this.stampResistor(A, i_left, i_slider, R1);
                            }
                            if (sliderValid && rightValid) {
                                this.stampResistor(A, i_slider, i_right, R2);
                            }
                        }
                        break;
                    }
                    default:
                        debugWarn('  -> disconnected');
                        break;
                }
                break;
            }
                
            case 'PowerSource':
            case 'ACVoltageSource':
                // 电源模型：电动势 E 串联内阻 r
                // 使用戴维南等效：
                // 理想电压源 E 串联电阻 r 可以等效为：
                // 在节点间放置电阻 r，并添加一个电流源 I = E/r
                // 或者更简单：使用电压源的扩展MNA模型
                
                // 方法：使用带内阻的电压源模型
                // 在 MNA 中，理想电压源会强制两节点间电压为 V
                // 内阻串联需要引入额外节点，这里用简化方法：
                // 将电源建模为 E 串联 r，使用诺顿等效
                // 诺顿等效电流源 I_N = E / r，并联电阻 r
                const sourceVoltage = this.getSourceInstantVoltage(comp);
                
                if (comp.internalResistance > 1e-9) {
                    // 使用诺顿等效电路：电流源 I = E/r 并联电阻 r
                    const I_norton = sourceVoltage / comp.internalResistance;
                    const G = 1 / comp.internalResistance;
                    
                    // 添加并联电导
                    if (i1 >= 0) A[i1][i1] += G;
                    if (i2 >= 0) A[i2][i2] += G;
                    if (i1 >= 0 && i2 >= 0) {
                        A[i1][i2] -= G;
                        A[i2][i1] -= G;
                    }
                    
                    // 添加电流源 (从i2流向i1，即正极是i1)
                    if (i1 >= 0) z[i1] += I_norton;
                    if (i2 >= 0) z[i2] -= I_norton;
                    
                    // 仍然需要记录电压源以便计算电流
                    // 但不再添加到矩阵中
                    comp._nortonModel = true;
                } else {
                    // 内阻为0时，使用理想电压源
                    this.stampVoltageSource(A, z, i1, i2, sourceVoltage, comp.vsIndex, nodeCount);
                    comp._nortonModel = false;
                }
                break;
                
            case 'Capacitor':
            case 'ParallelPlateCapacitor': {
                const method = this.resolveDynamicIntegrationMethod(comp);
                const C = Math.max(1e-18, comp.capacitance || 0);
                if (method === DynamicIntegrationMethods.Trapezoidal) {
                    // 梯形法伴随模型（Norton）：R = dt/(2C), Ieq = -(v_prev/R + i_prev)
                    const Req = this.dt / (2 * C);
                    this.stampResistor(A, i1, i2, Req);
                    const prevVoltage = Number.isFinite(comp.prevVoltage) ? comp.prevVoltage : 0;
                    const prevCurrent = Number.isFinite(comp.prevCurrent) ? comp.prevCurrent : 0;
                    const Ieq = -(prevVoltage / Req + prevCurrent);
                    this.stampCurrentSource(z, i1, i2, Ieq);
                } else {
                    // 后向欧拉：I = (C_new * V_new - Q_prev) / dt
                    // 等效为：导纳 G = C_new / dt，并联电流源 Ieq = Q_prev / dt（方向：从负极到正极）
                    const Req = this.dt / C;
                    this.stampResistor(A, i1, i2, Req);
                    const Qprev = comp.prevCharge || 0;
                    const Ieq = Qprev / this.dt;
                    if (i1 >= 0) z[i1] += Ieq;
                    if (i2 >= 0) z[i2] -= Ieq;
                }
                break;
            }

            case 'Inductor': {
                const method = this.resolveDynamicIntegrationMethod(comp);
                const L = Math.max(1e-12, comp.inductance || 0);
                const prevCurrent = Number.isFinite(comp.prevCurrent)
                    ? comp.prevCurrent
                    : (Number.isFinite(comp.initialCurrent) ? comp.initialCurrent : 0);
                if (method === DynamicIntegrationMethods.Trapezoidal) {
                    // 梯形法伴随模型（Norton）：R = 2L/dt, Ieq = i_prev + v_prev/R
                    const Req = (2 * L) / this.dt;
                    this.stampResistor(A, i1, i2, Req);
                    const prevVoltage = Number.isFinite(comp.prevVoltage) ? comp.prevVoltage : 0;
                    const Ieq = prevCurrent + (prevVoltage / Req);
                    this.stampCurrentSource(z, i1, i2, Ieq);
                } else {
                    // 后向欧拉伴随模型：R = L/dt, Ieq = i_prev
                    const Req = L / this.dt;
                    this.stampResistor(A, i1, i2, Req);
                    this.stampCurrentSource(z, i1, i2, prevCurrent);
                }
                break;
            }
                
            case 'Motor':
                // 电动机模型：电阻串联反电动势
                // 简化模型：电阻串联一个电压源
                this.stampResistor(A, i1, i2, comp.resistance);
                // 反电动势作为电压源处理
                const backEmf = comp.backEmf || 0;
                this.stampVoltageSource(A, z, i1, i2, -backEmf, comp.vsIndex, nodeCount);
                break;
                
            case 'Switch':
                // 开关模型
                if (comp.closed) {
                    // 闭合状态：理想导线（极小电阻）
                    this.stampResistor(A, i1, i2, 1e-9);
                } else {
                    // 断开状态：极大电阻（相当于开路）
                    this.stampResistor(A, i1, i2, 1e12);
                }
                break;
                
            case 'Ammeter':
                // 电流表模型
                if (comp.resistance > 0) {
                    // 有内阻的电流表
                    this.stampResistor(A, i1, i2, comp.resistance);
                } else {
                    // 理想电流表：使用电压源（V=0）来测量电流
                    this.stampVoltageSource(A, z, i1, i2, 0, comp.vsIndex, nodeCount);
                }
                break;
                
            case 'Voltmeter':
                // 电压表模型
                // resistance 可能是 null, undefined, Infinity 或正数
                const vmResistance = comp.resistance;
                if (vmResistance !== null && vmResistance !== undefined && 
                    vmResistance !== Infinity && vmResistance > 0) {
                    // 有内阻的电压表
                    this.stampResistor(A, i1, i2, vmResistance);
                }
                // 理想电压表：不连入电路（无穷大电阻），仅测量电压
                // 不需要添加任何印记
                break;
        }
    }

    /**
     * 电阻印记
     * @param {number[][]} A - 系数矩阵
     * @param {number} i1 - 节点1的矩阵索引
     * @param {number} i2 - 节点2的矩阵索引
     * @param {number} R - 电阻值
     */
    stampResistor(A, i1, i2, R) {
        if (R <= 0) R = 1e-9; // 避免除零
        const G = 1 / R;
        
        if (i1 >= 0) A[i1][i1] += G;
        if (i2 >= 0) A[i2][i2] += G;
        if (i1 >= 0 && i2 >= 0) {
            A[i1][i2] -= G;
            A[i2][i1] -= G;
        }
    }

    /**
     * 电流源印记（电流方向：nodeFrom -> nodeTo）
     * @param {number[]} z - 常数向量
     * @param {number} iFrom - 起点节点矩阵索引
     * @param {number} iTo - 终点节点矩阵索引
     * @param {number} current - 电流值（A）
     */
    stampCurrentSource(z, iFrom, iTo, current) {
        if (!Number.isFinite(current) || Math.abs(current) < 1e-18) return;
        if (iFrom >= 0) z[iFrom] -= current;
        if (iTo >= 0) z[iTo] += current;
    }

    /**
     * 电压源印记
     * @param {number[][]} A - 系数矩阵
     * @param {number[]} z - 常数向量
     * @param {number} i1 - 正极节点的矩阵索引
     * @param {number} i2 - 负极节点的矩阵索引
     * @param {number} V - 电压值
     * @param {number} vsIndex - 电压源索引
     * @param {number} nodeCount - 节点数量
     */
    stampVoltageSource(A, z, i1, i2, V, vsIndex, nodeCount) {
        const k = nodeCount - 1 + vsIndex; // 电流变量在矩阵中的位置
        
        // 电压约束行
        if (i1 >= 0) A[k][i1] = 1;
        if (i2 >= 0) A[k][i2] = -1;
        
        // KCL贡献列
        if (i1 >= 0) A[i1][k] = 1;
        if (i2 >= 0) A[i2][k] = -1;
        
        // 电压值
        z[k] = V;
    }

    /**
     * 计算元器件电流
     * @param {Object} comp - 元器件
     * @param {number[]} voltages - 节点电压数组
     * @param {number[]} x - 解向量
     * @param {number} nodeCount - 节点数量
     * @returns {number} 电流值
     */
    calculateCurrent(comp, voltages, x, nodeCount) {
        if (comp.type === 'Ground') {
            return 0;
        }

        // 被短路的元器件电流为0（两端没有电势差）
        if (comp._isShorted) {
            return 0;
        }

        // IMPORTANT: Components that are not fully wired into the circuit have invalid node indices (-1).
        // They are skipped during stamping, so their current must be forced to 0 here as well.
        // Otherwise we can leak "phantom" currents into wire animation logic via results.currents.
        const isValidNode = (nodeIdx) => nodeIdx !== undefined && nodeIdx !== null && nodeIdx >= 0;
        if (comp.type !== 'Rheostat') {
            if (!comp.nodes || !isValidNode(comp.nodes[0]) || !isValidNode(comp.nodes[1])) {
                return 0;
            }
        } else {
            const mode = comp.connectionMode || 'none';
            const nLeft = comp.nodes?.[0];
            const nRight = comp.nodes?.[1];
            const nSlider = comp.nodes?.[2];
            const leftValid = isValidNode(nLeft);
            const rightValid = isValidNode(nRight);
            const sliderValid = isValidNode(nSlider);
            switch (mode) {
                case 'left-slider':
                    if (!leftValid || !sliderValid) return 0;
                    break;
                case 'right-slider':
                    if (!rightValid || !sliderValid) return 0;
                    break;
                case 'left-right':
                    if (!leftValid || !rightValid) return 0;
                    break;
                case 'all':
                    if (!leftValid || !rightValid || !sliderValid) return 0;
                    break;
                default:
                    return 0;
            }
        }
        
        const v1 = voltages[comp.nodes[0]] || 0;
        const v2 = voltages[comp.nodes[1]] || 0;
        const dV = v1 - v2;

        switch (comp.type) {
            case 'Resistor':
            case 'Bulb':
                return comp.resistance > 0 ? dV / comp.resistance : 0;
                
            case 'Rheostat': {
                // 滑动变阻器电流计算 - 根据连接模式
                // 安全获取电压值，未连接的端子电压视为0
                const getVoltage = (nodeIdx) => {
                    if (nodeIdx === undefined || nodeIdx < 0) return 0;
                    return voltages[nodeIdx] || 0;
                };
                
                const v_left = getVoltage(comp.nodes[0]);
                const v_right = getVoltage(comp.nodes[1]);
                const v_slider = getVoltage(comp.nodes[2]);
                
                const minR = comp.minResistance ?? 0;
                const maxR = comp.maxResistance ?? 100;
                const position = comp.position == null ? 0.5 : Math.min(Math.max(comp.position, 0), 1);
                const range = Math.max(0, maxR - minR);
                const R1 = Math.max(1e-9, minR + range * position);
                const R2 = Math.max(1e-9, maxR - range * position);
                
                switch (comp.connectionMode) {
                    case 'left-slider':
                        // 左端到滑块的电流
                        return (v_left - v_slider) / R1;
                    case 'right-slider':
                        // 滑块到右端的电流
                        return (v_slider - v_right) / R2;
                    case 'left-right':
                        // 全阻值
                        return (v_left - v_right) / Math.max(1e-9, maxR);
                    case 'all': {
                        // 三端都连接，根据节点连接情况计算电流
                        const n_left = comp.nodes[0];
                        const n_right = comp.nodes[1];
                        const n_slider = comp.nodes[2];
                        
                        const leftEqSlider = (n_left === n_slider);
                        const rightEqSlider = (n_right === n_slider);
                        const leftEqRight = (n_left === n_right);
                        
                        if (leftEqSlider && rightEqSlider) {
                            // 完全短路
                            return 0;
                        } else if (leftEqSlider) {
                            // R1短路，只有R2
                            return (v_slider - v_right) / R2;
                        } else if (rightEqSlider) {
                            // R2短路，只有R1
                            return (v_left - v_slider) / R1;
                        } else if (leftEqRight) {
                            // R1||R2 并联
                            const R_parallel = (R1 * R2) / (R1 + R2);
                            return (v_left - v_slider) / R_parallel;
                        } else {
                            // 正常三端连接，返回流经滑块的总电流
                            const I1 = (v_left - v_slider) / R1;
                            const I2 = (v_slider - v_right) / R2;
                            return Math.abs(I1) > Math.abs(I2) ? I1 : I2;
                        }
                    }
                    default:
                        return 0;
                }
            }
                
            case 'PowerSource':
            case 'ACVoltageSource':
                // 电源电流计算
                if (comp._nortonModel) {
                    // 诺顿模型：电流 = (E - V_端子) / r = (E - (v1-v2)) / r
                    // 其中 v1-v2 是端子电压
                    const terminalVoltage = v1 - v2;
                    const sourceVoltage = this.getSourceInstantVoltage(comp);
                    const current = (sourceVoltage - terminalVoltage) / comp.internalResistance;
                    return current; // 正值表示从正极流出
                } else {
                    // 理想电压源模型：从MNA解向量获取
                    const sourceCurrent = x[nodeCount - 1 + comp.vsIndex] || 0;
                    return -sourceCurrent;
                }
                
            case 'Motor':
                // 电动机电流从MNA解向量中获取
                const motorCurrent = x[nodeCount - 1 + comp.vsIndex] || 0;
                return -motorCurrent;
                
            case 'Capacitor':
            case 'ParallelPlateCapacitor': {
                const C = comp.capacitance || 0;
                const method = this.resolveDynamicIntegrationMethod(comp);
                if (method === DynamicIntegrationMethods.Trapezoidal) {
                    const Req = this.dt / (2 * Math.max(1e-18, C));
                    const prevVoltage = Number.isFinite(comp.prevVoltage) ? comp.prevVoltage : 0;
                    const prevCurrent = Number.isFinite(comp.prevCurrent) ? comp.prevCurrent : 0;
                    const Ieq = -(prevVoltage / Req + prevCurrent);
                    return dV / Req + Ieq;
                }

                // 后向欧拉：I = dQ/dt,  Q = C * V（支持可变电容）
                const qPrev = comp.prevCharge || 0;
                const qNew = C * dV;
                const dQ = qNew - qPrev;
                return dQ / this.dt;
            }

            case 'Inductor': {
                const L = Math.max(1e-12, comp.inductance || 0);
                const method = this.resolveDynamicIntegrationMethod(comp);
                const prevCurrent = Number.isFinite(comp.prevCurrent)
                    ? comp.prevCurrent
                    : (Number.isFinite(comp.initialCurrent) ? comp.initialCurrent : 0);
                if (method === DynamicIntegrationMethods.Trapezoidal) {
                    const Req = (2 * L) / this.dt;
                    const prevVoltage = Number.isFinite(comp.prevVoltage) ? comp.prevVoltage : 0;
                    const Ieq = prevCurrent + (prevVoltage / Req);
                    return dV / Req + Ieq;
                }
                return prevCurrent + (this.dt / L) * dV;
            }
                
            case 'Switch':
                // 开关电流
                if (comp.closed) {
                    // 闭合时电流很大（短路），但实际电流受外部电路限制
                    // 用极小电阻计算
                    return dV / 1e-9;
                }
                return 0; // 断开时无电流
                
            case 'Ammeter':
                // 电流表电流
                if (comp.resistance > 0) {
                    // 有内阻时通过电阻计算
                    return dV / comp.resistance;
                } else {
                    // 理想电流表：从MNA解向量获取
                    const ammeterCurrent = x[nodeCount - 1 + comp.vsIndex] || 0;
                    return -ammeterCurrent;
                }
                
            case 'Voltmeter':
                // 电压表电流
                const vmResistance = comp.resistance;
                if (vmResistance !== null && vmResistance !== undefined && 
                    vmResistance !== Infinity && vmResistance > 0) {
                    return dV / vmResistance;
                }
                return 0; // 理想电压表无电流
                
            default:
                return 0;
        }
    }

    /**
     * 更新动态元器件状态（用于瞬态分析）
     * @param {number[]} voltages - 当前节点电压
     * @param {Map<string, number>} [currents] - 当前支路电流
     */
    updateDynamicComponents(voltages, currents = null) {
        const isValidNode = (nodeIdx) => nodeIdx !== undefined && nodeIdx !== null && nodeIdx >= 0;
        for (const comp of this.components) {
            if (comp.type === 'Capacitor' || comp.type === 'ParallelPlateCapacitor') {
                if (!comp.nodes || !isValidNode(comp.nodes[0]) || !isValidNode(comp.nodes[1])) continue;
                const v1 = voltages[comp.nodes[0]] || 0;
                const v2 = voltages[comp.nodes[1]] || 0;
                const v = v1 - v2;
                comp.prevVoltage = v;
                comp.prevCharge = (comp.capacitance || 0) * v;
                const measuredCurrent = currents && typeof currents.get === 'function'
                    ? currents.get(comp.id)
                    : undefined;
                if (Number.isFinite(measuredCurrent)) {
                    comp.prevCurrent = measuredCurrent;
                }
                comp._dynamicHistoryReady = true;
            }
            
            if (comp.type === 'Motor') {
                if (!comp.nodes || !isValidNode(comp.nodes[0]) || !isValidNode(comp.nodes[1])) continue;
                // 更新电机转速和反电动势
                // 简化模型：反电动势与转速成正比
                const v1 = voltages[comp.nodes[0]] || 0;
                const v2 = voltages[comp.nodes[1]] || 0;
                const voltage = v1 - v2;
                const current = (voltage - (comp.backEmf || 0)) / comp.resistance;
                
                // 电磁转矩产生加速度，更新转速
                const torque = comp.torqueConstant * current;
                const acceleration = (torque - comp.loadTorque) / comp.inertia;
                comp.speed = (comp.speed || 0) + acceleration * this.dt;
                comp.speed = Math.max(0, comp.speed); // 转速不能为负
                
                // 更新反电动势
                comp.backEmf = comp.emfConstant * comp.speed;
            }

            if (comp.type === 'Inductor') {
                if (!comp.nodes || !isValidNode(comp.nodes[0]) || !isValidNode(comp.nodes[1])) continue;
                const v1 = voltages[comp.nodes[0]] || 0;
                const v2 = voltages[comp.nodes[1]] || 0;
                const dV = v1 - v2;
                const L = Math.max(1e-12, comp.inductance || 0);
                const measuredCurrent = currents && typeof currents.get === 'function'
                    ? currents.get(comp.id)
                    : undefined;
                if (Number.isFinite(measuredCurrent)) {
                    comp.prevCurrent = measuredCurrent;
                } else {
                    const prevCurrent = Number.isFinite(comp.prevCurrent)
                        ? comp.prevCurrent
                        : (Number.isFinite(comp.initialCurrent) ? comp.initialCurrent : 0);
                    comp.prevCurrent = prevCurrent + (this.dt / L) * dV;
                }
                comp.prevVoltage = dV;
                comp._dynamicHistoryReady = true;
            }
        }
    }

    resolveDynamicIntegrationMethod(comp) {
        if (!comp) return DynamicIntegrationMethods.BackwardEuler;
        const methodRaw = typeof comp.integrationMethod === 'string'
            ? comp.integrationMethod.toLowerCase()
            : DynamicIntegrationMethods.Auto;
        const historyReady = !!comp._dynamicHistoryReady;

        if (this.hasConnectedSwitch) {
            return DynamicIntegrationMethods.BackwardEuler;
        }

        if (methodRaw === DynamicIntegrationMethods.Trapezoidal) {
            if (!historyReady) {
                return DynamicIntegrationMethods.BackwardEuler;
            }
            return DynamicIntegrationMethods.Trapezoidal;
        }
        if (methodRaw === DynamicIntegrationMethods.BackwardEuler) {
            return DynamicIntegrationMethods.BackwardEuler;
        }
        if (!historyReady) {
            return DynamicIntegrationMethods.BackwardEuler;
        }
        return DynamicIntegrationMethods.Trapezoidal;
    }

    getSourceInstantVoltage(comp) {
        if (!comp) return 0;
        if (comp.type === 'ACVoltageSource') {
            const rms = Number.isFinite(comp.rmsVoltage) ? comp.rmsVoltage : 0;
            const frequency = Number.isFinite(comp.frequency) ? comp.frequency : 0;
            const phaseDeg = Number.isFinite(comp.phase) ? comp.phase : 0;
            const offset = Number.isFinite(comp.offset) ? comp.offset : 0;
            const omega = 2 * Math.PI * frequency;
            const phaseRad = phaseDeg * Math.PI / 180;
            const value = offset + (rms * Math.sqrt(2)) * Math.sin(omega * this.simTime + phaseRad);
            comp.instantaneousVoltage = value;
            return value;
        }

        const value = Number.isFinite(comp.voltage) ? comp.voltage : 0;
        comp.instantaneousVoltage = value;
        return value;
    }
}
