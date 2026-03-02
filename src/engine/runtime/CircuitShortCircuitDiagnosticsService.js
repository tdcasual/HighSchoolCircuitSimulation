import { pointKey } from '../../utils/CanvasCoords.js';

export function refreshShortCircuitDiagnostics(circuit, results = null) {
    if (!circuit) return;
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

    for (const comp of circuit.components.values()) {
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
                const sourceVoltage = circuit.solver.getSourceInstantVoltage(comp);
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
            const p0 = circuit.getTerminalWorldPositionCached(comp.id, 0, comp);
            const p1 = circuit.getTerminalWorldPositionCached(comp.id, 1, comp);
            const key0 = pointKey(p0);
            const key1 = pointKey(p1);
            if (key0) directShortTerminalKeys.add(key0);
            if (key1) directShortTerminalKeys.add(key1);
        }
    }

    if (hasValidResults) {
        circuit.ensureWireFlowCache(results);
        for (const wire of circuit.wires.values()) {
            const node = Number.isFinite(wire?.nodeIndex) ? wire.nodeIndex : -1;
            if (node < 0 || !shortedNodes.has(node)) continue;
            const expectedShortCurrent = nodeShortCurrent.get(node) || 0;
            const flow = circuit._wireFlowCache.map.get(wire.id);
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
        for (const wire of circuit.wires.values()) {
            const aKey = pointKey(wire?.a);
            const bKey = pointKey(wire?.b);
            if ((aKey && directShortTerminalKeys.has(aKey))
                || (bKey && directShortTerminalKeys.has(bKey))) {
                shortedWireIds.add(wire.id);
            }
        }
    }

    circuit.shortedSourceIds = shortedSources;
    circuit.shortedPowerNodes = shortedNodes;
    circuit.shortedWireIds = shortedWireIds;
    circuit.shortCircuitCacheVersion = results || null;
}

export function isWireInShortCircuit(circuit, wire, results = null) {
    if (!circuit || !wire) return false;
    if (results && circuit.shortCircuitCacheVersion !== results) {
        refreshShortCircuitDiagnostics(circuit, results);
    }

    const wireObj = typeof wire === 'string' ? circuit.getWire(wire) : wire;
    const wireId = typeof wire === 'string' ? wire : wire?.id;
    if (!wireId) return false;
    if (circuit.shortedWireIds && circuit.shortedWireIds.has(wireId)) return true;

    // Topology-only fallback for cases where simulation has not produced runtime diagnostics yet.
    if (circuit.shortCircuitCacheVersion === null) {
        const node = Number.isFinite(wireObj?.nodeIndex) ? wireObj.nodeIndex : -1;
        if (node >= 0) {
            return !!(circuit.shortedPowerNodes && circuit.shortedPowerNodes.has(node));
        }
    }
    return false;
}

export function getWireCurrentInfo(circuit, wire, results) {
    if (!circuit || !wire || !results || !results.valid) return null;

    const nodeId = Number.isFinite(wire.nodeIndex) ? wire.nodeIndex : -1;
    const nodeVoltage = nodeId >= 0 ? (results.voltages[nodeId] || 0) : 0;
    const shorted = isWireInShortCircuit(circuit, wire, results);

    circuit.ensureWireFlowCache(results);
    const cachedFlow = circuit._wireFlowCache.map.get(wire.id);
    const current = cachedFlow ? (cachedFlow.currentMagnitude || 0) : 0;
    const flowDirection = cachedFlow ? (cachedFlow.flowDirection || 0) : 0;

    return {
        current,
        voltage1: nodeVoltage,
        voltage2: nodeVoltage,
        isShorted: shorted,
        flowDirection,
        voltageDiff: 0
    };
}
