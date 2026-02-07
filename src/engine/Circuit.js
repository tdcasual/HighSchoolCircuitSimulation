/**
 * Circuit.js - 电路管理器
 * 管理电路中的节点、元器件和连接
 */

import { MNASolver } from './Solver.js';
import { Matrix } from './Matrix.js';
import { createComponent, getComponentTerminalCount } from '../components/Component.js';
import { computeOverlapFractionFromOffsetPx, computeParallelPlateCapacitance } from '../utils/Physics.js';
import { getTerminalWorldPosition } from '../utils/TerminalGeometry.js';
import { normalizeCanvasPoint, pointKey, toCanvasInt } from '../utils/CanvasCoords.js';

export class Circuit {
    constructor() {
        this.components = new Map();  // id -> component
        this.wires = new Map();       // id -> wire
        this.observationProbes = new Map(); // id -> probe
        this.nodes = [];              // 电气节点列表
        this.solver = new MNASolver();
        this.isRunning = false;
        this.lastResults = null;
        this.simulationInterval = null;
        this.dt = 0.01;               // 10ms 时间步长
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
        this.solverPreparedTopologyVersion = -1;
        this.solverCircuitDirty = true;
        this.componentTerminalTopologyKeys = new Map(); // componentId -> topology key used for terminal geometry cache
        this.terminalWorldPosCache = new Map(); // componentId -> Map(terminalIndex -> {x,y})
        this.debugMode = false;
        this.loadDebugFlag();
        this.solver.debugMode = this.debugMode;
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
        if (!componentId) return;
        this.componentTerminalTopologyKeys.delete(componentId);
        this.terminalWorldPosCache.delete(componentId);
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

        this.solver.setCircuit(
            Array.from(this.components.values()),
            this.nodes
        );
        this.solverPreparedTopologyVersion = this.topologyVersion;
        this.solverCircuitDirty = false;
        return true;
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
        this.requestTopologyRebuild();
    }

    /**
     * 删除元器件
     * @param {string} id - 元器件ID
     */
    removeComponent(id) {
        this.components.delete(id);
        this.invalidateComponentTerminalCache(id);
        this.requestTopologyRebuild();
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
        this.requestTopologyRebuild();
    }

    /**
     * 删除导线
     * @param {string} id - 导线ID
     */
    removeWire(id) {
        this.wires.delete(id);
        this.removeObservationProbesByWireId(id);
        this.requestTopologyRebuild();
    }

    /**
     * 获取导线
     * @param {string} id - 导线ID
     * @returns {Object} 导线对象
     */
    getWire(id) {
        return this.wires.get(id);
    }

    ensureUniqueObservationProbeId(baseId = `probe_${Date.now()}`) {
        if (!this.observationProbes.has(baseId)) return baseId;
        let i = 1;
        while (this.observationProbes.has(`${baseId}_${i}`)) i += 1;
        return `${baseId}_${i}`;
    }

    normalizeObservationProbe(probe) {
        if (!probe || typeof probe !== 'object') return null;
        const type = probe.type;
        if (type !== 'NodeVoltageProbe' && type !== 'WireCurrentProbe') return null;
        if (!probe.id) return null;
        if (!probe.wireId) return null;
        return {
            id: String(probe.id),
            type,
            wireId: String(probe.wireId),
            label: typeof probe.label === 'string' ? probe.label : null
        };
    }

    addObservationProbe(probe) {
        const normalized = this.normalizeObservationProbe(probe);
        if (!normalized) return null;
        this.observationProbes.set(normalized.id, normalized);
        return normalized;
    }

    removeObservationProbe(id) {
        if (!id) return false;
        return this.observationProbes.delete(String(id));
    }

    removeObservationProbesByWireId(wireId) {
        if (!wireId) return;
        const target = String(wireId);
        for (const [id, probe] of this.observationProbes.entries()) {
            if (probe?.wireId === target) {
                this.observationProbes.delete(id);
            }
        }
    }

    remapObservationProbeWireIds(replacementByRemovedId = {}) {
        if (!replacementByRemovedId || typeof replacementByRemovedId !== 'object') return;
        for (const probe of this.observationProbes.values()) {
            if (!probe?.wireId) continue;
            let current = probe.wireId;
            const seen = new Set();
            while (replacementByRemovedId[current] && !seen.has(current)) {
                seen.add(current);
                current = replacementByRemovedId[current];
            }
            probe.wireId = current;
        }
    }

