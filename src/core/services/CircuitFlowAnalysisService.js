import { Matrix } from '../simulation/Matrix.js';
import { getTerminalWorldPosition } from '../../utils/TerminalGeometry.js';
import { pointKey } from '../../utils/CanvasCoords.js';

export class CircuitFlowAnalysisService {
    getTerminalCurrentFlow(circuit, comp, terminalIndex, results) {
        if (!comp || !results || terminalIndex == null) return 0;
        if (!comp.nodes || terminalIndex >= comp.nodes.length) return 0;
        const nodeIndex = comp.nodes[terminalIndex];
        if (nodeIndex === undefined || nodeIndex < 0) return 0;

        const compCurrent = results.currents.get(comp.id) || 0;
        const eps = 1e-9;

        if (comp.type === 'Rheostat') {
            const flows = this.getRheostatTerminalFlows(comp, results.voltages);
            return flows[terminalIndex] || 0;
        }
        if (comp.type === 'SPDTSwitch') {
            const flows = this.getSpdtTerminalFlows(comp, results.voltages);
            return flows[terminalIndex] || 0;
        }
        if (comp.type === 'Relay') {
            const flows = this.getRelayTerminalFlows(comp, results.voltages);
            return flows[terminalIndex] || 0;
        }

        if (this.isIdealVoltmeter(comp)) {
            return 0;
        }

        const isActiveSource = (
            comp.type === 'PowerSource'
            || comp.type === 'ACVoltageSource'
            || comp.type === 'Motor'
            || (comp.type === 'Ammeter' && (!comp.resistance || comp.resistance <= 0))
        );

        if (Math.abs(compCurrent) < eps) {
            return 0;
        }

        if (isActiveSource) {
            return terminalIndex === 0 ? compCurrent : -compCurrent;
        }

        return terminalIndex === 0 ? -compCurrent : compCurrent;
    }

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
                break;
        }

        return flows;
    }

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

    getRelayTerminalFlows(comp, voltages) {
        const flows = [0, 0, 0, 0];
        const getVoltage = (nodeIdx) => {
            if (nodeIdx === undefined || nodeIdx < 0) return 0;
            return voltages[nodeIdx] || 0;
        };

        const n0 = comp.nodes?.[0];
        const n1 = comp.nodes?.[1];
        const n2 = comp.nodes?.[2];
        const n3 = comp.nodes?.[3];

        if (n0 != null && n0 >= 0 && n1 != null && n1 >= 0) {
            const coilR = Math.max(1e-9, Number(comp.coilResistance) || 200);
            const iCoil = (getVoltage(n0) - getVoltage(n1)) / coilR;
            flows[0] = -iCoil;
            flows[1] = iCoil;
        }

        if (n2 != null && n2 >= 0 && n3 != null && n3 >= 0) {
            const contactR = comp.energized
                ? Math.max(1e-9, Number(comp.contactOnResistance) || 1e-3)
                : Math.max(1, Number(comp.contactOffResistance) || 1e12);
            const iContact = (getVoltage(n2) - getVoltage(n3)) / contactR;
            flows[2] = -iContact;
            flows[3] = iContact;
        }

        return flows;
    }

    ensureWireFlowCache(circuit, results) {
        if (circuit._wireFlowCache.version === results && circuit._wireFlowCache.map) {
            return;
        }
        circuit._wireFlowCache = {
            version: results,
            map: this.computeWireFlowCache(circuit, results)
        };
    }

    computeWireFlowCache(circuit, results) {
        const wiresByNode = new Map();
        const cache = new Map();

        for (const wire of circuit?.wires?.values?.() || []) {
            const nodeId = wire?.nodeIndex;
            if (nodeId === undefined || nodeId === null || nodeId < 0) continue;
            if (!wiresByNode.has(nodeId)) wiresByNode.set(nodeId, []);
            wiresByNode.get(nodeId).push(wire);
        }

        for (const [, nodeWires] of wiresByNode) {
            const nodeMap = this.computeNodeWireFlow(circuit, nodeWires, results);
            for (const [wireId, info] of nodeMap) {
                cache.set(wireId, info);
            }
        }

        return cache;
    }

    computeNodeWireFlow(circuit, nodeWires, results) {
        const physical = this.computeNodeWireFlowPhysical(circuit, nodeWires, results);
        if (physical) return physical;
        const nodeResult = new Map();
        for (const wire of nodeWires || []) {
            nodeResult.set(wire.id, { flowDirection: 0, currentMagnitude: 0 });
        }
        return nodeResult;
    }

    computeNodeWireFlowPhysical(circuit, nodeWires, results) {
        if (!nodeWires || nodeWires.length === 0) return new Map();
        const nodeId = nodeWires[0]?.nodeIndex;
        if (nodeId === undefined || nodeId === null || nodeId < 0) return null;

        const keys = [];
        const indexOfKey = new Map();
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

        const injections = new Array(n).fill(0);
        const tiny = 1e-12;
        for (const comp of circuit?.components?.values?.() || []) {
            if (!Array.isArray(comp.nodes)) continue;
            for (let ti = 0; ti < comp.nodes.length; ti++) {
                if (comp.nodes[ti] !== nodeId) continue;
                const pos = getTerminalWorldPosition(comp, ti);
                const vKey = pointKey(pos);
                if (!vKey || !indexOfKey.has(vKey)) continue;
                const idx = indexOfKey.get(vKey);
                const rawFlow = this.getTerminalCurrentFlow(circuit, comp, ti, results);
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

    computeNodeWireFlowHeuristic(_circuit, _nodeWires, _results) {
        return null;
    }

    isIdealVoltmeter(comp) {
        if (!comp || comp.type !== 'Voltmeter') return false;
        const r = comp.resistance;
        return r === null || r === undefined || r === Infinity || r >= 1e10;
    }
}
