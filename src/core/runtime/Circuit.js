/**
 * Circuit.js - 电路门面
 * 持有可变电路文档与仿真时钟，把拓扑、步进、投影、诊断交给已有服务。
 */

import { MNASolver } from '../simulation/MNASolver.js';
import { NodeBuilder } from '../topology/NodeBuilder.js';
import { WireCompactor } from '../topology/WireCompactor.js';
import { getTopologyStateSnapshot } from '../topology/TopologyState.js';
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
import { resolveComponentViewRecord } from '../../utils/componentViewRecord.js';
import {
    getWireCurrentInfo as getWireCurrentInfoViaService,
    isWireInShortCircuit as isWireInShortCircuitViaService,
    refreshShortCircuitDiagnostics as refreshShortCircuitDiagnosticsViaService
} from './CircuitShortCircuitDiagnosticsService.js';

export class Circuit {
    constructor(options = {}) {
        this.components = new Map();
        this.wires = new Map();
        this.observationProbes = new Map();
        this.nodes = [];
        this._solver = null;
        this.isRunning = false;
        this.lastResults = null;
        this.dt = 0.01;
        this.currentDt = this.dt;
        this.enableAdaptiveTimeStep = false;
        this.minAdaptiveDt = this.dt * 0.1;
        this.maxAdaptiveDt = this.dt;
        this.adaptiveDtShrinkFactor = 0.5;
        this.adaptiveDtGrowFactor = 1.5;
        this.adaptiveEaseIterationThreshold = 2;
        this.adaptiveEaseStreakToGrow = 3;
        this._adaptiveEaseStreak = 0;
        this.simTime = 0;
        this.minAcSamplesPerCycle = 40;
        this.maxAcSubstepsPerStep = 200;
        this._wireFlowCache = { version: null, map: new Map() };
        this.terminalConnectionMap = new Map();
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
        this.nodeBuilder = new NodeBuilder();
        this.wireCompactor = new WireCompactor();
        this.connectivityCache = new ConnectivityCache();
        this.topologyService = new CircuitTopologyService();
        this.simulationLoopService = new CircuitSimulationLoopService();
        this.observationProbeService = options.observationProbeService || new CircuitObservationProbeService();
        this.topologyValidationService = options.topologyValidationService || new CircuitTopologyValidationService();
        this.flowAnalysisService = options.flowAnalysisService || new CircuitFlowAnalysisService();
        this.resultProjectionService = options.resultProjectionService || new CircuitResultProjectionService();
        this.componentTerminalTopologyKeys = new Map();
        this.terminalWorldPosCache = new Map();
        this.simulationState = new SimulationState();
        this.netlistBuilder = new NetlistBuilder();
        this.netlist = null;
        this.debugMode = false;
        this.logger = createRuntimeLogger({ scope: 'circuit' });
        this.persistenceAdapter = options.persistenceAdapter || new CircuitPersistenceAdapter({
            storage: options.storage || null
        });
        this.diagnosticsAdapter = options.diagnosticsAdapter || new CircuitDiagnosticsAdapter();
        this.loadDebugFlag();
    }

    get solver() {
        if (!this._solver) {
            this._solver = new MNASolver();
            this._solver.setLogger?.(this.logger?.child?.('solver') || this.logger);
            this._solver.debugMode = this.debugMode;
        }
        return this._solver;
    }

    set solver(value) {
        this._solver = value;
    }

    setLogger(logger) {
        this.logger = logger || createRuntimeLogger({ scope: 'circuit' });
        this._solver?.setLogger?.(this.logger.child?.('solver') || this.logger);
    }

    beginTopologyBatch() {
        return this.topologyService.beginBatch(this);
    }

    endTopologyBatch(options = {}) {
        return this.topologyService.endBatch(this, options);
    }

    requestTopologyRebuild() {
        return this.topologyService.requestRebuild(this);
    }

    markSolverCircuitDirty() {
        this.topologyService.markSolverDirty(this);
    }

    invalidateComponentTerminalCache(componentId) {
        this.topologyService.invalidateComponentTerminalCache(this, componentId);
    }

    buildComponentTerminalTopologyKey(comp) {
        return this.topologyService.buildComponentTerminalTopologyKey(comp);
    }

    getTerminalWorldPositionCached(componentId, terminalIndex, comp) {
        return this.topologyService.getTerminalWorldPositionCached(this, componentId, terminalIndex, comp);
    }

    ensureSolverPrepared() {
        return this.simulationLoopService.ensureSolverPrepared(this);
    }

    addComponent(component) {
        this.topologyService.addComponent(this, component);
    }

    removeComponent(id) {
        this.topologyService.removeComponent(this, id);
    }

    addWire(wire) {
        this.topologyService.addWire(this, wire);
    }

    removeWire(id) {
        this.topologyService.removeWire(this, id);
    }

