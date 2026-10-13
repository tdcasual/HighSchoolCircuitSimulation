import { resolveCircuitSourceVoltageAtTime } from './CircuitSourceVoltageResolver.js';
import { resolveComponentViewRecord } from '../../utils/componentViewRecord.js';
import { computeNtcThermistorResistance, computePhotoresistorResistance } from '../../utils/Physics.js';

const IDEAL_SOURCE_RESISTANCE_EPS = 1e-9;
const DAMPING_RESISTANCE_MAX = 1e11;

function resistanceProvidesDamping(resistance) {
    return Number.isFinite(resistance) && resistance > 0 && resistance < DAMPING_RESISTANCE_MAX;
}

function fuseIsBlown(comp, view, circuit) {
    return circuit?.isRunning
        ? !!view?.blown
        : !!(comp.blown || circuit?.solverBackend?.getState?.(comp)?.blown);
}

function fuseStampResistance(comp, view, circuit) {
    if (fuseIsBlown(comp, view, circuit)) {
        return Math.max(1, Number(view?.blownResistance) || 1e12);
    }
    return Math.max(1e-9, Number(view?.coldResistance) || 0.05);
}

export class CircuitTopologyValidationService {
    getSourceInstantVoltageAtTime(circuit, comp, simTime = circuit?.simTime) {
        return resolveCircuitSourceVoltageAtTime(comp, simTime);
    }

    isIdealVoltageSource(comp) {
        if (!comp) return false;
        if (comp.type === 'Ammeter') {
            const resistance = Number(comp.resistance);
            return !(Number.isFinite(resistance) && resistance > 0);
        }
        if (comp.type !== 'PowerSource' && comp.type !== 'ACVoltageSource') return false;
        const internalResistance = Number(comp.internalResistance);
        return !Number.isFinite(internalResistance) || internalResistance < IDEAL_SOURCE_RESISTANCE_EPS;
    }

    componentProvidesResistiveDamping(comp, viewMap, circuit) {
        const view = resolveComponentViewRecord(comp, viewMap);
        if (!view) return false;
        switch (view.type) {
            case 'Resistor':
            case 'Bulb':
                return resistanceProvidesDamping(Number(view.resistance));
            case 'Thermistor':
                return resistanceProvidesDamping(computeNtcThermistorResistance(view));
            case 'Photoresistor':
                return resistanceProvidesDamping(computePhotoresistorResistance(view));
            case 'Diode':
            case 'LED':
            case 'Motor':
            case 'Inductor':
                return true;
            case 'Rheostat':
                return view.connectionMode !== 'none' && view.connectionMode !== 'slider-only';
            case 'Switch':
                return !!view.closed;
            case 'SPDTSwitch':
                return true;
            case 'Fuse':
                return resistanceProvidesDamping(fuseStampResistance(comp, view, circuit));
            case 'Ammeter': {
                const resistance = Number(view.resistance);
                if (!Number.isFinite(resistance) || resistance <= 0) return true;
                return resistanceProvidesDamping(resistance);
            }
            case 'Voltmeter':
                return resistanceProvidesDamping(Number(view.resistance));
            case 'PowerSource':
            case 'ACVoltageSource': {
                const internalResistance = Number(view.internalResistance);
                return internalResistance >= IDEAL_SOURCE_RESISTANCE_EPS
                    && resistanceProvidesDamping(internalResistance);
            }
            case 'Relay':
                return resistanceProvidesDamping(Number(view.coilResistance));
            default:
                return false;
        }
    }

