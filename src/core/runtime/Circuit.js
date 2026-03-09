/**
 * Circuit.js - 电路管理器
 * 管理电路中的节点、元器件和连接
 */

import { MNASolver } from '../simulation/MNASolver.js';
import { getTerminalWorldPosition } from '../../utils/TerminalGeometry.js';
import { normalizeCanvasPoint, toCanvasInt } from '../../utils/CanvasCoords.js';
import { NodeBuilder } from '../topology/NodeBuilder.js';
import { WireCompactor } from '../topology/WireCompactor.js';
import { getTopologyStateSnapshot, setTopologyReplacementState } from '../topology/TopologyState.js';
import { ConnectivityCache } from '../topology/ConnectivityCache.js';
import { CircuitSerializer } from '../io/CircuitSerializer.js';
import { CircuitDeserializer } from '../io/CircuitDeserializer.js';
import { SimulationState } from '../simulation/SimulationState.js';
import { NetlistBuilder } from '../simulation/NetlistBuilder.js';
import { createRuntimeLogger } from '../../utils/Logger.js';
import { CircuitPersistenceAdapter } from './CircuitPersistenceAdapter.js';
import { CircuitDiagnosticsAdapter } from './CircuitDiagnosticsAdapter.js';
import { CircuitTopologyService } from '../services/CircuitTopologyService.js';
import { CircuitSimulationLoopService } from '../services/CircuitSimulationLoopService.js';
import { CircuitObservationProbeService } from '../services/CircuitObservationProbeService.js';
import { CircuitTopologyValidationService } from '../services/CircuitTopologyValidationService.js';
import { CircuitFlowAnalysisService } from '../services/CircuitFlowAnalysisService.js';
import { CircuitResultProjectionService } from '../services/CircuitResultProjectionService.js';
import { getCircuitComponentProperties } from './CircuitComponentProperties.js';
import {
    getWireCurrentInfo as getWireCurrentInfoViaService,
    isWireInShortCircuit as isWireInShortCircuitViaService,
    refreshShortCircuitDiagnostics as refreshShortCircuitDiagnosticsViaService
} from './CircuitShortCircuitDiagnosticsService.js';

export class Circuit {
    constructor(options = {}) {
        this.components = new Map();  // id -> component
        this.wires = new Map();       // id -> wire
        this.observationProbes = new Map(); // id -> probe
        this.nodes = [];              // 电气节点列表
        this.solver = new MNASolver();
        this.isRunning = false;
        this.lastResults = null;
        this.simulationInterval = null;
        this.dt = 0.01;               // 10ms 时间步长
        this.currentDt = this.dt;     // 当前实际仿真步长（可用于自适应步长）
        this.enableAdaptiveTimeStep = false;
        this.minAdaptiveDt = this.dt * 0.1;
        this.maxAdaptiveDt = this.dt;
        this.adaptiveDtShrinkFactor = 0.5;
        this.adaptiveDtGrowFactor = 1.5;
        this.adaptiveEaseIterationThreshold = 2;
        this.adaptiveEaseStreakToGrow = 3;
        this._adaptiveEaseStreak = 0;
        this.simTime = 0;             // 仿真时间（秒）
        this.minAcSamplesPerCycle = 40; // 交流仿真每周期最小采样点数（用于子步进）
        this.maxAcSubstepsPerStep = 200; // 单次 step 的最大子步数，防止高频导致卡顿
        this._wireFlowCache = { version: null, map: new Map() };
        this.terminalConnectionMap = new Map();
        this.shortedPowerNodes = new Set(); // node indices that contain a shorted PowerSource
        this.shortedSourceIds = new Set(); // source ids detected as short-circuited
        this.shortedWireIds = new Set(); // wire ids on short-circuit paths
        this.shortCircuitCacheVersion = null; // last results object used by short-circuit diagnostics
        this.topologyBatchDepth = 0;
        this.topologyRebuildPending = false;
        this.topologyVersion = 0;
        this.topologyReplacementByRemovedId = {};
        this.simulationStepId = 0;
        this.solverPreparedTopologyVersion = -1;
        this.solverCircuitDirty = true;
        this.nodeBuilder = new NodeBuilder();
        this.wireCompactor = new WireCompactor();
        this.connectivityCache = new ConnectivityCache();
        this.topologyService = new CircuitTopologyService();
        this.simulationLoopService = new CircuitSimulationLoopService();
        this.observationProbeService = options.observationProbeService || new CircuitObservationProbeService();
        this.topologyValidationService = options.topologyValidationService || new CircuitTopologyValidationService();
        this.flowAnalysisService = options.flowAnalysisService || new CircuitFlowAnalysisService();
        this.resultProjectionService = options.resultProjectionService || new CircuitResultProjectionService();
        this.componentTerminalTopologyKeys = new Map(); // componentId -> topology key used for terminal geometry cache
        this.terminalWorldPosCache = new Map(); // componentId -> Map(terminalIndex -> {x,y})
        this.simulationState = new SimulationState();
        this.netlistBuilder = new NetlistBuilder();
        this.netlist = null;
        this.debugMode = false;
        this.logger = createRuntimeLogger({ scope: 'circuit' });
        this.persistenceAdapter = options.persistenceAdapter || new CircuitPersistenceAdapter({
            storage: options.storage || null
        });
        this.diagnosticsAdapter = options.diagnosticsAdapter || new CircuitDiagnosticsAdapter();
        this.solver.setLogger?.(this.logger.child?.('solver') || this.logger);
        this.loadDebugFlag();
        this.solver.debugMode = this.debugMode;
    }