    getObservationProbe(id) {
        if (!id) return undefined;
        return this.observationProbes.get(String(id));
    }

    getAllObservationProbes() {
        return Array.from(this.observationProbes.values());
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
        this.syncWireEndpointsToTerminalRefs();
        const scoped = options.scopeWireIds
            ? new Set(Array.from(options.scopeWireIds).filter(Boolean))
            : null;

        const removedIds = [];
        const replacementByRemovedId = {};
        let changed = false;

        const setEndpoint = (wire, end, point, ref) => {
            if (!wire || (end !== 'a' && end !== 'b') || !point) return;
            wire[end] = {
                x: toCanvasInt(point.x),
                y: toCanvasInt(point.y)
            };
            const refKey = end === 'a' ? 'aRef' : 'bRef';
            if (ref && ref.componentId !== undefined && Number.isInteger(ref.terminalIndex)) {
                wire[refKey] = {
                    componentId: ref.componentId,
                    terminalIndex: ref.terminalIndex
                };
            } else {
                delete wire[refKey];
            }
        };

        const removeWireById = (wireId) => {
            if (!this.wires.has(wireId)) return;
            this.wires.delete(wireId);
            removedIds.push(wireId);
            changed = true;
        };

        // 先清理零长度导线，避免后续拓扑分析被噪声干扰。
        for (const [wireId, wire] of Array.from(this.wires.entries())) {
            if (scoped && !scoped.has(wireId)) continue;
            const a = normalizeCanvasPoint(wire?.a);
            const b = normalizeCanvasPoint(wire?.b);
            if (!a || !b) {
                removeWireById(wireId);
                continue;
            }
            wire.a = a;
            wire.b = b;
            if (a.x === b.x && a.y === b.y) {
                removeWireById(wireId);
            }
        }

        const terminalCoordKeys = new Set();
        for (const [, comp] of this.components) {
            const terminalCount = getComponentTerminalCount(comp.type);
            for (let terminalIndex = 0; terminalIndex < terminalCount; terminalIndex++) {
                const pos = getTerminalWorldPosition(comp, terminalIndex);
                const key = pointKey(pos);
                if (!key) continue;
                terminalCoordKeys.add(key);
            }
        }

        const getOtherEnd = (wire, end) => {
            if (end === 'a') {
                return { end: 'b', point: wire?.b, ref: wire?.bRef };
            }
            return { end: 'a', point: wire?.a, ref: wire?.aRef };
        };

        const isCollinearAndOpposite = (shared, p1, p2) => {
            const v1x = p1.x - shared.x;
            const v1y = p1.y - shared.y;
            const v2x = p2.x - shared.x;
            const v2y = p2.y - shared.y;
            const cross = v1x * v2y - v1y * v2x;
            if (Math.abs(cross) > 1e-6) return false;
            const dot = v1x * v2x + v1y * v2y;
            return dot < 0;
        };

        let mergedInPass = true;
        while (mergedInPass) {
            mergedInPass = false;

            const endpointBuckets = new Map(); // coordKey -> [{wireId,end,point}]
            for (const [wireId, wire] of this.wires.entries()) {
                for (const end of ['a', 'b']) {
                    const pt = normalizeCanvasPoint(wire?.[end]);
                    if (!pt) continue;
                    const key = pointKey(pt);
                    if (!key) continue;
                    if (!endpointBuckets.has(key)) endpointBuckets.set(key, []);
                    endpointBuckets.get(key).push({ wireId, end, point: pt });
                }
            }

            for (const [coordKey, endpoints] of endpointBuckets.entries()) {
                if (!Array.isArray(endpoints) || endpoints.length !== 2) continue;
                if (terminalCoordKeys.has(coordKey)) continue;

                const first = endpoints[0];
                const second = endpoints[1];
                if (!first || !second) continue;
                if (first.wireId === second.wireId) continue;
                if (scoped && !scoped.has(first.wireId) && !scoped.has(second.wireId)) continue;

                const wireA = this.wires.get(first.wireId);
                const wireB = this.wires.get(second.wireId);
                if (!wireA || !wireB) continue;

                const sharedRefKeyA = first.end === 'a' ? 'aRef' : 'bRef';
                const sharedRefKeyB = second.end === 'a' ? 'aRef' : 'bRef';
                if (wireA[sharedRefKeyA] || wireB[sharedRefKeyB]) continue;

                const otherA = getOtherEnd(wireA, first.end);
                const otherB = getOtherEnd(wireB, second.end);
                const pA = normalizeCanvasPoint(otherA.point);
                const pB = normalizeCanvasPoint(otherB.point);
                if (!pA || !pB) continue;

                const shared = first.point;
                const keyA = pointKey(pA);
                const keyB = pointKey(pB);

                if (keyA && keyB && keyA === keyB) {
                    const refsConflict = otherA.ref && otherB.ref
                        && (
                            otherA.ref.componentId !== otherB.ref.componentId
                            || otherA.ref.terminalIndex !== otherB.ref.terminalIndex
                        );
                    if (refsConflict) continue;
                    const mergedRef = otherA.ref || otherB.ref || null;
                    setEndpoint(wireA, otherA.end, pA, mergedRef);
                    removeWireById(wireB.id);
                    replacementByRemovedId[wireB.id] = wireA.id;
                    mergedInPass = true;
                    break;
                }

                if (!isCollinearAndOpposite(shared, pA, pB)) continue;

                setEndpoint(wireA, 'a', pA, otherA.ref);
                setEndpoint(wireA, 'b', pB, otherB.ref);
                removeWireById(wireB.id);
                replacementByRemovedId[wireB.id] = wireA.id;
                mergedInPass = true;
                break;
            }
        }

        if (changed) {
            for (const removedId of removedIds) {
                if (!replacementByRemovedId[removedId]) {
                    this.removeObservationProbesByWireId(removedId);
                }
            }
            this.remapObservationProbeWireIds(replacementByRemovedId);
        }

        return { changed, removedIds, replacementByRemovedId };
    }

