/**
 * Solver.js - MNA（改进节点分析法）求解器
 * 实现电路的稳态和瞬态分析
 */

import { Matrix } from './Matrix.js';
import { computeNtcThermistorResistance, computePhotoresistorResistance } from '../utils/Physics.js';
import { StampDispatcher } from '../core/simulation/StampDispatcher.js';
import { DynamicIntegrator } from '../core/simulation/DynamicIntegrator.js';
import { ResultPostprocessor } from '../core/simulation/ResultPostprocessor.js';
import { SimulationState } from '../core/simulation/SimulationState.js';
import { DefaultComponentRegistry } from '../core/simulation/ComponentRegistry.js';
import { limitJunctionStep, resolveJunctionParameters } from '../core/simulation/JunctionModel.js';
import { createRuntimeLogger } from '../utils/Logger.js';

export class MNASolver {
    constructor() {
        this.nodes = [];           // 节点列表
        this.components = [];       // 元器件列表
        this.netlist = null;        // 规范化网表 DTO（可选）
        this.groundNode = 0;        // 接地节点（参考节点）
        this.voltageSourceCount = 0; // 电压源数量（用于扩展矩阵）
        this.dt = 0.001;            // 时间步长（秒）
        this.simTime = 0;           // 当前仿真时刻（秒）
        // gmin 稳定化：给每个非接地节点加一个极小的对地电导，避免“悬浮子电路”导致矩阵奇异
        // 取值为 1e-12 S (≈ 1e12Ω) 基本不影响正常高中电路数值，但能显著提升鲁棒性
        this.gmin = 1e-12;
        this.hasConnectedSwitch = false;
        this.systemFactorizationCache = {
            key: null,
            matrixSize: -1,
            factorization: null
        };
        this.stampDispatcher = new StampDispatcher({
            stampResistor: (comp, context = {}) => {
                this.stampResistor(context.A, context.i1, context.i2, comp.resistance);
            }
        });
        this.dynamicIntegrator = new DynamicIntegrator();
        this.resultPostprocessor = new ResultPostprocessor();
        this.simulationState = new SimulationState();
        this.componentRegistry = DefaultComponentRegistry;
        this.setLogger(null);
    }

    setLogger(logger) {
        this.logger = logger || createRuntimeLogger({ scope: 'solver' });
        if (typeof this.logger?.child === 'function') {
            Matrix.setLogger(this.logger.child('matrix'));
            this.resultPostprocessor?.setLogger?.(this.logger.child('postprocessor'));
        } else {
            Matrix.setLogger(this.logger);
            this.resultPostprocessor?.setLogger?.(this.logger);
        }
    }