    setLogger(logger) {
        this.logger = logger || createRuntimeLogger({ scope: 'circuit' });
        this.solver.setLogger?.(this.logger.child?.('solver') || this.logger);
    }

    beginTopologyBatch() {
        this.topologyBatchDepth += 1;
        return this.topologyBatchDepth;
    }

    endTopologyBatch(options = {}) {
        const force = !!options.force;
        if (this.topologyBatchDepth > 0) {
            this.topologyBatchDepth -= 1;
        }
        if (this.topologyBatchDepth > 0) return false;

        const shouldRebuild = this.topologyRebuildPending || force;
        this.topologyRebuildPending = false;
        if (!shouldRebuild) return false;

        this.rebuildNodes();
        return true;
    }

    requestTopologyRebuild() {
        if (this.topologyBatchDepth > 0) {
            this.topologyRebuildPending = true;
            return false;
        }
        this.rebuildNodes();
        return true;
    }

    markSolverCircuitDirty() {
        this.solverCircuitDirty = true;
        this.solverPreparedTopologyVersion = -1;
    }

    invalidateComponentTerminalCache(componentId) {
        if (componentId === undefined || componentId === null || String(componentId).trim() === '') return;
        const normalizedId = String(componentId);
        this.componentTerminalTopologyKeys.delete(normalizedId);
        this.terminalWorldPosCache.delete(normalizedId);
    }

    buildComponentTerminalTopologyKey(comp) {
        if (!comp || !comp.id) return '';
        const x = toCanvasInt(comp.x || 0);
        const y = toCanvasInt(comp.y || 0);
        const rotation = toCanvasInt(comp.rotation || 0);
        const rheostatPos = comp.type === 'Rheostat'
            ? Number((comp.position ?? 0.5).toFixed(6))
            : '';
        const boxWidth = comp.type === 'BlackBox'
            ? toCanvasInt(comp.boxWidth || 0)
            : '';

        let extKey = '';
        const ext = comp.terminalExtensions;
        if (ext && typeof ext === 'object') {
            const keys = Object.keys(ext).sort((a, b) => Number(a) - Number(b));
            extKey = keys.map((k) => {
                const item = ext[k];
                const ex = toCanvasInt(item?.x || 0);
                const ey = toCanvasInt(item?.y || 0);
                return `${k}:${ex},${ey}`;
            }).join('|');
        }

        return `${comp.type}|${x},${y}|${rotation}|${rheostatPos}|${boxWidth}|${extKey}`;
    }

