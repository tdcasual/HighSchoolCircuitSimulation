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
}