    /**
     * 设置电路数据
     * @param {Object[]|Object} components - 元器件数组或 netlist DTO
     * @param {Object[]} nodes - 节点数组（旧路径）
     */
    setCircuit(components, nodes) {
        const isNetlistInput = !Array.isArray(components)
            && components
            && typeof components === 'object'
            && Array.isArray(components.components)
            && Array.isArray(components.nodes)
            && nodes === undefined;

        if (isNetlistInput) {
            this.netlist = components;
            this.components = components.components
                .map((entry) => {
                    if (entry && typeof entry === 'object' && entry.source && typeof entry.source === 'object') {
                        return entry.source;
                    }
                    return entry;
                })
                .filter((entry) => entry && typeof entry === 'object');
            this.nodes = components.nodes.map((entry) => {
                if (entry && typeof entry === 'object'
                    && Object.prototype.hasOwnProperty.call(entry, 'node')) {
                    return entry.node;
                }
                return entry;
            });
        } else {
            this.netlist = null;
            this.components = Array.isArray(components) ? components : [];
            this.nodes = Array.isArray(nodes) ? nodes : [];
        }

        this.voltageSourceCount = 0;
        this.shortCircuitDetected = false;
        this.hasConnectedSwitch = false;
        this.resetMatrixFactorizationCache();
        const isValidNode = (nodeIdx) => nodeIdx !== undefined && nodeIdx !== null && nodeIdx >= 0;
        const circuitComponents = this.components;
        
        // 检测并标记被短路的元器件（两端节点相同）
        for (const comp of circuitComponents) {
            comp.vsIndex = undefined;
            const isPowerSource = comp.type === 'PowerSource' || comp.type === 'ACVoltageSource';
            if (comp.type === 'Ground') {
                comp._isShorted = false;
                continue;
            }
            if (comp.nodes && comp.nodes.length >= 2) {
                const n1 = comp.nodes[0];
                const n2 = comp.type === 'SPDTSwitch'
                    ? comp.nodes[comp.position === 'b' ? 2 : 1]
                    : comp.nodes[1];
                // 如果两端节点相同且有效，说明被短路了
                comp._isShorted = (n1 === n2 && n1 >= 0);
                // Relay 具有两组独立端子，不使用 _isShorted 快速裁剪
                if (comp.type === 'Relay') {
                    comp._isShorted = false;
                }
                
                // 电源被短路是危险的
                if (comp._isShorted && isPowerSource) {
                    this.shortCircuitDetected = true;
                    this.logger?.warn?.(`Power source ${comp.id} is short-circuited!`);
                }
            } else {
                comp._isShorted = false;
            }

            if (isPowerSource) {
                const internalResistance = Number(comp.internalResistance);
                comp.internalResistance = Number.isFinite(internalResistance) && internalResistance >= 0
                    ? internalResistance
                    : 0.5;
                comp._nortonModel = comp.internalResistance > 1e-9;
            }
        }
        
        // 统计电压源数量
        // 注意：有内阻的电源使用诺顿等效，不计入电压源
        // 被短路的电源不作为电压源处理
        for (const comp of circuitComponents) {
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
                const ammeterResistance = Number(comp.resistance);
                comp.resistance = Number.isFinite(ammeterResistance) && ammeterResistance >= 0
                    ? ammeterResistance
                    : 0;
                if (comp.resistance <= 0) {
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
            if (comp.type === 'Diode' || comp.type === 'LED') {
                const defaultVf = comp.type === 'LED' ? 2.0 : 0.7;
                const defaultRon = comp.type === 'LED' ? 2 : 1;
                comp.forwardVoltage = Number.isFinite(comp.forwardVoltage) ? comp.forwardVoltage : defaultVf;
                comp.onResistance = Number.isFinite(comp.onResistance) ? comp.onResistance : defaultRon;
                comp.offResistance = Number.isFinite(comp.offResistance) ? comp.offResistance : 1e9;
                comp.conducting = !!comp.conducting;
            }
            if (comp.type === 'Thermistor') {
                comp.resistanceAt25 = Number.isFinite(comp.resistanceAt25) ? comp.resistanceAt25 : 1000;
                comp.beta = Number.isFinite(comp.beta) ? comp.beta : 3950;
                comp.temperatureC = Number.isFinite(comp.temperatureC) ? comp.temperatureC : 25;
            }
            if (comp.type === 'Photoresistor') {
                comp.resistanceDark = Number.isFinite(comp.resistanceDark) ? comp.resistanceDark : 100000;
                comp.resistanceLight = Number.isFinite(comp.resistanceLight) ? comp.resistanceLight : 500;
                comp.lightLevel = Number.isFinite(comp.lightLevel) ? comp.lightLevel : 0.5;
            }
            if (comp.type === 'Relay') {
                comp.coilResistance = Number.isFinite(comp.coilResistance) ? comp.coilResistance : 200;
                comp.pullInCurrent = Number.isFinite(comp.pullInCurrent) ? comp.pullInCurrent : 0.02;
                comp.dropOutCurrent = Number.isFinite(comp.dropOutCurrent) ? comp.dropOutCurrent : 0.01;
                comp.contactOnResistance = Number.isFinite(comp.contactOnResistance) ? comp.contactOnResistance : 1e-3;
                comp.contactOffResistance = Number.isFinite(comp.contactOffResistance) ? comp.contactOffResistance : 1e12;
                comp.energized = !!comp.energized;
            }
            if (comp.type === 'Switch' || comp.type === 'SPDTSwitch') {
                const n1 = comp.nodes?.[0];
                const n2 = comp.type === 'SPDTSwitch'
                    ? comp.nodes?.[comp.position === 'b' ? 2 : 1]
                    : comp.nodes?.[1];
                if (isValidNode(n1) && isValidNode(n2)) {
                    this.hasConnectedSwitch = true;
                }
            }
        }
    }

    setSimulationState(state) {
        if (state instanceof SimulationState) {
            this.simulationState = state;
        }
    }

    resetMatrixFactorizationCache() {
        this.systemFactorizationCache.key = null;
        this.systemFactorizationCache.matrixSize = -1;
        this.systemFactorizationCache.factorization = null;
    }

    formatMatrixKeyNumber(value) {
        if (!Number.isFinite(value)) {
            if (value === Infinity) return 'inf';
            if (value === -Infinity) return '-inf';
            return 'nan';
        }
        return Number(value).toPrecision(12);
    }

    buildSystemMatrixCacheKey(nodeCount) {
        const keyParts = [
            `nodes:${nodeCount}`,
            `vs:${this.voltageSourceCount}`,
            `gmin:${this.formatMatrixKeyNumber(this.gmin)}`,
            `dt:${this.formatMatrixKeyNumber(this.dt)}`,
            `switch:${this.hasConnectedSwitch ? 1 : 0}`
        ];

        for (const comp of this.components) {
            if (!comp) continue;

            const nodesPart = Array.isArray(comp.nodes)
                ? comp.nodes.map((nodeIdx) => (Number.isInteger(nodeIdx) ? String(nodeIdx) : 'x')).join(',')
                : '';

            keyParts.push(
                `id:${comp.id}`,
                `type:${comp.type}`,
                `short:${comp._isShorted ? 1 : 0}`,
                `n:${nodesPart}`,
                `vsIdx:${comp.vsIndex ?? 'x'}`
            );

            switch (comp.type) {
                case 'Resistor':
                case 'Bulb':
                    keyParts.push(`R:${this.formatMatrixKeyNumber(comp.resistance ?? 0)}`);
                    break;
                case 'Thermistor':
                    keyParts.push(
                        `R25:${this.formatMatrixKeyNumber(comp.resistanceAt25 ?? 1000)}`,
                        `beta:${this.formatMatrixKeyNumber(comp.beta ?? 3950)}`,
                        `tempC:${this.formatMatrixKeyNumber(comp.temperatureC ?? 25)}`,
                        `R:${this.formatMatrixKeyNumber(computeNtcThermistorResistance(comp))}`
                    );
                    break;
                case 'Photoresistor':
                    keyParts.push(
                        `Rdark:${this.formatMatrixKeyNumber(comp.resistanceDark ?? 100000)}`,
                        `Rlight:${this.formatMatrixKeyNumber(comp.resistanceLight ?? 500)}`,
                        `light:${this.formatMatrixKeyNumber(comp.lightLevel ?? 0.5)}`,
                        `R:${this.formatMatrixKeyNumber(computePhotoresistorResistance(comp))}`
                    );
                    break;
                case 'Diode':
                case 'LED':
                    {
                        const state = this.simulationState && comp.id ? this.simulationState.get(comp.id) : null;
                        const junctionVoltage = Number.isFinite(state?.junctionVoltage)
                            ? state.junctionVoltage
                            : (Number.isFinite(comp.junctionVoltage) ? comp.junctionVoltage : 0);
                        const junctionCurrent = Number.isFinite(state?.junctionCurrent)
                            ? state.junctionCurrent
                            : (Number.isFinite(comp.junctionCurrent) ? comp.junctionCurrent : 0);
                        const params = resolveJunctionParameters(comp);
                        keyParts.push(
                            `n:${this.formatMatrixKeyNumber(params.idealityFactor)}`,
                            `is:${this.formatMatrixKeyNumber(params.saturationCurrent)}`,
                            `rs:${this.formatMatrixKeyNumber(params.seriesResistance)}`,
                            `vj:${this.formatMatrixKeyNumber(junctionVoltage)}`,
                            `ij:${this.formatMatrixKeyNumber(junctionCurrent)}`
                        );
                    }
                    break;
                case 'Rheostat':
                    keyParts.push(
                        `minR:${this.formatMatrixKeyNumber(comp.minResistance ?? 0)}`,
                        `maxR:${this.formatMatrixKeyNumber(comp.maxResistance ?? 0)}`,
                        `pos:${this.formatMatrixKeyNumber(comp.position ?? 0.5)}`,
                        `mode:${comp.connectionMode || 'none'}`
                    );
                    break;
                case 'PowerSource':
                case 'ACVoltageSource':
                    keyParts.push(`rInt:${this.formatMatrixKeyNumber(comp.internalResistance ?? 0)}`);
                    break;
                case 'Capacitor':
                case 'ParallelPlateCapacitor':
                    keyParts.push(
                        `C:${this.formatMatrixKeyNumber(comp.capacitance ?? 0)}`,
                        `method:${this.resolveDynamicIntegrationMethod(comp)}`
                    );
                    break;
                case 'Inductor':
                    keyParts.push(
                        `L:${this.formatMatrixKeyNumber(comp.inductance ?? 0)}`,
                        `method:${this.resolveDynamicIntegrationMethod(comp)}`
                    );
                    break;
                case 'Motor':
                    keyParts.push(`R:${this.formatMatrixKeyNumber(comp.resistance ?? 0)}`);
                    break;
                case 'Switch':
                    keyParts.push(`closed:${comp.closed ? 1 : 0}`);
                    break;
                case 'SPDTSwitch':
                    keyParts.push(
                        `pos:${comp.position === 'b' ? 'b' : 'a'}`,
                        `ron:${this.formatMatrixKeyNumber(comp.onResistance ?? 1e-9)}`,
                        `roff:${this.formatMatrixKeyNumber(comp.offResistance ?? 1e12)}`
                    );
                    break;
                case 'Relay':
                    keyParts.push(
                        `Rcoil:${this.formatMatrixKeyNumber(comp.coilResistance ?? 200)}`,
                        `Ion:${this.formatMatrixKeyNumber(comp.pullInCurrent ?? 0.02)}`,
                        `Ioff:${this.formatMatrixKeyNumber(comp.dropOutCurrent ?? 0.01)}`,
                        `Ron:${this.formatMatrixKeyNumber(comp.contactOnResistance ?? 1e-3)}`,
                        `Roff:${this.formatMatrixKeyNumber(comp.contactOffResistance ?? 1e12)}`,
                        `en:${comp.energized ? 1 : 0}`
                    );
                    break;
                case 'Fuse':
                    keyParts.push(
                        `blown:${comp.blown ? 1 : 0}`,
                        `Rcold:${this.formatMatrixKeyNumber(comp.coldResistance ?? 0.05)}`,
                        `Rblown:${this.formatMatrixKeyNumber(comp.blownResistance ?? 1e12)}`
                    );
                    break;
                case 'Ammeter':
                    keyParts.push(`R:${this.formatMatrixKeyNumber(comp.resistance ?? 0)}`);
                    break;
                case 'Voltmeter':
                    keyParts.push(`R:${this.formatMatrixKeyNumber(comp.resistance ?? Infinity)}`);
                    break;
                default:
                    break;
            }
        }

        return keyParts.join('|');
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
            return {
                voltages,
                currents,
                valid: true,
                meta: {
                    converged: true,
                    iterations: 0,
                    maxIterations: 0
                }
            };
        }

        // 矩阵大小：节点数-1（去掉地节点）+ 电压源数
        const n = nodeCount - 1 + this.voltageSourceCount;
        
        if (n <= 0) {
            const voltages = Array.from({ length: nodeCount }, () => 0);
            const currents = new Map();
            for (const comp of this.components) {
                currents.set(comp.id, 0);
            }
            return {
                voltages,
                currents,
                valid: true,
                meta: {
                    converged: true,
                    iterations: 0,
                    maxIterations: 0
                }
            };
        }

        const hasJunction = this.components.some((comp) => comp?.type === 'Diode' || comp?.type === 'LED');
        const hasRelay = this.components.some((comp) => comp?.type === 'Relay');
        const hasStateful = hasJunction || hasRelay;
        const maxIterations = hasStateful ? 40 : 1;
        const junctionTolerance = 1e-6;

        let solvedVoltages = [];
        let solvedCurrents = new Map();
        let solvedValid = false;
        let converged = !hasStateful;
        let completedIterations = 0;
        let invalidReason = '';
        let maxJunctionDelta = 0;
        let lastJunctionDelta = 0;

        for (let iter = 0; iter < maxIterations; iter++) {
            completedIterations = iter + 1;
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
                this.logger?.debug?.('MNA Matrix A:');
                for (let i = 0; i < n; i++) {
                    this.logger?.debug?.(`  [${A[i].map(v => v.toFixed(4)).join(', ')}]`);
                }
                this.logger?.debug?.('Vector z:', z.map(v => v.toFixed(4)));
            }

            const matrixCacheKey = this.buildSystemMatrixCacheKey(nodeCount);
            const cached = this.systemFactorizationCache;
            let factorization = null;

            if (
                cached &&
                cached.key === matrixCacheKey &&
                cached.matrixSize === n &&
                cached.factorization
            ) {
                factorization = cached.factorization;
            } else {
                factorization = Matrix.factorize(A);
                if (!factorization) {
                    this.logger?.warn?.('Matrix factorization failed');
                    this.resetMatrixFactorizationCache();
                    invalidReason = 'factorization_failed';
                    solvedValid = false;
                    break;
                }
                this.systemFactorizationCache.key = matrixCacheKey;
                this.systemFactorizationCache.matrixSize = n;
                this.systemFactorizationCache.factorization = factorization;
            }

            // 求解
            const x = Matrix.solveWithFactorization(factorization, z);

            if (!x) {
                this.logger?.warn?.('Matrix solve failed');
                this.resetMatrixFactorizationCache();
                invalidReason = 'solve_failed';
                solvedValid = false;
                break;
            }

            if (this.debugMode) {
                this.logger?.debug?.('Solution x:', x.map(v => v.toFixed(4)));
            }

            // 提取节点电压（添加地节点的0电压）
            const voltages = [0]; // 节点0是地
            for (let i = 0; i < nodeCount - 1; i++) {
                voltages.push(x[i] || 0);
            }

            // 计算各元器件的电流
            const { currents } = this.resultPostprocessor.apply({
                components: this.components,
                voltages,
                x,
                nodeCount,
                dt: this.dt,
                debugMode: this.debugMode,
                resolveDynamicIntegrationMethod: (component) => this.resolveDynamicIntegrationMethod(component),
                getSourceInstantVoltage: (component) => this.getSourceInstantVoltage(component),
                simulationState: this.simulationState,
                registry: this.componentRegistry
            });

            solvedVoltages = voltages;
            solvedCurrents = currents;
            solvedValid = true;

            if (!hasStateful) {
                converged = true;
                break;
            }

            let relayStateChanged = false;
            let junctionStateChanged = false;
            if (hasJunction) {
                const junctionUpdate = this.updateJunctionLinearizationState(voltages, currents);
                junctionStateChanged = junctionUpdate.changed;
                lastJunctionDelta = Number.isFinite(junctionUpdate.maxVoltageDelta)
                    ? junctionUpdate.maxVoltageDelta
                    : 0;
                maxJunctionDelta = Math.max(maxJunctionDelta, lastJunctionDelta);
            }
            if (hasRelay) {
                relayStateChanged = this.updateRelayEnergizedStates(currents);
            }

            const junctionConverged = !hasJunction || lastJunctionDelta <= junctionTolerance;
            if (junctionConverged && !relayStateChanged) {
                converged = true;
                break;
            }

            if (junctionStateChanged || relayStateChanged) {
                this.resetMatrixFactorizationCache();
            }
        }