    getWire(id) {
        return this.topologyService.getWire(this, id);
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
            solverShortCircuitDetected: !!this._solver?.shortCircuitDetected,
            shortedSourceIds: Array.isArray(this.shortedSourceIds) ? [...this.shortedSourceIds] : null,
            shortedWireIds: Array.isArray(this.shortedWireIds) ? [...this.shortedWireIds] : null,
            topologyValidationDeferred: this.topologyBatchDepth > 0 || this.topologyRebuildPending
        };
    }

    compactWires(options = {}) {
        return this.topologyService.compactWires(this, options);
    }

    rebuildNodes() {
        this.topologyService.rebuild(this);
    }

    getTopologyState() {
        return getTopologyStateSnapshot(this);
    }

    syncWireEndpointsToTerminalRefs() {
        this.topologyService.syncWireEndpointsToTerminalRefs(this);
    }

    detectRheostatConnections() {
        this.topologyService.detectRheostatConnections(this);
    }

    calculateRheostatActiveResistance(comp) {
        this.topologyService.calculateRheostatActiveResistance(comp);
    }

    computeComponentConnectedState(componentId, comp) {
        return this.topologyService.computeComponentConnectedState(this, componentId, comp);
    }

    refreshComponentConnectivityCache() {
        return this.topologyService.refreshComponentConnectivityCache(this);
    }

    isComponentConnected(componentId) {
        return this.topologyService.isComponentConnected(this, componentId);
    }

    getMaxConnectedAcFrequencyHz() {
        return this.simulationLoopService.getMaxConnectedAcFrequencyHz(this);
    }

    getSimulationSubstepCount(stepDt = this.dt) {
        return this.simulationLoopService.getSimulationSubstepCount(this, stepDt);
    }

    getAdaptiveDtBounds() {
        return this.simulationLoopService.getAdaptiveDtBounds(this);
    }

    resetAdaptiveTimeStepState() {
        this.simulationLoopService.resetAdaptiveTimeStepState(this);
    }

    resolveSimulationStepDt() {
        return this.simulationLoopService.resolveSimulationStepDt(this);
    }

    updateAdaptiveTimeStep(results) {
        this.simulationLoopService.updateAdaptiveTimeStep(this, results);
    }

    ensureTopologyReadyForValidation() {
        this.topologyService.ensureReadyForValidation(this);
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

    prepareSimulation() {
        this.simulationLoopService.prepareSimulation(this);
    }

    startSimulation() {
        this.prepareSimulation();
    }

    resetSimulationState() {
        this.simulationLoopService.resetSimulationState(this);
    }

    syncSimulationStateToComponents() {
        this.simulationLoopService.syncSimulationStateToComponents(this);
    }

    haltSimulation() {
        this.simulationLoopService.haltSimulation(this);
    }

    stopSimulation() {
        this.haltSimulation();
    }

    collectRuntimeDiagnostics(results = this.lastResults, simTime = this.simTime) {
        const normalizedResults = (results && typeof results === 'object')
            ? results
            : { voltages: [], currents: new Map(), valid: false };
        const topologyValidationDeferred = this.topologyBatchDepth > 0 || this.topologyRebuildPending;
        this.refreshShortCircuitDiagnostics(normalizedResults);
        const topologyReport = topologyValidationDeferred
            ? null
            : this.validateSimulationTopology(simTime);
        const diagnostics = this.diagnosticsAdapter.build({
            topologyReport,
            results: normalizedResults,
            topologyVersion: this.topologyVersion,
            simulationVersion: this.simulationStepId,
            solverShortCircuitDetected: !!this._solver?.shortCircuitDetected,
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

    step() {
        if (!this.isRunning) return;

        const loopResult = this.simulationLoopService.runStep(this);
        this.lastResults = loopResult.lastResults;
        this.simulationStepId += 1;

        if (this.debugMode) {
            this.logger?.debug?.('Nodes:', this.nodes.length);
            this.logger?.debug?.('Voltages:', this.lastResults.voltages);
            for (const [id, comp] of this.components) {
                this.logger?.debug?.(`${comp.type} ${id}: nodes=[${comp.nodes}]`);
            }
        }

        this.attachRuntimeDiagnostics(this.lastResults, this.simTime);

        if (this.lastResults.valid && this.lastResults.backendUsed !== 'v2') {
            this.resultProjectionService?.updateComponentDisplayValues?.(this, this.lastResults);
        }

        if (this.onUpdate) {
            this.onUpdate(this.lastResults);
        }
    }

    getComponent(id) {
        return this.topologyService.getComponent(this, id);
    }

    getAllComponents() {
        return this.topologyService.getAllComponents(this);
    }

    getAllWires() {
        return this.topologyService.getAllWires(this);
    }

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

    isWireInShortCircuit(wire, results = null) {
        return isWireInShortCircuitViaService(this, wire, results);
    }

    getWireCurrentInfo(wire, results) {
        return getWireCurrentInfoViaService(this, wire, results);
    }

    resetRuntimeCaches() {
        this.simulationLoopService.resetRuntimeCaches(this);
    }

    replaceLoadedCircuit(loaded) {
        this.resetRuntimeCaches();
        this.components = new Map();
        this.wires = new Map();
        this.observationProbes = new Map();
        for (const comp of loaded.components || []) {
            this.components.set(comp.id, comp);
        }
        for (const wire of loaded.wires || []) {
            this.wires.set(wire.id, wire);
        }
        for (const probe of loaded.probes || []) {
            const probeId = this.ensureUniqueObservationProbeId(probe.id);
            this.observationProbes.set(probeId, { ...probe, id: probeId });
        }
        this.rebuildNodes();
        this.markSolverCircuitDirty();
    }

    clear() {
        this.resetRuntimeCaches();
        this.components = new Map();
        this.wires = new Map();
        this.observationProbes = new Map();
    }

    loadDebugFlag() {
        this.debugMode = !!this.persistenceAdapter.loadSolverDebugFlag();
    }

    setDebugMode(flag) {
        this.debugMode = !!flag;
        this.persistenceAdapter.saveSolverDebugFlag(this.debugMode);
        if (this._solver) this._solver.debugMode = this.debugMode;
    }

    toJSON() {
        return CircuitSerializer.serialize(this);
    }

    getComponentProperties(comp) {
        return getCircuitComponentProperties(
            resolveComponentViewRecord(comp, this.lastResults?.viewMap)
        );
    }

    fromJSON(json) {
        const loaded = CircuitDeserializer.deserialize(json, {
            normalizeObservationProbe: (probe) => this.normalizeObservationProbe(probe)
        });
        this.replaceLoadedCircuit(loaded);
    }
}