    detectConflictingIdealSources(circuit, simTime = circuit?.simTime) {
        const isValidNode = (nodeIdx) => Number.isInteger(nodeIdx) && nodeIdx >= 0;
        const parent = new Map();
        const find = (node) => {
            if (!parent.has(node)) parent.set(node, node);
            let cursor = node;
            while (parent.get(cursor) !== cursor) cursor = parent.get(cursor);
            return cursor;
        };
        const edges = [];

        for (const comp of circuit?.components?.values?.() || []) {
            if (!this.isIdealVoltageSource(comp)) continue;
            const nPos = comp.nodes?.[0];
            const nNeg = comp.nodes?.[1];
            if (!isValidNode(nPos) || !isValidNode(nNeg) || nPos === nNeg) continue;

            const sourceVoltage = this.getSourceInstantVoltageAtTime(circuit, comp, simTime);
            const rootPos = find(nPos);
            const rootNeg = find(nNeg);
            if (rootPos === rootNeg) {
                const involved = edges.filter((edge) => find(edge.nPos) === rootPos);
                const sourceIds = [...involved.map((edge) => edge.id), comp.id];
                const voltages = [...involved.map((edge) => edge.voltage), sourceVoltage];
                return {
                    code: 'TOPO_CONFLICTING_IDEAL_SOURCES',
                    message: `检测到理想电压源冲突：${sourceIds.join('、')} 构成了仅含理想电压源（含理想电流表）的回路，仿真无法求解。`,
                    details: {
                        sourceIds,
                        nodePair: [Math.min(nPos, nNeg), Math.max(nPos, nNeg)],
                        voltages
                    }
                };
            }

            parent.set(rootPos, rootNeg);
            edges.push({ id: comp.id, nPos, nNeg, voltage: sourceVoltage });
        }

        return null;
    }

