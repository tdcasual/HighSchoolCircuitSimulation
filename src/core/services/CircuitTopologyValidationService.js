import { resolveCircuitSourceVoltageAtTime } from './CircuitSourceVoltageResolver.js';

const IDEAL_SOURCE_RESISTANCE_EPS = 1e-9;

export class CircuitTopologyValidationService {
    getSourceInstantVoltageAtTime(circuit, comp, simTime = circuit?.simTime) {
        return resolveCircuitSourceVoltageAtTime(comp, simTime);
    }

    isIdealVoltageSource(comp) {
        if (!comp || (comp.type !== 'PowerSource' && comp.type !== 'ACVoltageSource')) return false;
        const internalResistance = Number(comp.internalResistance);
        return !Number.isFinite(internalResistance) || internalResistance < IDEAL_SOURCE_RESISTANCE_EPS;
    }

    componentProvidesResistiveDamping(comp) {
        if (!comp) return false;
        switch (comp.type) {
            case 'Resistor':
            case 'Bulb':
            case 'Thermistor':
            case 'Photoresistor':
            case 'Diode':
            case 'LED':
            case 'Motor':
                return true;
            case 'Rheostat':
                return comp.connectionMode !== 'none' && comp.connectionMode !== 'slider-only';
            case 'Switch':
                return !!comp.closed;
            case 'SPDTSwitch':
                return true;
            case 'Fuse':
                return !comp.blown;
            case 'Ammeter': {
                const resistance = Number(comp.resistance);
                return Number.isFinite(resistance) && resistance > 0 && resistance < 1e11;
            }
            case 'Voltmeter': {
                const resistance = Number(comp.resistance);
                return Number.isFinite(resistance) && resistance > 0 && resistance < 1e11;
            }
            case 'PowerSource':
            case 'ACVoltageSource': {
                const internalResistance = Number(comp.internalResistance);
                return Number.isFinite(internalResistance)
                    && internalResistance >= IDEAL_SOURCE_RESISTANCE_EPS
                    && internalResistance < 1e11;
            }
            case 'Relay': {
                const onResistance = Number(comp.contactOnResistance);
                const offResistance = Number(comp.contactOffResistance);
                const resistance = comp.energized ? onResistance : offResistance;
                return Number.isFinite(resistance) && resistance > 0 && resistance < 1e11;
            }
            default:
                return false;
        }
    }

    detectConflictingIdealSources(circuit, simTime = circuit?.simTime) {
        const pairToSource = new Map();
        const voltageTolerance = 1e-6;
        const isValidNode = (nodeIdx) => Number.isInteger(nodeIdx) && nodeIdx >= 0;

        for (const comp of circuit?.components?.values?.() || []) {
            if (!this.isIdealVoltageSource(comp)) continue;
            const nPos = comp.nodes?.[0];
            const nNeg = comp.nodes?.[1];
            if (!isValidNode(nPos) || !isValidNode(nNeg) || nPos === nNeg) continue;

            const a = Math.min(nPos, nNeg);
            const b = Math.max(nPos, nNeg);
            const sourceVoltage = this.getSourceInstantVoltageAtTime(circuit, comp, simTime);
            const canonicalVoltage = nPos === a ? sourceVoltage : -sourceVoltage;
            const pairKey = `${a}|${b}`;
            const existing = pairToSource.get(pairKey);
            if (!existing) {
                pairToSource.set(pairKey, {
                    id: comp.id,
                    voltage: canonicalVoltage,
                    nodes: [a, b]
                });
                continue;
            }

            if (Math.abs(existing.voltage - canonicalVoltage) > voltageTolerance) {
                return {
                    code: 'TOPO_CONFLICTING_IDEAL_SOURCES',
                    message: `检测到并联理想电压源冲突：${existing.id} 与 ${comp.id} 对同一节点对施加了不同电压。`,
                    details: {
                        sourceIds: [existing.id, comp.id],
                        nodePair: existing.nodes,
                        voltages: [existing.voltage, canonicalVoltage]
                    }
                };
            }
        }

        return null;
    }