    /**
     * 重建电气节点
     * 使用并查集算法合并连接的端点
     */
    rebuildNodes() {
        // Keep any terminal-bound wire endpoints synced to the current terminal geometry
        // before we rebuild the coordinate-based connectivity graph.
        this.syncWireEndpointsToTerminalRefs();

        // Invalidate stale terminal geometry cache entries for removed components.
        for (const cachedId of Array.from(this.componentTerminalTopologyKeys.keys())) {
            if (!this.components.has(cachedId)) {
                this.componentTerminalTopologyKeys.delete(cachedId);
                this.terminalWorldPosCache.delete(cachedId);
            }
        }

        // Refresh per-component terminal geometry cache keys.
        for (const [id, comp] of this.components) {
            const nextKey = this.buildComponentTerminalTopologyKey(comp);
            const prevKey = this.componentTerminalTopologyKeys.get(id);
            if (prevKey !== nextKey) {
                this.componentTerminalTopologyKeys.set(id, nextKey);
                this.terminalWorldPosCache.delete(id);
            }
        }

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
            const pos = this.getTerminalWorldPositionCached(componentId, terminalIndex, comp);
            if (!pos) return;
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
            const terminalCount = getComponentTerminalCount(comp.type);
            for (let terminalIndex = 0; terminalIndex < terminalCount; terminalIndex++) {
                registerTerminal(id, terminalIndex, comp);
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
            const terminalCount = getComponentTerminalCount(comp.type);
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

        // Prefer explicit Ground terminal as reference node.
        let groundRoot = null;
        let fallbackGroundRoot = null;
        for (const [id, comp] of this.components) {
            if (comp.type !== 'Ground') continue;
            const tKey = `${id}:0`;
            const postId = getTerminalPostId(id, 0);
            const root = find(postId);
            if (!fallbackGroundRoot) {
                fallbackGroundRoot = root;
            }
            if (connectedTerminals.has(tKey)) {
                groundRoot = root;
                assignNodeIfNeeded(root);
                break;
            }
        }

        // Fallback: connected power source negative terminal.
        for (const [id, comp] of this.components) {
            if (groundRoot) break;
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

        // If explicit Ground exists but is currently isolated, still use it as reference.
        if (!groundRoot && fallbackGroundRoot) {
            groundRoot = fallbackGroundRoot;
            assignNodeIfNeeded(groundRoot);
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
            const terminalCount = getComponentTerminalCount(comp.type);
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
        const shortedSources = new Set();
        for (const comp of this.components.values()) {
            if (comp.type !== 'PowerSource' && comp.type !== 'ACVoltageSource') continue;
            const n0 = comp.nodes?.[0];
            const n1 = comp.nodes?.[1];
            if (n0 !== undefined && n0 >= 0 && n0 === n1) {
                shorted.add(n0);
                shortedSources.add(comp.id);
            }
        }
        this.shortedPowerNodes = shorted;
        this.shortedSourceIds = shortedSources;
        this.shortedWireIds = new Set();
        this.shortCircuitCacheVersion = null;
        this.topologyVersion += 1;
        this.refreshComponentConnectivityCache();
        this.markSolverCircuitDirty();
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
    computeComponentConnectedState(componentId, comp) {
        if (!comp || !Array.isArray(comp.nodes)) return false;
        const terminalCount = getComponentTerminalCount(comp.type);

        const hasValidNode = (idx) => idx !== undefined && idx !== null && idx >= 0;
        const hasTerminalWire = (terminalIndex) => {
            const key = `${componentId}:${terminalIndex}`;
            return (this.terminalConnectionMap.get(key) || 0) > 0;
        };

        if (comp.type === 'Ground') {
            return hasValidNode(comp.nodes[0]) && hasTerminalWire(0);
        }

        if (comp.type !== 'Rheostat' && comp.type !== 'SPDTSwitch') {
            if (terminalCount < 2) return false;
            return hasValidNode(comp.nodes[0]) && hasValidNode(comp.nodes[1])
                && hasTerminalWire(0) && hasTerminalWire(1);
        }

        if (comp.type === 'SPDTSwitch') {
            const routeToB = comp.position === 'b';
            const targetTerminal = routeToB ? 2 : 1;
            return hasValidNode(comp.nodes[0]) && hasValidNode(comp.nodes[targetTerminal])
                && hasTerminalWire(0) && hasTerminalWire(targetTerminal);
        }

        // 滑动变阻器需要至少两个不同节点接入，且端子必须真正接线
        const connectedTerminals = comp.nodes
            .map((nodeIdx, idx) => ({ nodeIdx, idx }))
            .filter(({ nodeIdx, idx }) => hasValidNode(nodeIdx) && hasTerminalWire(idx));
        if (connectedTerminals.length < 2) return false;
        const uniqueNodes = new Set(connectedTerminals.map(t => t.nodeIdx));
        return uniqueNodes.size >= 2;
    }

    refreshComponentConnectivityCache() {
        for (const [id, comp] of this.components) {
            comp._isConnectedCached = this.computeComponentConnectedState(id, comp);
            comp._connectionTopologyVersion = this.topologyVersion;
        }
    }

    isComponentConnected(componentId) {
        const comp = this.components.get(componentId);
        if (!comp || !Array.isArray(comp.nodes)) return false;

        if (comp._connectionTopologyVersion === this.topologyVersion
            && typeof comp._isConnectedCached === 'boolean') {
            return comp._isConnectedCached;
        }

        const connected = this.computeComponentConnectedState(componentId, comp);
        comp._isConnectedCached = connected;
        comp._connectionTopologyVersion = this.topologyVersion;
        return connected;
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
        const dt = Number.isFinite(stepDt) && stepDt > 0
            ? stepDt
            : (Number.isFinite(this.dt) && this.dt > 0 ? this.dt : 0.01);
        const maxFrequency = this.getMaxConnectedAcFrequencyHz();
        if (!Number.isFinite(maxFrequency) || maxFrequency <= 0) return 1;

        const samplesPerCycle = Math.max(4, Math.floor(this.minAcSamplesPerCycle || 40));
        const maxSubsteps = Math.max(1, Math.floor(this.maxAcSubstepsPerStep || 200));
        const requiredSubsteps = Math.ceil(dt * maxFrequency * samplesPerCycle);
        return Math.max(1, Math.min(maxSubsteps, requiredSubsteps));
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
        }

        // 准备求解器（仅在拓扑/关键参数变化后重建）
        this.solver.debugMode = this.debugMode;
        this.ensureSolverPrepared();

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

        // 仅在拓扑或关键参数变化后重建 setCircuit，稳定运行时复用已准备结构
        this.ensureSolverPrepared();
        this.solver.debugMode = this.debugMode;
        
        // 交流电路子步进：避免 dt 与交流周期相位锁定导致采样失真
        const substepCount = this.getSimulationSubstepCount(this.dt);
        const substepDt = this.dt / substepCount;
        let latestResults = null;

        for (let index = 0; index < substepCount; index++) {
            const substepResults = this.solver.solve(substepDt, this.simTime);
            latestResults = substepResults;
            if (!substepResults.valid) break;

            this.simTime += substepDt;
            this.solver.updateDynamicComponents(substepResults.voltages, substepResults.currents);
        }
        this.lastResults = latestResults || { voltages: [], currents: new Map(), valid: false };
        
        // 调试输出
        if (this.debugMode) {
            console.log('Nodes:', this.nodes.length);
            console.log('Voltages:', this.lastResults.voltages);
            for (const [id, comp] of this.components) {
                console.log(`${comp.type} ${id}: nodes=[${comp.nodes}]`);
            }
        }

        this.refreshShortCircuitDiagnostics(this.lastResults);

        if (this.lastResults.valid) {
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
                    if (comp.type === 'Diode' || comp.type === 'LED') {
                        comp.conducting = false;
                    }
                    if (comp.type === 'Bulb' || comp.type === 'LED') {
                        comp.brightness = 0;
                    }
                    continue;
                }

                if (comp.type === 'Ground') {
                    comp.currentValue = 0;
                    comp.voltageValue = 0;
                    comp.powerValue = 0;
                    continue;
                }
                
                // 检查元器件是否被短路（两端节点相同）
                const isFiniteResistanceSource = (comp.type === 'PowerSource' || comp.type === 'ACVoltageSource')
                    && Number.isFinite(Number(comp.internalResistance))
                    && Number(comp.internalResistance) > 1e-9;
                if (comp._isShorted && !isFiniteResistanceSource) {
                    comp.currentValue = 0;
                    comp.voltageValue = 0;
                    comp.powerValue = 0;
                    if (comp.type === 'Bulb' || comp.type === 'LED') {
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
                if (comp.type === 'PowerSource' || comp.type === 'ACVoltageSource') {
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
                } else if (comp.type === 'SPDTSwitch') {
                    const routeToB = comp.position === 'b';
                    const targetIdx = routeToB ? 2 : 1;
                    const vCommon = this.lastResults.voltages[comp.nodes[0]] || 0;
                    const vTarget = this.lastResults.voltages[comp.nodes[targetIdx]] || 0;
                    const voltage = Math.abs(vCommon - vTarget);
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
                if (comp.type === 'LED') {
                    const ratedCurrent = Math.max(1e-6, Number(comp.ratedCurrent) || 0.02);
                    const currentAbs = Math.abs(current);
                    comp.brightness = comp.conducting ? Math.min(1, currentAbs / ratedCurrent) : 0;
                }
            }

            // 更新保险丝 I²t 累计并判定是否熔断
            let fuseStateChanged = false;
            for (const [id, comp] of this.components) {
                if (comp.type !== 'Fuse') continue;
                if (comp.blown) continue;
                if (!this.isComponentConnected(id)) continue;

                const currentAbs = Math.abs(this.lastResults.currents.get(id) || 0);
                if (!Number.isFinite(currentAbs)) continue;

                const ratedCurrent = Math.max(1e-6, Number(comp.ratedCurrent) || 3);
                const defaultThreshold = ratedCurrent * ratedCurrent * 0.2;
                const threshold = Math.max(1e-9, Number(comp.i2tThreshold) || defaultThreshold);
                comp.i2tAccum = Math.max(0, Number(comp.i2tAccum) || 0) + currentAbs * currentAbs * this.dt;
                if (comp.i2tAccum >= threshold) {
                    comp.blown = true;
                    fuseStateChanged = true;
                }
            }
            if (fuseStateChanged) {
                this.markSolverCircuitDirty();
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
        if (comp.type === 'SPDTSwitch') {
            const flows = this.getSpdtTerminalFlows(comp, results.voltages);
            return flows[terminalIndex] || 0;
        }
        
        // 理想电压表：内阻无穷大，不应该有电流
        if (this.isIdealVoltmeter(comp)) {
            return 0; // 理想电压表的端子不输出电流
        }

        // 判定为"主动"器件的列表（正电流表示端子0向外输出）
        const isActiveSource = (
            comp.type === 'PowerSource' ||
            comp.type === 'ACVoltageSource' ||
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

    /**
     * 计算单刀双掷开关各端子的等效电流流向
     * 端子: 0=公共端, 1=上掷(a), 2=下掷(b)
     * @param {Object} comp
     * @param {number[]} voltages
     * @returns {number[]}
     */
    getSpdtTerminalFlows(comp, voltages) {
        const flows = [0, 0, 0];
        const routeToB = comp.position === 'b';
        const targetIdx = routeToB ? 2 : 1;
        const commonNode = comp.nodes?.[0];
        const targetNode = comp.nodes?.[targetIdx];
        if (commonNode == null || commonNode < 0 || targetNode == null || targetNode < 0) {
            return flows;
        }

        const vCommon = voltages[commonNode] || 0;
        const vTarget = voltages[targetNode] || 0;
        const R = Math.max(1e-9, Number(comp.onResistance) || 1e-9);
        const I = (vCommon - vTarget) / R;
        flows[0] = -I;
        flows[targetIdx] = I;
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

    refreshShortCircuitDiagnostics(results = null) {
        const isValidNode = (nodeIdx) => nodeIdx !== undefined && nodeIdx !== null && nodeIdx >= 0;
        const shortedSources = new Set();
        const shortedNodes = new Set();
        const shortedWireIds = new Set();
        const directShortTerminalKeys = new Set();
        const nodeShortCurrent = new Map();

        const hasValidResults = !!(results && results.valid);
        const shortCurrentRatio = 0.95;
        const lowVoltageRatio = 0.05;
        const lowVoltageAbs = 0.05;

        const updateNodeShortCurrent = (nodeIdx, currentAbs) => {
            if (!isValidNode(nodeIdx)) return;
            if (!(Number.isFinite(currentAbs) && currentAbs > 0)) return;
            const prev = nodeShortCurrent.get(nodeIdx) || 0;
            if (currentAbs > prev) {
                nodeShortCurrent.set(nodeIdx, currentAbs);
            }
        };

        for (const comp of this.components.values()) {
            if (comp.type !== 'PowerSource' && comp.type !== 'ACVoltageSource') continue;
            const n0 = comp.nodes?.[0];
            const n1 = comp.nodes?.[1];
            if (!isValidNode(n0) || !isValidNode(n1)) continue;

            const topologicalShort = n0 === n1;
            let runtimeShort = false;
            let sourceCurrentAbs = 0;

            if (hasValidResults) {
                sourceCurrentAbs = Math.abs(results.currents?.get(comp.id) || 0);
            }

            if (hasValidResults && !topologicalShort) {
                const internalResistance = Number(comp.internalResistance);
                if (Number.isFinite(internalResistance) && internalResistance > 1e-9) {
                    const sourceVoltage = this.solver.getSourceInstantVoltage(comp);
                    const sourceVoltageAbs = Math.abs(sourceVoltage);
                    const shortCurrent = sourceVoltageAbs / internalResistance;
                    const terminalVoltage = Math.abs((results.voltages[n0] || 0) - (results.voltages[n1] || 0));
                    const voltageTol = Math.max(lowVoltageAbs, sourceVoltageAbs * lowVoltageRatio);
                    runtimeShort = shortCurrent > 0
                        && sourceCurrentAbs >= shortCurrent * shortCurrentRatio
                        && terminalVoltage <= voltageTol;
                }
            }

            if (!(topologicalShort || runtimeShort)) continue;

            shortedSources.add(comp.id);
            shortedNodes.add(n0);
            shortedNodes.add(n1);
            updateNodeShortCurrent(n0, sourceCurrentAbs);
            updateNodeShortCurrent(n1, sourceCurrentAbs);

            if (topologicalShort) {
                const p0 = this.getTerminalWorldPositionCached(comp.id, 0, comp);
                const p1 = this.getTerminalWorldPositionCached(comp.id, 1, comp);
                const key0 = pointKey(p0);
                const key1 = pointKey(p1);
                if (key0) directShortTerminalKeys.add(key0);
                if (key1) directShortTerminalKeys.add(key1);
            }
        }

        if (hasValidResults) {
            this.ensureWireFlowCache(results);
            for (const wire of this.wires.values()) {
                const node = Number.isFinite(wire?.nodeIndex) ? wire.nodeIndex : -1;
                if (node < 0 || !shortedNodes.has(node)) continue;
                const expectedShortCurrent = nodeShortCurrent.get(node) || 0;
                const flow = this._wireFlowCache.map.get(wire.id);
                const wireCurrent = Math.abs(flow?.currentMagnitude || 0);

                if (expectedShortCurrent > 0) {
                    if (wireCurrent >= Math.max(1e-6, expectedShortCurrent * 0.2)) {
                        shortedWireIds.add(wire.id);
                    }
                    continue;
                }

                const aKey = pointKey(wire?.a);
                const bKey = pointKey(wire?.b);
                if ((aKey && directShortTerminalKeys.has(aKey))
                    || (bKey && directShortTerminalKeys.has(bKey))) {
                    shortedWireIds.add(wire.id);
                }
            }
        } else {
            // Fallback for invalid/missing solver result: only mark wires touching direct-short source terminals.
            for (const wire of this.wires.values()) {
                const aKey = pointKey(wire?.a);
                const bKey = pointKey(wire?.b);
                if ((aKey && directShortTerminalKeys.has(aKey))
                    || (bKey && directShortTerminalKeys.has(bKey))) {
                    shortedWireIds.add(wire.id);
                }
            }
        }

        this.shortedSourceIds = shortedSources;
        this.shortedPowerNodes = shortedNodes;
        this.shortedWireIds = shortedWireIds;
        this.shortCircuitCacheVersion = results || null;
    }

    /**
     * Whether a wire is on a node that contains a shorted power source.
     * This is a topology-only check; it does not depend on the solver result.
     * @param {Object} wire
     * @returns {boolean}
     */
    isWireInShortCircuit(wire, results = null) {
        if (!wire) return false;
        if (results && this.shortCircuitCacheVersion !== results) {
            this.refreshShortCircuitDiagnostics(results);
        }

        const wireObj = typeof wire === 'string' ? this.getWire(wire) : wire;
        const wireId = typeof wire === 'string' ? wire : wire?.id;
        if (!wireId) return false;
        if (this.shortedWireIds && this.shortedWireIds.has(wireId)) return true;

        // Topology-only fallback for cases where simulation has not produced runtime diagnostics yet.
        if (this.shortCircuitCacheVersion === null) {
            const node = Number.isFinite(wireObj?.nodeIndex) ? wireObj.nodeIndex : -1;
            if (node >= 0) {
                return !!(this.shortedPowerNodes && this.shortedPowerNodes.has(node));
            }
        }
        return false;
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
        const isShorted = this.isWireInShortCircuit(wire, results);

        this.ensureWireFlowCache(results);
        const cachedFlow = this._wireFlowCache.map.get(wire.id);
        const current = cachedFlow ? (cachedFlow.currentMagnitude || 0) : 0;
        const flowDirection = cachedFlow ? (cachedFlow.flowDirection || 0) : 0;

        return {
            current,
            voltage1: nodeVoltage,
            voltage2: nodeVoltage,
            isShorted,
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
        this.observationProbes.clear();
        this.nodes = [];
        this.lastResults = null;
        this.terminalConnectionMap = new Map();
        this._wireFlowCache = { version: null, map: new Map() };
        this.shortedPowerNodes = new Set();
        this.shortedSourceIds = new Set();
        this.shortedWireIds = new Set();
        this.shortCircuitCacheVersion = null;
        this.topologyBatchDepth = 0;
        this.topologyRebuildPending = false;
        this.topologyVersion = 0;
        this.solverPreparedTopologyVersion = -1;
        this.solverCircuitDirty = true;
        this.componentTerminalTopologyKeys = new Map();
        this.terminalWorldPosCache = new Map();
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
            })),
            probes: this.getAllObservationProbes()
                .filter((probe) => probe?.wireId && this.wires.has(probe.wireId))
                .map((probe) => ({
                    id: probe.id,
                    type: probe.type,
                    wireId: probe.wireId,
                    ...(probe.label ? { label: probe.label } : {})
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
            case 'Ground':
                return {
                    isReference: true
                };
            case 'PowerSource':
                return {
                    voltage: comp.voltage,
                    internalResistance: comp.internalResistance
                };
            case 'ACVoltageSource':
                return {
                    rmsVoltage: comp.rmsVoltage,
                    frequency: comp.frequency,
                    phase: comp.phase,
                    offset: comp.offset,
                    internalResistance: comp.internalResistance
                };
            case 'Resistor':
                return { resistance: comp.resistance };
            case 'Thermistor':
                return {
                    resistanceAt25: comp.resistanceAt25,
                    beta: comp.beta,
                    temperatureC: comp.temperatureC
                };
            case 'Diode':
                return {
                    forwardVoltage: comp.forwardVoltage,
                    onResistance: comp.onResistance,
                    offResistance: comp.offResistance
                };
            case 'LED':
                return {
                    forwardVoltage: comp.forwardVoltage,
                    onResistance: comp.onResistance,
                    offResistance: comp.offResistance,
                    ratedCurrent: comp.ratedCurrent,
                    color: comp.color
                };
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
                return {
                    capacitance: comp.capacitance,
                    integrationMethod: comp.integrationMethod || 'auto'
                };
            case 'Inductor':
                return {
                    inductance: comp.inductance,
                    initialCurrent: comp.initialCurrent,
                    integrationMethod: comp.integrationMethod || 'auto'
                };
            case 'ParallelPlateCapacitor':
                return {
                    plateArea: comp.plateArea,
                    plateDistance: comp.plateDistance,
                    dielectricConstant: comp.dielectricConstant,
                    plateOffsetYPx: comp.plateOffsetYPx,
                    explorationMode: comp.explorationMode,
                    capacitance: comp.capacitance,
                    integrationMethod: comp.integrationMethod || 'auto'
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
            case 'SPDTSwitch':
                return {
                    position: comp.position === 'b' ? 'b' : 'a',
                    onResistance: comp.onResistance,
                    offResistance: comp.offResistance
                };
            case 'Fuse':
                return {
                    ratedCurrent: comp.ratedCurrent,
                    i2tThreshold: comp.i2tThreshold,
                    i2tAccum: comp.i2tAccum,
                    coldResistance: comp.coldResistance,
                    blownResistance: comp.blownResistance,
                    blown: !!comp.blown
                };
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
        const componentList = Array.isArray(json?.components) ? json.components : [];
        const wireList = Array.isArray(json?.wires) ? json.wires : [];
        const probeList = Array.isArray(json?.probes) ? json.probes : [];
        
        // 导入元器件 - 使用 createComponent 确保完整初始化
        for (const compData of componentList) {
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

            // 兼容旧存档：历史文件未保存 integrationMethod 时保持后向欧拉行为。
            if ((comp.type === 'Capacitor' || comp.type === 'Inductor' || comp.type === 'ParallelPlateCapacitor')
                && !compData?.properties?.integrationMethod) {
                comp.integrationMethod = 'backward-euler';
            }

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

            if (comp.type === 'Inductor') {
                comp.prevCurrent = Number.isFinite(comp.initialCurrent) ? comp.initialCurrent : 0;
                comp.prevVoltage = 0;
                comp._dynamicHistoryReady = false;
            }
            if (comp.type === 'Capacitor' || comp.type === 'ParallelPlateCapacitor') {
                comp.prevCurrent = 0;
                comp.prevVoltage = 0;
                comp._dynamicHistoryReady = false;
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

        for (const wireData of wireList) {
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

        for (const probeData of probeList) {
            const normalized = this.normalizeObservationProbe(probeData);
            if (!normalized) continue;
            if (!this.wires.has(normalized.wireId)) continue;
            const probeId = this.ensureUniqueObservationProbeId(normalized.id);
            this.observationProbes.set(probeId, { ...normalized, id: probeId });
        }

        this.rebuildNodes();
    }
}