    detectCapacitorLoopWithoutResistance(circuit) {
        const pairInfo = new Map();
        const isValidNode = (nodeIdx) => Number.isInteger(nodeIdx) && nodeIdx >= 0;
        const isCapacitor = (comp) => comp?.type === 'Capacitor' || comp?.type === 'ParallelPlateCapacitor';
        const viewMap = circuit?.lastResults?.viewMap;
        const makeFinder = () => {
            const parent = new Map();
            const find = (node) => {
                if (!parent.has(node)) parent.set(node, node);
                let cursor = node;
                while (parent.get(cursor) !== cursor) cursor = parent.get(cursor);
                parent.set(node, cursor);
                return cursor;
            };
            const union = (n1, n2) => {
                const root1 = find(n1);
                const root2 = find(n2);
                if (root1 !== root2) parent.set(root1, root2);
            };
            return { find, union };
        };
        const resistive = makeFinder();
        const ideal = makeFinder();

        const markPair = (n1, n2, kind, comp) => {
            if (!isValidNode(n1) || !isValidNode(n2) || n1 === n2) return;
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
            if (kind === 'capacitor') {
                info.capacitorIds.push(comp.id);
            } else {
                info.hasDamping = true;
                resistive.union(n1, n2);
            }
        };

        for (const comp of circuit?.components?.values?.() || []) {
            if (!comp || !Array.isArray(comp.nodes) || comp.nodes.length < 2) continue;
            if (isCapacitor(comp)) {
                markPair(comp.nodes[0], comp.nodes[1], 'capacitor', comp);
                continue;
            }
            if (comp.type === 'Fuse') {
                const view = resolveComponentViewRecord(comp, viewMap);
                if (resistanceProvidesDamping(fuseStampResistance(comp, view, circuit))) {
                    markPair(comp.nodes[0], comp.nodes[1], 'damping', comp);
                }
                continue;
            }
            if (comp.type === 'Relay') {
                const view = resolveComponentViewRecord(comp, viewMap);
                if (resistanceProvidesDamping(Number(view?.coilResistance))) {
                    markPair(comp.nodes[0], comp.nodes[1], 'damping', comp);
                }
                const contactEnergized = !!circuit?.isRunning && !!view?.energized;
                const contactResistance = contactEnergized
                    ? Number(view.contactOnResistance)
                    : Number(view.contactOffResistance);
                if (resistanceProvidesDamping(contactResistance)) {
                    markPair(comp.nodes[2], comp.nodes[3], 'damping', comp);
                }
                continue;
            }
            if (comp.type === 'SPDTSwitch') {
                const view = resolveComponentViewRecord(comp, viewMap);
                const onR = Math.max(1e-9, Number(view?.onResistance) || 1e-9);
                const offR = Math.max(onR, Number(view?.offResistance) || 1e12);
                const routeToB = view?.position === 'b';
                const aR = routeToB ? offR : onR;
                const bR = routeToB ? onR : offR;
                if (resistanceProvidesDamping(aR)) {
                    markPair(comp.nodes[0], comp.nodes[1], 'damping', comp);
                }
                if (resistanceProvidesDamping(bR)) {
                    markPair(comp.nodes[0], comp.nodes[2], 'damping', comp);
                }
                continue;
            }
            if (comp.type === 'Rheostat') {
                const view = resolveComponentViewRecord(comp, viewMap);
                const minRaw = Number(view?.minResistance);
                const maxRaw = Number(view?.maxResistance);
                const minR = Number.isFinite(minRaw) ? minRaw : 0;
                const maxR = Number.isFinite(maxRaw) ? maxRaw : 100;
                const positionRaw = Number(view?.position);
                const position = Number.isFinite(positionRaw) ? Math.min(Math.max(positionRaw, 0), 1) : 0.5;
                const range = Math.max(0, maxR - minR);
                const r1 = Math.max(1e-9, minR + range * position);
                const r2 = Math.max(1e-9, maxR - range * position);
                switch (view?.connectionMode) {
                    case 'left-slider':
                        if (resistanceProvidesDamping(r1)) {
                            markPair(comp.nodes[0], comp.nodes[2], 'damping', comp);
                        }
                        break;
                    case 'right-slider':
                        if (resistanceProvidesDamping(r2)) {
                            markPair(comp.nodes[1], comp.nodes[2], 'damping', comp);
                        }
                        break;
                    case 'left-right':
                        if (resistanceProvidesDamping(Math.max(1e-9, maxR))) {
                            markPair(comp.nodes[0], comp.nodes[1], 'damping', comp);
                        }
                        break;
                    case 'all':
                        if (resistanceProvidesDamping(r1)) {
                            markPair(comp.nodes[0], comp.nodes[2], 'damping', comp);
                        }
                        if (resistanceProvidesDamping(r2)) {
                            markPair(comp.nodes[1], comp.nodes[2], 'damping', comp);
                        }
                        if (resistanceProvidesDamping(r1 + r2)) {
                            markPair(comp.nodes[0], comp.nodes[1], 'damping', comp);
                        }
                        break;
                    default:
                        break;
                }
                continue;
            }
            if (this.componentProvidesResistiveDamping(comp, viewMap, circuit)) {
                markPair(comp.nodes[0], comp.nodes[1], 'damping', comp);
            }
        }

        for (const comp of circuit?.components?.values?.() || []) {
            if (!this.isIdealVoltageSource(comp)) continue;
            const n1 = comp.nodes?.[0];
            const n2 = comp.nodes?.[1];
            if (!isValidNode(n1) || !isValidNode(n2) || n1 === n2) continue;
            ideal.union(n1, n2);
            resistive.union(n1, n2);
        }

        const capacitorLoopError = (info) => ({
            code: 'TOPO_CAPACITOR_LOOP_NO_RESISTANCE',
            message: `检测到纯电容并联回路（${info.capacitorIds.join(', ')}），缺少阻尼电阻，仿真可能不稳定。`,
            details: {
                capacitorIds: info.capacitorIds,
                nodePair: info.nodePair
            }
        });
        for (const info of pairInfo.values()) {
            if (info.capacitorIds.length < 2 || info.hasDamping) continue;
            const [a, b] = info.nodePair;
            // Across an ideal source with no on-pair R: still a pure C loop.
            if (ideal.find(a) === ideal.find(b)) return capacitorLoopError(info);
            // Series R plus an ideal source still damps this parallel C.
            if (resistive.find(a) === resistive.find(b)) continue;
            return capacitorLoopError(info);
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