    detectCapacitorLoopWithoutResistance(circuit) {
        const pairInfo = new Map();
        const isValidNode = (nodeIdx) => Number.isInteger(nodeIdx) && nodeIdx >= 0;
        const isCapacitor = (comp) => comp?.type === 'Capacitor' || comp?.type === 'ParallelPlateCapacitor';

        for (const comp of circuit?.components?.values?.() || []) {
            if (!comp || !Array.isArray(comp.nodes) || comp.nodes.length < 2) continue;
            const n1 = comp.nodes[0];
            const n2 = comp.nodes[1];
            if (!isValidNode(n1) || !isValidNode(n2) || n1 === n2) continue;
            const a = Math.min(n1, n2);
            const b = Math.max(n1, n2);
            const pairKey = `${a}|${b}`;

            let info = pairInfo.get(pairKey);
            if (!info) {
                info = {
                    nodePair: [a, b],
                    capacitorIds: [],
                    hasDamping: false
                };
                pairInfo.set(pairKey, info);
            }

            if (isCapacitor(comp)) {
                info.capacitorIds.push(comp.id);
            } else if (this.componentProvidesResistiveDamping(comp)) {
                info.hasDamping = true;
            }
        }

        for (const info of pairInfo.values()) {
            if (info.capacitorIds.length >= 2 && !info.hasDamping) {
                return {
                    code: 'TOPO_CAPACITOR_LOOP_NO_RESISTANCE',
                    message: `检测到纯电容并联回路（${info.capacitorIds.join(', ')}），缺少阻尼电阻，仿真可能不稳定。`,
                    details: {
                        capacitorIds: info.capacitorIds,
                        nodePair: info.nodePair
                    }
                };
            }
        }

        return null;
    }

    detectFloatingSubcircuitWarnings(circuit) {
        const isValidNode = (nodeIdx) => Number.isInteger(nodeIdx) && nodeIdx >= 0;
        const nodeToComponents = new Map();
        const componentNodeMap = new Map();

        for (const comp of circuit?.components?.values?.() || []) {
            if (!comp || !comp.id || comp.type === 'Ground') continue;
            const validNodes = Array.isArray(comp.nodes)
                ? comp.nodes.filter(isValidNode)
                : [];
            if (validNodes.length === 0) continue;
            componentNodeMap.set(comp.id, {
                comp,
                nodes: new Set(validNodes)
            });
            for (const node of validNodes) {
                if (!nodeToComponents.has(node)) nodeToComponents.set(node, new Set());
                nodeToComponents.get(node).add(comp.id);
            }
        }

        const visited = new Set();
        const groups = [];
        for (const compId of componentNodeMap.keys()) {
            if (visited.has(compId)) continue;
            const queue = [compId];
            visited.add(compId);
            const componentIds = [];
            const nodes = new Set();

            while (queue.length > 0) {
                const currentId = queue.shift();
                componentIds.push(currentId);
                const info = componentNodeMap.get(currentId);
                if (!info) continue;
                for (const node of info.nodes) {
                    nodes.add(node);
                    const neighbors = nodeToComponents.get(node);
                    if (!neighbors) continue;
                    for (const neighborId of neighbors) {
                        if (visited.has(neighborId)) continue;
                        visited.add(neighborId);
                        queue.push(neighborId);
                    }
                }
            }

            groups.push({ componentIds, nodes });
        }

        if (groups.length <= 1) return [];

        const floatingGroups = groups.filter((group) =>
            group.componentIds.length >= 2 && !group.nodes.has(0)
        );
        if (floatingGroups.length === 0) return [];

        return [{
            code: 'TOPO_FLOATING_SUBCIRCUIT',
            message: `检测到 ${floatingGroups.length} 个悬浮子电路（未连接参考地节点），仿真可继续但读数可能依赖参考选择。`,
            details: {
                groups: floatingGroups.map((group) => ({
                    componentIds: group.componentIds
                }))
            }
        }];
    }

    validateSimulationTopology(circuit, simTime = circuit?.simTime) {
        circuit?.ensureTopologyReadyForValidation?.();

        const warnings = [];
        const idealSourceError = this.detectConflictingIdealSources(circuit, simTime);
        if (idealSourceError) {
            return { ok: false, error: idealSourceError, warnings };
        }

        const capacitorLoopError = this.detectCapacitorLoopWithoutResistance(circuit);
        if (capacitorLoopError) {
            return { ok: false, error: capacitorLoopError, warnings };
        }

        warnings.push(...this.detectFloatingSubcircuitWarnings(circuit));
        return {
            ok: true,
            error: null,
            warnings
        };
    }
}