        this.shortCircuitDetected = this.detectPowerSourceShortCircuits(solvedVoltages, solvedCurrents);
        const valid = solvedValid && (!hasStateful || converged);
        return {
            voltages: solvedVoltages,
            currents: solvedCurrents,
            valid,
            meta: {
                converged: !hasStateful || converged,
                iterations: completedIterations,
                maxIterations,
                hasStateful,
                maxJunctionDelta,
                invalidReason: invalidReason || (valid ? '' : 'not_converged')
            }
        };
    }

    updateJunctionLinearizationState(voltages, currents) {
        let changed = false;
        let maxVoltageDelta = 0;

        for (const comp of this.components) {
            if (!comp || (comp.type !== 'Diode' && comp.type !== 'LED')) continue;
            const entry = this.simulationState && comp.id ? this.simulationState.ensure(comp.id) : null;
            const nAnode = comp.nodes?.[0];
            const nCathode = comp.nodes?.[1];
            if (nAnode == null || nCathode == null || nAnode < 0 || nCathode < 0) continue;

            const vAk = (voltages[nAnode] || 0) - (voltages[nCathode] || 0);
            const previousLinearization = Number.isFinite(entry?.junctionVoltage)
                ? entry.junctionVoltage
                : (Number.isFinite(comp.junctionVoltage) ? comp.junctionVoltage : 0);
            const params = resolveJunctionParameters(comp);
            const nextLinearization = limitJunctionStep(vAk, previousLinearization, params);
            const junctionCurrent = Number(currents?.get(comp.id)) || 0;
            const displayCurrentThreshold = Math.max(1e-4, params.referenceCurrent * 0.02);
            const nextConducting = junctionCurrent >= displayCurrentThreshold
                || vAk >= params.forwardVoltage * 0.95;

            const delta = Math.abs(nextLinearization - previousLinearization);
            maxVoltageDelta = Math.max(maxVoltageDelta, delta);
            if (delta > 1e-9) {
                changed = true;
            }

            if (entry) {
                entry.junctionVoltage = nextLinearization;
                entry.junctionCurrent = junctionCurrent;
                entry.conducting = nextConducting;
            }
            comp.junctionVoltage = nextLinearization;
            comp.junctionCurrent = junctionCurrent;
            comp.conducting = nextConducting;
        }

        return { changed, maxVoltageDelta };
    }

    updateRelayEnergizedStates(currents) {
        let changed = false;
        for (const comp of this.components) {
            if (!comp || comp.type !== 'Relay') continue;
            const entry = this.simulationState && comp.id ? this.simulationState.ensure(comp.id) : null;
            const pullIn = Math.max(1e-9, Number(comp.pullInCurrent) || 0.02);
            const dropOutRaw = Math.max(1e-9, Number(comp.dropOutCurrent) || pullIn * 0.5);
            const dropOut = Math.min(dropOutRaw, pullIn);
            const coilCurrentAbs = Math.abs(Number(currents?.get(comp.id)) || 0);

            const currentEnergized = entry && typeof entry.energized === 'boolean'
                ? entry.energized
                : !!comp.energized;
            const nextEnergized = currentEnergized
                ? coilCurrentAbs >= dropOut
                : coilCurrentAbs >= pullIn;

            if (entry) {
                entry.energized = nextEnergized;
            }
            if (nextEnergized !== !!comp.energized) {
                changed = true;
            }
            comp.energized = nextEnergized;
        }
        return changed;
    }

    detectPowerSourceShortCircuits(voltages, currents) {
        const isValidNode = (nodeIdx) => nodeIdx !== undefined && nodeIdx !== null && nodeIdx >= 0;
        const shortCurrentRatio = 0.95;
        const lowVoltageRatio = 0.05;
        const lowVoltageAbs = 0.05;

        for (const comp of this.components) {
            if (comp.type !== 'PowerSource' && comp.type !== 'ACVoltageSource') continue;
            const n1 = comp.nodes?.[0];
            const n2 = comp.nodes?.[1];
            if (!isValidNode(n1) || !isValidNode(n2)) continue;

            if (comp._isShorted) {
                return true;
            }

            const internalResistance = Number(comp.internalResistance);
            if (!(Number.isFinite(internalResistance) && internalResistance > 1e-9)) {
                continue;
            }

            const sourceVoltage = this.getSourceInstantVoltage(comp);
            const sourceVoltageAbs = Math.abs(sourceVoltage);
            if (!(sourceVoltageAbs > 0)) continue;
            const shortCurrent = sourceVoltageAbs / internalResistance;
            if (!(shortCurrent > 0)) continue;

            const sourceCurrent = Math.abs(currents?.get(comp.id) || 0);
            const terminalVoltage = Math.abs((voltages[n1] || 0) - (voltages[n2] || 0));
            const voltageTol = Math.max(lowVoltageAbs, sourceVoltageAbs * lowVoltageRatio);
            if (sourceCurrent >= shortCurrent * shortCurrentRatio && terminalVoltage <= voltageTol) {
                return true;
            }
        }

        return false;
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
            this.logger?.warn?.(`Component ${comp.id} has no valid nodes array`);
            return;
        }
        
        // 如果元器件被短路，跳过 stamp（带内阻电源例外，仍需计算其短路电流）
        const isFiniteResistanceSource = (comp.type === 'PowerSource' || comp.type === 'ACVoltageSource')
            && Number.isFinite(Number(comp.internalResistance))
            && Number(comp.internalResistance) > 1e-9;
        if (comp._isShorted && !isFiniteResistanceSource) {
            // 被短路的元器件不参与电路计算
            // 但需要记录状态以便显示
            return;
        }
        
        const n1 = comp.nodes[0]; // 正极节点
        const n2 = comp.nodes[1]; // 负极节点
        const isValidNode = (nodeIdx) => nodeIdx !== undefined && nodeIdx >= 0;
        
        // 检查节点是否有效（滑动变阻器在后续分支中单独判断）
        if (comp.type !== 'Rheostat' && comp.type !== 'SPDTSwitch' && comp.type !== 'Relay' && (!isValidNode(n1) || !isValidNode(n2))) {
            return;
        }
        
        // 将节点索引转换为矩阵索引（去掉地节点0）
        const toMatrixIndex = (nodeIdx) => (isValidNode(nodeIdx) ? nodeIdx - 1 : null);
        const i1 = toMatrixIndex(n1);
        const i2 = toMatrixIndex(n2);
        
        if (this.debugMode) {
            this.logger?.debug?.(`Stamp ${comp.type} ${comp.id}: nodes=[${n1},${n2}], matrix idx=[${i1},${i2}]`);
        }

        const registry = this.componentRegistry || DefaultComponentRegistry;
        const customHandler = registry.get(comp.type);
        const defaultHandler = registry === DefaultComponentRegistry
            ? null
            : DefaultComponentRegistry.get(comp.type);
        const handler = (customHandler && typeof customHandler.stamp === 'function')
            ? customHandler
            : ((defaultHandler && typeof defaultHandler.stamp === 'function') ? defaultHandler : customHandler);
        if (handler && typeof handler.stamp === 'function') {
            handler.stamp(comp, {
                stampResistor: (rI1, rI2, rValue) => this.stampResistor(A, rI1, rI2, rValue),
                stampCurrentSource: (cFrom, cTo, current) => this.stampCurrentSource(z, cFrom, cTo, current),
                stampVoltageSource: (vI1, vI2, voltage, vsIndex, totalNodeCount) =>
                    this.stampVoltageSource(A, z, vI1, vI2, voltage, vsIndex, totalNodeCount),
                getSourceInstantVoltage: (targetComp) => this.getSourceInstantVoltage(targetComp),
                dt: this.dt,
                resolveDynamicIntegrationMethod: (targetComp) => this.resolveDynamicIntegrationMethod(targetComp),
                state: this.simulationState
            }, {
                n1,
                n2,
                i1,
                i2,
                nodeCount,
                isValidNode
            });
            return;
        }

        const handledByDispatcher = this.stampDispatcher.stamp(comp, {
            A,
            z,
            nodeCount,
            n1,
            n2,
            i1,
            i2,
            isValidNode
        });
        if (handledByDispatcher) {
            return;
        }
        // Unknown component types that were not handled by registry/dispatcher are treated as no-op.
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
        if (!Number.isInteger(vsIndex) || vsIndex < 0) {
            this.logger?.warn?.('Skip voltage source stamp due to invalid vsIndex');
            return;
        }
        const k = nodeCount - 1 + vsIndex; // 电流变量在矩阵中的位置
        if (k < 0 || k >= A.length || !A[k]) {
            this.logger?.warn?.('Skip voltage source stamp due to out-of-range equation row');
            return;
        }
        
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
        return this.resultPostprocessor.calculateCurrent(comp, {
            voltages,
            x,
            nodeCount,
            dt: this.dt,
            resolveDynamicIntegrationMethod: (targetComp) => this.resolveDynamicIntegrationMethod(targetComp),
            getSourceInstantVoltage: (targetComp) => this.getSourceInstantVoltage(targetComp)
        });
    }

    /**
     * 更新动态元器件状态（用于瞬态分析）
     * @param {number[]} voltages - 当前节点电压
     * @param {Map<string, number>} [currents] - 当前支路电流
     */
    updateDynamicComponents(voltages, currents = null) {
        return this.dynamicIntegrator.updateDynamicComponents(
            this.components,
            voltages,
            currents,
            this.dt,
            this.hasConnectedSwitch,
            this.simulationState
        );
    }

    resolveDynamicIntegrationMethod(comp) {
        return this.dynamicIntegrator.resolveDynamicIntegrationMethod(comp, this.hasConnectedSwitch);
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
