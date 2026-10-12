import { getTerminalWorldPosition } from '../../utils/TerminalGeometry.js';
import { normalizeCanvasPoint, toCanvasInt } from '../../utils/CanvasCoords.js';
import { setTopologyReplacementState } from '../topology/TopologyState.js';

function wireReferencesComponent(wire, componentId) {
    const target = String(componentId);
    return String(wire?.aRef?.componentId) === target
        || String(wire?.bRef?.componentId) === target;
}

export class CircuitTopologyService {
    rebuild(context) {
        if (!context) return null;

        // Keep any terminal-bound wire endpoints synced to the current terminal geometry
        // before we rebuild the coordinate-based connectivity graph.
        context.syncWireEndpointsToTerminalRefs();

        // Invalidate stale terminal geometry cache entries for removed components.
        for (const cachedId of Array.from(context.componentTerminalTopologyKeys.keys())) {
            if (!context.components.has(cachedId)) {
                context.componentTerminalTopologyKeys.delete(cachedId);
                context.terminalWorldPosCache.delete(cachedId);
            }
        }

        // Refresh per-component terminal geometry cache keys.
        for (const [id, comp] of context.components) {
            const nextKey = context.buildComponentTerminalTopologyKey(comp);
            const prevKey = context.componentTerminalTopologyKeys.get(id);
            if (prevKey !== nextKey) {
                context.componentTerminalTopologyKeys.set(id, nextKey);
                context.terminalWorldPosCache.delete(id);
            }
        }

        const topology = context.nodeBuilder.build({
            components: context.components,
            wires: context.wires,
            getTerminalWorldPosition: (componentId, terminalIndex, comp) =>
                context.getTerminalWorldPositionCached(componentId, terminalIndex, comp)
        });
        context.terminalConnectionMap = topology.terminalConnectionMap;
        context.nodes = topology.nodes;

        if (context.debugMode) {
            context.logger?.debug?.('--- Node mapping ---');
            const nodeTerminals = Array.from({ length: context.nodes.length }, () => []);
            for (const [id, comp] of context.components) {
                const append = (node, terminalIdx) => {
                    if (node !== undefined && node >= 0) {
                        nodeTerminals[node].push(`${id}:${terminalIdx}`);
                    }
                };
                (comp.nodes || []).forEach((node, terminalIdx) => append(node, terminalIdx));
            }
            nodeTerminals.forEach((terminals, idx) => {
                context.logger?.debug?.(`node ${idx}: ${terminals.join(', ')}`);
            });
        }

        // Topology changed: clear flow cache.
        context._wireFlowCache = { version: null, map: new Map() };

        // Detect rheostat connection modes (based on terminal degrees).
        context.detectRheostatConnections();

        // Track nodes that contain a shorted power source (both terminals on the same electrical node).
        const shorted = new Set();
        const shortedSources = new Set();
        for (const comp of context.components.values()) {
            if (comp.type !== 'PowerSource' && comp.type !== 'ACVoltageSource') continue;
            const n0 = comp.nodes?.[0];
            const n1 = comp.nodes?.[1];
            if (n0 !== undefined && n0 >= 0 && n0 === n1) {
                shorted.add(n0);
                shortedSources.add(comp.id);
            }
        }
        context.shortedPowerNodes = shorted;
        context.shortedSourceIds = shortedSources;
        context.shortedWireIds = new Set();
        context.shortCircuitCacheVersion = null;
        context.topologyVersion += 1;
        context.refreshComponentConnectivityCache();
        context.markSolverCircuitDirty();
        return topology;
    }

    beginBatch(context) {
        context.topologyBatchDepth += 1;
        return context.topologyBatchDepth;
    }

    endBatch(context, options = {}) {
        const force = !!options.force;
        if (context.topologyBatchDepth > 0) {
            context.topologyBatchDepth -= 1;
        }
        if (context.topologyBatchDepth > 0) return false;

        const shouldRebuild = context.topologyRebuildPending || force;
        context.topologyRebuildPending = false;
        if (!shouldRebuild) return false;

        context.rebuildNodes();
        return true;
    }