    getTerminalWorldPositionCached(componentId, terminalIndex, comp) {
        if (!componentId || !comp) return null;
        let byTerminal = this.terminalWorldPosCache.get(componentId);
        if (!byTerminal) {
            byTerminal = new Map();
            this.terminalWorldPosCache.set(componentId, byTerminal);
        }

        let pos = byTerminal.get(terminalIndex);
        if (!pos) {
            pos = normalizeCanvasPoint(getTerminalWorldPosition(comp, terminalIndex));
            if (!pos) return null;
            byTerminal.set(terminalIndex, pos);
        }
        return pos;
    }

    ensureSolverPrepared() {
        const needsPrepare = this.solverCircuitDirty || this.solverPreparedTopologyVersion !== this.topologyVersion;
        if (!needsPrepare) return false;

        const components = Array.from(this.components.values());
        const builtNetlist = this.netlistBuilder?.build?.({
            components,
            nodes: this.nodes
        });

        if (builtNetlist && Array.isArray(builtNetlist.components) && Array.isArray(builtNetlist.nodes)) {
            this.netlist = builtNetlist;
            this.solver.setCircuit(builtNetlist);
        } else {
            this.netlist = null;
            this.solver.setCircuit(components, this.nodes);
        }
        if (typeof this.solver.setSimulationState === 'function') {
            this.solver.setSimulationState(this.simulationState);
        }
        this.solverPreparedTopologyVersion = this.topologyVersion;
        this.solverCircuitDirty = false;
        return true;
    }

    /**
     * 添加元器件
     * @param {Object} component - 元器件对象
     */
    addComponent(component) {
        if (
            !component
            || component.id === undefined
            || component.id === null
            || String(component.id).trim() === ''
        ) return;
        component.id = String(component.id);
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
        this.requestTopologyRebuild();
    }

    /**
     * 删除元器件
     * @param {string} id - 元器件ID
     */
    removeComponent(id) {
        if (id === undefined || id === null || String(id).trim() === '') return;
        const normalizedId = String(id);
        this.components.delete(normalizedId);
        this.invalidateComponentTerminalCache(normalizedId);
        this.requestTopologyRebuild();
    }

    /**
     * 添加导线连接
     * @param {Object} wire - 导线对象
     */
    addWire(wire) {
        if (
            !wire
            || wire.id === undefined
            || wire.id === null
            || String(wire.id).trim() === ''
        ) return;
        wire.id = String(wire.id);
        const a = normalizeCanvasPoint(wire.a);
        const b = normalizeCanvasPoint(wire.b);
        if (!a || !b) return;

        wire.a = a;
        wire.b = b;
        this.wires.set(wire.id, wire);
        this.requestTopologyRebuild();
    }

    /**
     * 删除导线
     * @param {string} id - 导线ID
     */
    removeWire(id) {
        if (id === undefined || id === null || String(id).trim() === '') return;
        const normalizedId = String(id);
        this.wires.delete(normalizedId);
        this.removeObservationProbesByWireId(normalizedId);
        this.requestTopologyRebuild();
    }

    /**
     * 获取导线
     * @param {string} id - 导线ID
     * @returns {Object} 导线对象
     */
    getWire(id) {
        if (id === undefined || id === null || String(id).trim() === '') return undefined;
        return this.wires.get(String(id));
    }

    ensureUniqueObservationProbeId(baseId = `probe_${Date.now()}`) {
        return this.observationProbeService.ensureUniqueObservationProbeId(this, baseId);
    }

    normalizeObservationProbe(probe) {
        return this.observationProbeService.normalizeObservationProbe(probe);
    }

    addObservationProbe(probe) {
        return this.observationProbeService.addObservationProbe(this, probe);
    }

    removeObservationProbe(id) {
        return this.observationProbeService.removeObservationProbe(this, id);
    }

    removeObservationProbesByWireId(wireId) {
        return this.observationProbeService.removeObservationProbesByWireId(this, wireId);
    }

    remapObservationProbeWireIds(replacementByRemovedId = {}) {
        return this.observationProbeService.remapObservationProbeWireIds(this, replacementByRemovedId);
    }

    getObservationProbe(id) {
        return this.observationProbeService.getObservationProbe(this, id);
    }

