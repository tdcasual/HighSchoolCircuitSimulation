import { DefaultStampRegistryV2, IDEAL_SOURCE_RESISTANCE_EPS, resolveSourceInstantVoltage } from './StampRegistryV2.js';

function isValidNode(nodeIdx) {
    return nodeIdx !== undefined && nodeIdx !== null && nodeIdx >= 0;
}

export class ResultPostprocessorV2 {
    static computeCurrents(components = [], voltages = [], context = {}) {
        const currents = new Map();
        const state = context?.state;
        const dt = Number.isFinite(context?.dt) && context.dt > 0 ? context.dt : 0.001;
        const simTime = Number.isFinite(Number(context?.simTime)) ? Number(context.simTime) : 0;
        const solveVector = Array.isArray(context?.solveVector) ? context.solveVector : [];
        const nodeCount = Number.isFinite(context?.nodeCount) ? context.nodeCount : voltages.length;
        const getSourceInstantVoltage = typeof context.getSourceInstantVoltage === 'function'
            ? context.getSourceInstantVoltage
            : (comp) => resolveSourceInstantVoltage(comp, simTime);
        const resolveDynamicIntegrationMethod = context.resolveDynamicIntegrationMethod;

        for (const comp of components) {
            const rawId = comp?.id;
            const id = rawId === undefined || rawId === null ? '' : String(rawId);
            if (!id) continue;

            currents.set(id, calculateCurrent(comp, {
                voltages,
                solveVector,
                nodeCount,
                dt,
                simTime,
                state,
                getSourceInstantVoltage,
                resolveDynamicIntegrationMethod
            }));
        }

        return currents;
    }
}

function calculateCurrent(comp, context) {
    if (comp.type === 'Ground' || comp.type === 'BlackBox') return 0;

    const isFiniteResistanceSource = (comp.type === 'PowerSource' || comp.type === 'ACVoltageSource')
        && Number.isFinite(Number(comp.internalResistance))
        && Number(comp.internalResistance) >= IDEAL_SOURCE_RESISTANCE_EPS;
    if (comp._isShorted && !isFiniteResistanceSource) {
        return 0;
    }

    if (comp.type !== 'Rheostat' && comp.type !== 'SPDTSwitch' && comp.type !== 'Relay') {
        if (!comp.nodes || !isValidNode(comp.nodes[0]) || !isValidNode(comp.nodes[1])) {
            return 0;
        }
    } else if (comp.type === 'Relay') {
        if (!comp.nodes || !isValidNode(comp.nodes[0]) || !isValidNode(comp.nodes[1])) {
            return 0;
        }
    } else if (comp.type === 'SPDTSwitch') {
        const routeToB = comp.position === 'b';
        const targetIdx = routeToB ? 2 : 1;
        if (!comp.nodes || !isValidNode(comp.nodes[0]) || !isValidNode(comp.nodes[targetIdx])) {
            return 0;
        }
    } else {
        const mode = comp.connectionMode || 'none';
        const nLeft = comp.nodes?.[0];
        const nRight = comp.nodes?.[1];
        const nSlider = comp.nodes?.[2];
        const leftValid = isValidNode(nLeft);
        const rightValid = isValidNode(nRight);
        const sliderValid = isValidNode(nSlider);
        switch (mode) {
            case 'left-slider':
                if (!leftValid || !sliderValid) return 0;
                break;
            case 'right-slider':
                if (!rightValid || !sliderValid) return 0;
                break;
            case 'left-right':
                if (!leftValid || !rightValid) return 0;
                break;
            case 'all':
                if (!leftValid || !rightValid || !sliderValid) return 0;
                break;
            default:
                return 0;
        }
    }

    const handler = DefaultStampRegistryV2.get(comp.type);
    if (!handler || typeof handler.current !== 'function') return 0;

    const voltages = Array.isArray(context.voltages) ? context.voltages : [];
    return handler.current(comp, {
        voltage: (nodeIdx) => {
            if (!isValidNode(nodeIdx)) return 0;
            return voltages[nodeIdx] || 0;
        },
        solveVector: context.solveVector,
        nodeCount: context.nodeCount,
        dt: context.dt,
        simTime: context.simTime,
        resolveDynamicIntegrationMethod: context.resolveDynamicIntegrationMethod,
        getSourceInstantVoltage: context.getSourceInstantVoltage,
        state: context.state && comp?.id ? context.state.get(comp.id) : context.state
    }, {
        n1: comp.nodes?.[0],
        n2: comp.nodes?.[1],
        nodeCount: context.nodeCount
    });
}