    requestRebuild(context) {
        if (context.topologyBatchDepth > 0) {
            context.topologyRebuildPending = true;
            return false;
        }
        context.rebuildNodes();
        return true;
    }

    markSolverDirty(context) {
        context.solverCircuitDirty = true;
        context.solverPreparedTopologyVersion = -1;
    }

    invalidateComponentTerminalCache(context, componentId) {
        if (componentId === undefined || componentId === null || String(componentId).trim() === '') return;
        const normalizedId = String(componentId);
        context.componentTerminalTopologyKeys.delete(normalizedId);
        context.terminalWorldPosCache.delete(normalizedId);
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

    getTerminalWorldPositionCached(context, componentId, terminalIndex, comp) {
        if (!componentId || !comp) return null;
        let byTerminal = context.terminalWorldPosCache.get(componentId);
        if (!byTerminal) {
            byTerminal = new Map();
            context.terminalWorldPosCache.set(componentId, byTerminal);
        }

        let pos = byTerminal.get(terminalIndex);
        if (!pos) {
            pos = normalizeCanvasPoint(getTerminalWorldPosition(comp, terminalIndex));
            if (!pos) return null;
            byTerminal.set(terminalIndex, pos);
        }
        return pos;
    }

    addComponent(context, component) {
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
        context.components.set(component.id, component);
        context.requestTopologyRebuild();
    }

    removeComponent(context, id) {
        if (id === undefined || id === null || String(id).trim() === '') return;
        const normalizedId = String(id);
        context.components.delete(normalizedId);
        context.invalidateComponentTerminalCache(normalizedId);
        const dangling = [];
        for (const [wireId, wire] of context.wires) {
            if (wireReferencesComponent(wire, normalizedId)) {
                dangling.push(wireId);
            }
        }
        for (const wireId of dangling) {
            context.removeWire(wireId);
        }
        context.requestTopologyRebuild();
    }

    addWire(context, wire) {
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
        context.wires.set(wire.id, wire);
        context.requestTopologyRebuild();
    }

    removeWire(context, id) {
        if (id === undefined || id === null || String(id).trim() === '') return;
        const normalizedId = String(id);
        context.wires.delete(normalizedId);
        context.removeObservationProbesByWireId(normalizedId);
        context.requestTopologyRebuild();
    }

    getWire(context, id) {
        if (id === undefined || id === null || String(id).trim() === '') return undefined;
        return context.wires.get(String(id));
    }

    getComponent(context, id) {
        if (id === undefined || id === null || String(id).trim() === '') return undefined;
        return context.components.get(String(id));
    }

    getAllComponents(context) {
        return Array.from(context.components.values());
    }

    getAllWires(context) {
        return Array.from(context.wires.values());
    }

    compactWires(context, options = {}) {
        const autoPublishBatch = context.topologyBatchDepth === 0;
        let result = { changed: false, removedIds: [], replacementByRemovedId: {} };

        if (autoPublishBatch) {
            context.beginTopologyBatch();
        }

        try {
            const { changed, removedIds, replacementByRemovedId } = context.wireCompactor.compact({
                components: context.components,
                wires: context.wires,
                scopeWireIds: options.scopeWireIds || null,
                syncWireEndpointsToTerminalRefs: () => context.syncWireEndpointsToTerminalRefs()
            });

            setTopologyReplacementState(context, replacementByRemovedId);

            if (changed) {
                for (const removedId of removedIds) {
                    if (!replacementByRemovedId[removedId]) {
                        context.removeObservationProbesByWireId(removedId);
                    }
                }
                context.remapObservationProbeWireIds(replacementByRemovedId);
                context.connectivityCache.invalidateComponentConnectivityCache(context.components);
                context.requestTopologyRebuild();
            }

            result = { changed, removedIds, replacementByRemovedId };
            return result;
        } finally {
            if (autoPublishBatch) {
                context.endTopologyBatch();
            }
        }
    }

    syncWireEndpointsToTerminalRefs(context) {
        for (const wire of context.wires.values()) {
            if (!wire) continue;
            const applyRef = (endKey) => {
                const refKey = endKey === 'a' ? 'aRef' : 'bRef';
                const ref = wire[refKey];
                const componentId = ref?.componentId;
                const terminalIndex = ref?.terminalIndex;
                if (componentId === undefined || componentId === null) return;
                if (!Number.isInteger(terminalIndex) || terminalIndex < 0) return;
                const comp = context.components.get(componentId) || context.components.get(String(componentId));
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

    detectRheostatConnections(context) {
        for (const [id, comp] of context.components) {
            if (comp.type !== 'Rheostat') continue;

            const terminalConnected = [false, false, false];
            for (let ti = 0; ti < 3; ti++) {
                const key = `${id}:${ti}`;
                terminalConnected[ti] = (context.terminalConnectionMap.get(key) || 0) > 0;
            }

            if (context.debugMode) {
                context.logger?.debug?.(`Rheostat ${id}: terminals connected = [left:${terminalConnected[0]}, right:${terminalConnected[1]}, slider:${terminalConnected[2]}]`);
            }

            const leftConnected = terminalConnected[0];
            const rightConnected = terminalConnected[1];
            const sliderConnected = terminalConnected[2];

            if (sliderConnected) {
                if (leftConnected && rightConnected) {
                    comp.connectionMode = 'all';
                } else if (leftConnected) {
                    comp.connectionMode = 'left-slider';
                } else if (rightConnected) {
                    comp.connectionMode = 'right-slider';
                } else {
                    comp.connectionMode = 'slider-only';
                }
            } else {
                if (leftConnected && rightConnected) {
                    comp.connectionMode = 'left-right';
                } else {
                    comp.connectionMode = 'none';
                }
            }

            if (context.debugMode) {
                context.logger?.debug?.(`Rheostat ${id}: connectionMode = ${comp.connectionMode}`);
            }

            this.calculateRheostatActiveResistance(comp);
        }
    }

    calculateRheostatActiveResistance(comp) {
        const totalR = comp.maxResistance - comp.minResistance;
        const R_left_to_slider = comp.minResistance + totalR * comp.position;
        const R_slider_to_right = comp.maxResistance - totalR * comp.position;

        switch (comp.connectionMode) {
            case 'left-slider':
                comp.activeResistance = R_left_to_slider;
                comp.resistanceDirection = 'slider-right-increase';
                break;
            case 'right-slider':
                comp.activeResistance = R_slider_to_right;
                comp.resistanceDirection = 'slider-right-decrease';
                break;
            case 'left-right':
                comp.activeResistance = comp.maxResistance;
                comp.resistanceDirection = 'fixed';
                break;
            case 'all':
                comp.activeResistance = R_left_to_slider;
                comp.resistanceDirection = 'slider-right-increase';
                comp.rightResistance = R_slider_to_right;
                break;
            default:
                comp.activeResistance = 0;
                comp.resistanceDirection = 'disconnected';
        }
    }

    computeComponentConnectedState(context, componentId, comp) {
        return context.connectivityCache.computeComponentConnectedState(
            componentId,
            comp,
            context.terminalConnectionMap
        );
    }

    refreshComponentConnectivityCache(context) {
        return context.connectivityCache.refreshComponentConnectivityCache(
            context.components,
            context.topologyVersion,
            context.terminalConnectionMap,
            (id, comp) => context.computeComponentConnectedState(id, comp)
        );
    }

    isComponentConnected(context, componentId) {
        if (
            componentId === undefined
            || componentId === null
            || String(componentId).trim() === ''
        ) {
            return false;
        }
        const normalizedId = String(componentId);
        return context.connectivityCache.isComponentConnected(
            normalizedId,
            context.components,
            context.topologyVersion,
            context.terminalConnectionMap,
            (id, comp) => context.computeComponentConnectedState(id, comp)
        );
    }

    ensureReadyForValidation(context) {
        if (context.topologyBatchDepth === 0 && (context.topologyRebuildPending || context.solverCircuitDirty)) {
            context.rebuildNodes();
        }
    }
}