    getAllObservationProbes() {
        return this.observationProbeService.getAllObservationProbes(this);
    }

    getRuntimeReadSnapshot() {
        return {
            topologyVersion: Number.isFinite(this.topologyVersion) ? this.topologyVersion : null,
            simulationVersion: Number.isFinite(this.simulationStepId) ? this.simulationStepId : null,
            components: new Map(Array.from(this.components.entries()).map(([id, component]) => [id, { ...component }])),
            observationProbes: this.getAllObservationProbes(),
            solverShortCircuitDetected: !!this.solver?.shortCircuitDetected,
            shortedSourceIds: Array.isArray(this.shortedSourceIds) ? [...this.shortedSourceIds] : null,
            shortedWireIds: Array.isArray(this.shortedWireIds) ? [...this.shortedWireIds] : null,
            topologyValidationDeferred: this.topologyBatchDepth > 0 || this.topologyRebuildPending
        };
    }

    /**
     * 压缩导线段：
     * 1) 删除零长度导线
     * 2) 合并“共端点 + 共线 + 反向”的两段直线导线
     *
     * 约束：
     * - 不跨越元器件端子坐标进行合并
     * - 不合并包含端子绑定引用(aRef/bRef)的共享端点
     * - 可按 scopeWireIds 只压缩“当前交互相关”的导线
     *
     * @param {{scopeWireIds?: Iterable<string>|null}} options
     * @returns {{changed:boolean, removedIds:string[], replacementByRemovedId:Object<string,string>}}
     */
    compactWires(options = {}) {
        const autoPublishBatch = this.topologyBatchDepth === 0;
        let result = { changed: false, removedIds: [], replacementByRemovedId: {} };

        if (autoPublishBatch) {
            this.beginTopologyBatch();
        }

        try {
            const { changed, removedIds, replacementByRemovedId } = this.wireCompactor.compact({
                components: this.components,
                wires: this.wires,
                scopeWireIds: options.scopeWireIds || null,
                syncWireEndpointsToTerminalRefs: () => this.syncWireEndpointsToTerminalRefs()
            });

            setTopologyReplacementState(this, replacementByRemovedId);

            if (changed) {
                for (const removedId of removedIds) {
                    if (!replacementByRemovedId[removedId]) {
                        this.removeObservationProbesByWireId(removedId);
                    }
                }
                this.remapObservationProbeWireIds(replacementByRemovedId);
                this.connectivityCache.invalidateComponentConnectivityCache(this.components);
                this.requestTopologyRebuild();
            }

            result = { changed, removedIds, replacementByRemovedId };
            return result;
        } finally {
            if (autoPublishBatch) {
                this.endTopologyBatch();
            }
        }
    }

    /**
     * 重建电气节点
     * 使用并查集算法合并连接的端点
     */
    rebuildNodes() {
        this.topologyService.rebuild(this);
    }


