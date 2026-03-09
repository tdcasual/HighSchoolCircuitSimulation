/**
 * Solver.js - MNA（改进节点分析法）求解器
 * 实现电路的稳态和瞬态分析
 */

import { Matrix } from './Matrix.js';
import { StampDispatcher } from './StampDispatcher.js';
import { DynamicIntegrator } from './DynamicIntegrator.js';
import { ResultPostprocessor } from './ResultPostprocessor.js';
import { SimulationState } from './SimulationState.js';
import { DefaultComponentRegistry } from './ComponentRegistry.js';
import { SolverMatrixAssembler } from './SolverMatrixAssembler.js';
import { SolverConvergenceController } from './SolverConvergenceController.js';
import { buildSystemMatrixCacheKey as buildSolverSystemMatrixCacheKey } from './SolverMatrixCacheKeyBuilder.js';
import { createRuntimeLogger } from '../../utils/Logger.js';
import { assignCircuitSourceInstantaneousVoltage } from '../services/CircuitSourceVoltageResolver.js';

const IDEAL_SOURCE_RESISTANCE_EPS = 1e-9;

export class MNASolver {
constructor(options = {}) {
        this.nodes = [];           // 节点列表
        this.components = [];       // 元器件列表
        this.netlist = null;        // 规范化网表 DTO（可选）
        this.groundNode = 0;        // 接地节点（参考节点）
        this.voltageSourceCount = 0; // 电压源数量（用于扩展矩阵）
        this.dt = 0.001;            // 时间步长（秒）
        this.simTime = 0;           // 当前仿真时刻（秒）
        this.gmin = 1e-12;
        this.hasConnectedSwitch = false;
        this.systemFactorizationCache = {
            key: null,
            matrixSize: -1,
            factorization: null
        };
        this.matrixAssembler = options.matrixAssembler || new SolverMatrixAssembler();
        this.stampDispatcher = options.stampDispatcher || new StampDispatcher({
            stampResistor: (comp, context = {}) => {
                this.stampResistor(context.A, context.i1, context.i2, comp.resistance);
            }
        });
        this.dynamicIntegrator = options.dynamicIntegrator || new DynamicIntegrator();
        this.resultPostprocessor = options.resultPostprocessor || new ResultPostprocessor();
        this.simulationState = options.simulationState || new SimulationState();
        this.componentRegistry = options.componentRegistry || DefaultComponentRegistry;
        this.convergenceController = options.convergenceController || new SolverConvergenceController();
        this.setLogger(options.logger || null);
    }
setLogger(logger) {
        this.logger = logger || createRuntimeLogger({ scope: 'solver' });
        if (typeof this.logger?.child === 'function') {
            Matrix.setLogger(this.logger.child('matrix'));
            this.matrixAssembler?.setLogger?.(this.logger.child('assembler'));
            this.resultPostprocessor?.setLogger?.(this.logger.child('postprocessor'));
            this.convergenceController?.setLogger?.(this.logger.child('convergence'));
        } else {
            Matrix.setLogger(this.logger);
            this.matrixAssembler?.setLogger?.(this.logger);
            this.resultPostprocessor?.setLogger?.(this.logger);
            this.convergenceController?.setLogger?.(this.logger);
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

        this.resetMatrixFactorizationCache();
        const prepared = this.matrixAssembler.prepareComponents({
            components: this.components,
            logger: this.logger
        });
        this.voltageSourceCount = prepared.voltageSourceCount;
        this.shortCircuitDetected = prepared.shortCircuitDetected;
        this.hasConnectedSwitch = prepared.hasConnectedSwitch;
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

buildSystemMatrixCacheKey(nodeCount) {
        return buildSolverSystemMatrixCacheKey({
            nodeCount,
            voltageSourceCount: this.voltageSourceCount,
            gmin: this.gmin,
            dt: this.dt,
            hasConnectedSwitch: this.hasConnectedSwitch,
            components: this.components,
            simulationState: this.simulationState,
            resolveDynamicIntegrationMethod: (component) => this.resolveDynamicIntegrationMethod(component)
        });
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
            return this.convergenceController.createZeroResult({
                nodeCount,
                components: this.components,
                resultPostprocessor: this.resultPostprocessor,
                dt: this.dt,
                debugMode: this.debugMode,
                resolveDynamicIntegrationMethod: (component) => this.resolveDynamicIntegrationMethod(component),
                getSourceInstantVoltage: (component) => this.getSourceInstantVoltage(component),
                simulationState: this.simulationState,
                componentRegistry: this.componentRegistry
            });
        }

        const n = nodeCount - 1 + this.voltageSourceCount;
        if (n <= 0) {
            return this.convergenceController.createZeroResult({
                nodeCount,
                components: this.components,
                resultPostprocessor: this.resultPostprocessor,
                dt: this.dt,
                debugMode: this.debugMode,
                resolveDynamicIntegrationMethod: (component) => this.resolveDynamicIntegrationMethod(component),
                getSourceInstantVoltage: (component) => this.getSourceInstantVoltage(component),
                simulationState: this.simulationState,
                componentRegistry: this.componentRegistry
            });
        }

        const solvePlan = this.convergenceController.buildPlan(this.components);
        const solveState = this.convergenceController.createSolveState(solvePlan);

        for (let iter = 0; iter < solvePlan.maxIterations; iter++) {
            this.convergenceController.recordIteration(solveState, iter);
            const { A, z } = this.matrixAssembler.assemble({
                components: this.components,
                nodeCount,
                voltageSourceCount: this.voltageSourceCount,
                gmin: this.gmin,
                debugMode: this.debugMode,
                logger: this.logger,
                stampComponent: (comp, matrix, vector, totalNodeCount) =>
                    this.stampComponent(comp, matrix, vector, totalNodeCount)
            });

            const matrixCacheKey = this.buildSystemMatrixCacheKey(nodeCount);
            const cached = this.systemFactorizationCache;
            let factorization = null;

            if (
                cached
                && cached.key === matrixCacheKey
                && cached.matrixSize === n
                && cached.factorization
            ) {
                factorization = cached.factorization;
            } else {
                factorization = Matrix.factorize(A);
                if (!factorization) {
                    this.logger?.warn?.('Matrix factorization failed');
                    this.resetMatrixFactorizationCache();
                    this.convergenceController.markInvalid(solveState, 'factorization_failed');
                    break;
                }
                this.systemFactorizationCache.key = matrixCacheKey;
                this.systemFactorizationCache.matrixSize = n;
                this.systemFactorizationCache.factorization = factorization;
            }

            const x = Matrix.solveWithFactorization(factorization, z);
            if (!x) {
                this.logger?.warn?.('Matrix solve failed');
                this.resetMatrixFactorizationCache();
                this.convergenceController.markInvalid(solveState, 'solve_failed');
                break;
            }

            if (this.debugMode) {
                this.logger?.debug?.('Solution x:', x.map(v => v.toFixed(4)));
            }

            const voltages = [0];
            for (let i = 0; i < nodeCount - 1; i++) {
                voltages.push(x[i] || 0);
            }

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

            this.convergenceController.recordSolvedState(solveState, voltages, currents);
            const settled = this.convergenceController.settleIteration(solveState, solvePlan, {
                voltages,
                currents,
                updateJunctionLinearizationState: (nextVoltages, nextCurrents) =>
                    this.updateJunctionLinearizationState(nextVoltages, nextCurrents),
                updateRelayEnergizedStates: (nextCurrents) => this.updateRelayEnergizedStates(nextCurrents),
                resetMatrixFactorizationCache: () => this.resetMatrixFactorizationCache()
            });
            if (settled) {
                break;
            }
        }

        this.shortCircuitDetected = this.detectPowerSourceShortCircuits(
            solveState.solvedVoltages,
            solveState.solvedCurrents
        );
        return this.convergenceController.finalizeResult({
            state: solveState,
            plan: solvePlan
        });
    }
updateJunctionLinearizationState(voltages, currents) {
        return this.convergenceController.updateJunctionLinearizationState({
            components: this.components,
            simulationState: this.simulationState,
            voltages,
            currents
        });
    }
updateRelayEnergizedStates(currents) {
        return this.convergenceController.updateRelayEnergizedStates({
            components: this.components,
            simulationState: this.simulationState,
            currents
        });
    }
detectPowerSourceShortCircuits(voltages, currents) {
        return this.convergenceController.detectPowerSourceShortCircuits({
            components: this.components,
            voltages,
            currents,
            getSourceInstantVoltage: (component) => this.getSourceInstantVoltage(component)
        });
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
            && Number(comp.internalResistance) >= IDEAL_SOURCE_RESISTANCE_EPS;
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
        return this.matrixAssembler.stampResistor(A, i1, i2, R);
    }

    /**
     * 电流源印记（电流方向：nodeFrom -> nodeTo）
     * @param {number[]} z - 常数向量
     * @param {number} iFrom - 起点节点矩阵索引
     * @param {number} iTo - 终点节点矩阵索引
     * @param {number} current - 电流值（A）
     */
stampCurrentSource(z, iFrom, iTo, current) {
        return this.matrixAssembler.stampCurrentSource(z, iFrom, iTo, current);
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
        return this.matrixAssembler.stampVoltageSource(
            A,
            z,
            i1,
            i2,
            V,
            vsIndex,
            nodeCount,
            this.logger
        );
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
        return assignCircuitSourceInstantaneousVoltage(comp, this.simTime);
    }
}