    getTopologyState() {
        return getTopologyStateSnapshot(this);
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
                const comp = this.components.get(componentId) || this.components.get(String(componentId));
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
                this.logger?.debug?.(`Rheostat ${id}: terminals connected = [left:${terminalConnected[0]}, right:${terminalConnected[1]}, slider:${terminalConnected[2]}]`);
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
                this.logger?.debug?.(`Rheostat ${id}: connectionMode = ${comp.connectionMode}`);
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
    computeComponentConnectedState(componentId, comp) {
        return this.connectivityCache.computeComponentConnectedState(
            componentId,
            comp,
            this.terminalConnectionMap
        );
    }

    refreshComponentConnectivityCache() {
        return this.connectivityCache.refreshComponentConnectivityCache(
            this.components,
            this.topologyVersion,
            this.terminalConnectionMap,
            (id, comp) => this.computeComponentConnectedState(id, comp)
        );
    }

    isComponentConnected(componentId) {
        if (
            componentId === undefined
            || componentId === null
            || String(componentId).trim() === ''
        ) {
            return false;
        }
        const normalizedId = String(componentId);
        return this.connectivityCache.isComponentConnected(
            normalizedId,
            this.components,
            this.topologyVersion,
            this.terminalConnectionMap,
            (id, comp) => this.computeComponentConnectedState(id, comp)
        );
    }

    /**
     * 获取当前电路中已接入的交流电源最高频率
     * @returns {number}
     */
    getMaxConnectedAcFrequencyHz() {
        let maxFrequency = 0;
        for (const [id, comp] of this.components) {
            if (!comp || comp.type !== 'ACVoltageSource') continue;
            const frequency = Number(comp.frequency);
            if (!Number.isFinite(frequency) || frequency <= 0) continue;
            if (!this.isComponentConnected(id)) continue;
            if (frequency > maxFrequency) maxFrequency = frequency;
        }
        return maxFrequency;
    }

    /**
     * 根据交流频率决定单步仿真的子步数
     * 保证每个交流周期至少有一定采样点数，避免 dt 与周期“相位锁定”
     * @param {number} stepDt
     * @returns {number}
     */
    getSimulationSubstepCount(stepDt = this.dt) {
        return this.simulationLoopService.getSimulationSubstepCount(this, stepDt);
    }

    getAdaptiveDtBounds() {
        const baseDt = Number.isFinite(this.dt) && this.dt > 0 ? this.dt : 0.01;
        const requestedMin = Number.isFinite(this.minAdaptiveDt) && this.minAdaptiveDt > 0
            ? this.minAdaptiveDt
            : baseDt * 0.1;
        const requestedMax = Number.isFinite(this.maxAdaptiveDt) && this.maxAdaptiveDt > 0
            ? this.maxAdaptiveDt
            : baseDt;
        const minDt = Math.min(requestedMin, requestedMax);
        const maxDt = Math.max(requestedMin, requestedMax);
        return { minDt, maxDt, baseDt };
    }

    resetAdaptiveTimeStepState() {
        const { minDt, maxDt, baseDt } = this.getAdaptiveDtBounds();
        this.currentDt = Math.max(minDt, Math.min(maxDt, baseDt));
        this._adaptiveEaseStreak = 0;
    }

    resolveSimulationStepDt() {
        return this.simulationLoopService.resolveSimulationStepDt(this);
    }

    updateAdaptiveTimeStep(results) {
        if (!this.enableAdaptiveTimeStep) return;

        const { minDt, maxDt } = this.getAdaptiveDtBounds();
        const shrinkFactorRaw = Number(this.adaptiveDtShrinkFactor);
        const growFactorRaw = Number(this.adaptiveDtGrowFactor);
        const shrinkFactor = Number.isFinite(shrinkFactorRaw) && shrinkFactorRaw > 0
            ? shrinkFactorRaw
            : 0.5;
        const growFactor = Number.isFinite(growFactorRaw) && growFactorRaw > 1
            ? growFactorRaw
            : 1.5;
        const easeIterationThreshold = Math.max(
            1,
            Math.floor(Number.isFinite(this.adaptiveEaseIterationThreshold) ? this.adaptiveEaseIterationThreshold : 2)
        );
        const easeStreakToGrow = Math.max(
            1,
            Math.floor(Number.isFinite(this.adaptiveEaseStreakToGrow) ? this.adaptiveEaseStreakToGrow : 3)
        );

        const meta = results?.meta || {};
        const converged = !!(results?.valid && meta.converged !== false);
        const iterations = Number.isFinite(meta.iterations) ? meta.iterations : 0;
        const maxIterations = Number.isFinite(meta.maxIterations) ? meta.maxIterations : 0;
        const nearIterationLimit = maxIterations > 0 && iterations >= Math.max(3, maxIterations - 1);
        const hardSolve = !converged || nearIterationLimit;

        if (hardSolve) {
            this.currentDt = Math.max(minDt, this.currentDt * shrinkFactor);
            this._adaptiveEaseStreak = 0;
            return;
        }

        const easySolve = iterations > 0 && iterations <= easeIterationThreshold;
        if (easySolve) {
            this._adaptiveEaseStreak += 1;
            if (this._adaptiveEaseStreak >= easeStreakToGrow) {
                this.currentDt = Math.min(maxDt, this.currentDt * growFactor);
                this._adaptiveEaseStreak = 0;
            }
        } else {
            this._adaptiveEaseStreak = 0;
        }

        this.currentDt = Math.max(minDt, Math.min(maxDt, this.currentDt));
    }

    ensureTopologyReadyForValidation() {
        if (this.topologyBatchDepth === 0 && (this.topologyRebuildPending || this.solverCircuitDirty)) {
            this.rebuildNodes();
        }
    }

    getSourceInstantVoltageAtTime(comp, simTime = this.simTime) {
        return this.topologyValidationService.getSourceInstantVoltageAtTime(this, comp, simTime);
    }

    isIdealVoltageSource(comp) {
        return this.topologyValidationService.isIdealVoltageSource(comp);
    }

    componentProvidesResistiveDamping(comp) {
        return this.topologyValidationService.componentProvidesResistiveDamping(comp);
    }

    detectConflictingIdealSources(simTime = this.simTime) {
        return this.topologyValidationService.detectConflictingIdealSources(this, simTime);
    }

    detectCapacitorLoopWithoutResistance() {
        return this.topologyValidationService.detectCapacitorLoopWithoutResistance(this);
    }

    detectFloatingSubcircuitWarnings() {
        return this.topologyValidationService.detectFloatingSubcircuitWarnings(this);
    }

    validateSimulationTopology(simTime = this.simTime) {
        return this.topologyValidationService.validateSimulationTopology(this, simTime);
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
        this.resetAdaptiveTimeStepState();

        this.resetSimulationState();

        // 重置动态元器件状态
        for (const [_id, comp] of this.components) {
            if (comp.type === 'Capacitor' || comp.type === 'ParallelPlateCapacitor') {
                comp.prevVoltage = 0;
                comp.prevCharge = 0;
                comp.prevCurrent = 0;
                comp._dynamicHistoryReady = false;
            }
            if (comp.type === 'Inductor') {
                const initialCurrent = Number.isFinite(comp.initialCurrent) ? comp.initialCurrent : 0;
                comp.prevCurrent = initialCurrent;
                comp.prevVoltage = 0;
                comp._dynamicHistoryReady = false;
            }
            if (comp.type === 'Motor') {
                comp.speed = 0;
                comp.backEmf = 0;
            }
            if (comp.type === 'Fuse' && !comp.blown) {
                comp.i2tAccum = 0;
            }
            if (comp.type === 'Diode' || comp.type === 'LED') {
                comp.conducting = false;
                if (comp.type === 'LED') {
                    comp.brightness = 0;
                }
            }
            if (comp.type === 'Relay') {
                comp.energized = false;
            }
        }

        // 准备求解器（仅在拓扑/关键参数变化后重建）
        this.solver.debugMode = this.debugMode;
        this.ensureSolverPrepared();

        // 开始模拟循环
        this.simulationInterval = setInterval(() => {
            this.step();
        }, this.dt * 1000);
    }

    resetSimulationState() {
        this.simulationState = new SimulationState();
        this.simulationState.resetForComponents(Array.from(this.components.values()));
        if (typeof this.solver.setSimulationState === 'function') {
            this.solver.setSimulationState(this.simulationState);
        }
    }

    syncSimulationStateToComponents() {
        for (const comp of this.components.values()) {
            const entry = this.simulationState.get(comp.id);
            if (!entry) continue;
            if (comp.type === 'Diode' || comp.type === 'LED') {
                comp.conducting = !!entry.conducting;
            }
            if (comp.type === 'Relay') {
                comp.energized = !!entry.energized;
            }
            if (comp.type === 'Motor') {
                if (Number.isFinite(entry.backEmf)) {
                    comp.backEmf = entry.backEmf;
                }
                if (Number.isFinite(entry.speed)) {
                    comp.speed = entry.speed;
                }
            }
            if (comp.type === 'Capacitor' || comp.type === 'ParallelPlateCapacitor' || comp.type === 'Inductor') {
                if (Number.isFinite(entry.prevCurrent)) comp.prevCurrent = entry.prevCurrent;
                if (Number.isFinite(entry.prevVoltage)) comp.prevVoltage = entry.prevVoltage;
                if (Number.isFinite(entry.prevCharge)) comp.prevCharge = entry.prevCharge;
                if (typeof entry._dynamicHistoryReady === 'boolean') {
                    comp._dynamicHistoryReady = entry._dynamicHistoryReady;
                }
            }
        }
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

    collectRuntimeDiagnostics(results = this.lastResults, simTime = this.simTime) {
        const normalizedResults = (results && typeof results === 'object')
            ? results
            : { voltages: [], currents: new Map(), valid: false };
        const topologyValidationDeferred = this.topologyBatchDepth > 0 || this.topologyRebuildPending;
        this.refreshShortCircuitDiagnostics(normalizedResults);
        const topologyReport = normalizedResults.valid || topologyValidationDeferred
            ? null
            : this.validateSimulationTopology(simTime);
        const diagnostics = this.diagnosticsAdapter.build({
            topologyReport,
            results: normalizedResults,
            topologyVersion: this.topologyVersion,
            simulationVersion: this.simulationStepId,
            solverShortCircuitDetected: !!this.solver?.shortCircuitDetected,
            shortedSourceIds: this.shortedSourceIds,
            shortedWireIds: this.shortedWireIds,
            invalidParameterIssues: this.invalidParameterIssues
        });
        if (topologyValidationDeferred && diagnostics && typeof diagnostics === 'object') {
            diagnostics.topologyValidationDeferred = true;
        }
        return diagnostics;
    }

    attachRuntimeDiagnostics(results = this.lastResults, simTime = this.simTime) {
        const target = (results && typeof results === 'object')
            ? results
            : (this.lastResults && typeof this.lastResults === 'object' ? this.lastResults : null);
        if (!target) return this.diagnosticsAdapter.build();
        const diagnostics = this.collectRuntimeDiagnostics(target, simTime);
        this.diagnosticsAdapter.attach(target, { diagnostics });
        if (target === this.lastResults) {
            this.lastResults.runtimeDiagnostics = diagnostics;
        }
        return diagnostics;
    }

    /**
     * 执行一步模拟
     */
    step() {
        if (!this.isRunning) return;

        // 仅在拓扑或关键参数变化后重建 setCircuit，稳定运行时复用已准备结构
        // 并按子步推进求解与动态状态更新。
        const loopResult = this.simulationLoopService.runStep(this);
        this.lastResults = loopResult.lastResults;
        this.simulationStepId += 1;
        const elapsedStepDt = Number.isFinite(loopResult.elapsedDt) && loopResult.elapsedDt > 0
            ? loopResult.elapsedDt
            : (Number.isFinite(loopResult.stepDt) && loopResult.stepDt > 0 ? loopResult.stepDt : this.dt);
        
        // 调试输出
        if (this.debugMode) {
            this.logger?.debug?.('Nodes:', this.nodes.length);
            this.logger?.debug?.('Voltages:', this.lastResults.voltages);
            for (const [id, comp] of this.components) {
                this.logger?.debug?.(`${comp.type} ${id}: nodes=[${comp.nodes}]`);
            }
        }

        this.attachRuntimeDiagnostics(this.lastResults, this.simTime);

        if (this.lastResults.valid) {
            this.resultProjectionService.applyStepResults(this, this.lastResults, elapsedStepDt);
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
        if (id === undefined || id === null || String(id).trim() === '') return undefined;
        return this.components.get(String(id));
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
        return this.flowAnalysisService.getTerminalCurrentFlow(this, comp, terminalIndex, results);
    }

    getRheostatTerminalFlows(comp, voltages) {
        return this.flowAnalysisService.getRheostatTerminalFlows(comp, voltages);
    }

    getSpdtTerminalFlows(comp, voltages) {
        return this.flowAnalysisService.getSpdtTerminalFlows(comp, voltages);
    }

    getRelayTerminalFlows(comp, voltages) {
        return this.flowAnalysisService.getRelayTerminalFlows(comp, voltages);
    }

    ensureWireFlowCache(results) {
        return this.flowAnalysisService.ensureWireFlowCache(this, results);
    }

    computeWireFlowCache(results) {
        return this.flowAnalysisService.computeWireFlowCache(this, results);
    }

    computeNodeWireFlow(nodeWires, results) {
        return this.flowAnalysisService.computeNodeWireFlow(this, nodeWires, results);
    }

    computeNodeWireFlowPhysical(nodeWires, results) {
        return this.flowAnalysisService.computeNodeWireFlowPhysical(this, nodeWires, results);
    }

    computeNodeWireFlowHeuristic(nodeWires, results) {
        return this.flowAnalysisService.computeNodeWireFlowHeuristic(this, nodeWires, results);
    }

    isIdealVoltmeter(comp) {
        return this.flowAnalysisService.isIdealVoltmeter(comp);
    }

    refreshShortCircuitDiagnostics(results = null) {
        refreshShortCircuitDiagnosticsViaService(this, results);
    }

    /**
     * Whether a wire is on a node that contains a shorted power source.
     * This is a topology-only check; it does not depend on the solver result.
     * @param {Object} wire
     * @returns {boolean}
     */
    isWireInShortCircuit(wire, results = null) {
        return isWireInShortCircuitViaService(this, wire, results);
    }

    /**
     * 获取导线的电流信息
     * @param {Object} wire - 导线对象
     * @param {Object} results - 求解结果
     * @returns {Object} 包含电流、电势和短路信息
     */
    getWireCurrentInfo(wire, results) {
        return getWireCurrentInfoViaService(this, wire, results);
    }

    /**
     * 清空电路
     */
    clear() {
        this.stopSimulation();
        this.components.clear();
        this.wires.clear();
        this.observationProbes.clear();
        this.nodes = [];
        this.netlist = null;
        this.lastResults = null;
        this.simTime = 0;
        this.currentDt = this.dt;
        this._adaptiveEaseStreak = 0;
        this.terminalConnectionMap = new Map();
        this._wireFlowCache = { version: null, map: new Map() };
        this.shortedPowerNodes = new Set();
        this.shortedSourceIds = new Set();
        this.shortedWireIds = new Set();
        this.shortCircuitCacheVersion = null;
        this.topologyBatchDepth = 0;
        this.topologyRebuildPending = false;
        this.topologyVersion = 0;
        this.topologyReplacementByRemovedId = {};
        this.simulationStepId = 0;
        this.solverPreparedTopologyVersion = -1;
        this.solverCircuitDirty = true;
        this.componentTerminalTopologyKeys = new Map();
        this.terminalWorldPosCache = new Map();
        this.simulationState = new SimulationState();
        if (typeof this.solver.setSimulationState === 'function') {
            this.solver.setSimulationState(this.simulationState);
        }
    }

    /**
     * 加载/保存调试开关
     */
    loadDebugFlag() {
        this.debugMode = !!this.persistenceAdapter.loadSolverDebugFlag();
    }

    setDebugMode(flag) {
        this.debugMode = !!flag;
        this.persistenceAdapter.saveSolverDebugFlag(this.debugMode);
        this.solver.debugMode = this.debugMode;
    }

    /**
     * 导出电路为JSON
     * @returns {Object} 电路JSON对象
     */
    toJSON() {
        return CircuitSerializer.serialize(this);
    }

    /**
     * 获取元器件的可保存属性
     * @param {Object} comp - 元器件
     * @returns {Object} 属性对象
     */
    getComponentProperties(comp) {
        return getCircuitComponentProperties(comp);
    }

    /**
     * 从JSON导入电路
     * @param {Object} json - 电路JSON对象
     */
    fromJSON(json) {
        this.clear();
        const loaded = CircuitDeserializer.deserialize(json, {
            normalizeObservationProbe: (probe) => this.normalizeObservationProbe(probe)
        });
        for (const comp of loaded.components) {
            this.components.set(comp.id, comp);
        }
        for (const wire of loaded.wires) {
            this.wires.set(wire.id, wire);
        }
        for (const probe of loaded.probes) {
            const probeId = this.ensureUniqueObservationProbeId(probe.id);
            this.observationProbes.set(probeId, { ...probe, id: probeId });
        }

        this.rebuildNodes();
    }
}
