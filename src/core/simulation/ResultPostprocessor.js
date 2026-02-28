import { DynamicIntegrationMethods } from './DynamicIntegrator.js';
import { DefaultComponentRegistry } from './ComponentRegistry.js';
import { createRuntimeLogger } from '../../utils/Logger.js';

export class ResultPostprocessor {
    constructor(deps = {}) {
        this.deps = deps;
        this.logger = deps.logger || createRuntimeLogger({ scope: 'solver:postprocessor' });
    }

    setLogger(logger) {
        this.logger = logger || createRuntimeLogger({ scope: 'solver:postprocessor' });
    }

    resolveDynamicIntegrationMethod(comp, context = {}) {
        if (typeof context.resolveDynamicIntegrationMethod === 'function') {
            return context.resolveDynamicIntegrationMethod(comp);
        }
        if (typeof this.deps.resolveDynamicIntegrationMethod === 'function') {
            return this.deps.resolveDynamicIntegrationMethod(comp);
        }
        return DynamicIntegrationMethods.BackwardEuler;
    }

    getSourceInstantVoltage(comp, context = {}) {
        if (typeof context.getSourceInstantVoltage === 'function') {
            return context.getSourceInstantVoltage(comp);
        }
        if (typeof this.deps.getSourceInstantVoltage === 'function') {
            return this.deps.getSourceInstantVoltage(comp);
        }
        return 0;
    }

    apply({
        components = [],
        voltages = [],
        x = [],
        nodeCount = 0,
        dt = 0.001,
        debugMode = false,
        resolveDynamicIntegrationMethod,
        getSourceInstantVoltage,
        simulationState,
        registry
    } = {}) {
        const currents = new Map();
        for (const comp of components || []) {
            if (!comp || !comp.id) continue;
            const current = this.calculateCurrent(comp, {
                voltages,
                x,
                nodeCount,
                dt,
                resolveDynamicIntegrationMethod,
                getSourceInstantVoltage,
                simulationState,
                registry
            });
            currents.set(comp.id, current);

            if (debugMode) {
                this.logger?.debug?.(`Current for ${comp.id}: ${current.toFixed(6)}A`);
            }
        }
        return { currents };
    }

    calculateCurrent(comp, context = {}) {
        const voltages = Array.isArray(context.voltages) ? context.voltages : [];
        const x = Array.isArray(context.x) ? context.x : [];
        const nodeCount = Number.isFinite(context.nodeCount) ? context.nodeCount : 0;
        const state = context.simulationState && comp?.id
            ? context.simulationState.get(comp.id)
            : null;

        if (comp.type === 'Ground') {
            return 0;
        }

        const isFiniteResistanceSource = (comp.type === 'PowerSource' || comp.type === 'ACVoltageSource')
            && Number.isFinite(Number(comp.internalResistance))
            && Number(comp.internalResistance) > 1e-9;
        if (comp._isShorted && !isFiniteResistanceSource) {
            return 0;
        }

        const isValidNode = (nodeIdx) => nodeIdx !== undefined && nodeIdx !== null && nodeIdx >= 0;
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

        const registryRef = context.registry || DefaultComponentRegistry;
        const customHandler = registryRef ? registryRef.get(comp.type) : null;
        const defaultHandler = registryRef === DefaultComponentRegistry
            ? null
            : DefaultComponentRegistry.get(comp.type);
        const handler = (customHandler && typeof customHandler.current === 'function')
            ? customHandler
            : ((defaultHandler && typeof defaultHandler.current === 'function') ? defaultHandler : customHandler);
        if (handler && typeof handler.current === 'function') {
            return handler.current(comp, {
                voltage: (nodeIdx) => {
                    if (nodeIdx === undefined || nodeIdx < 0) return 0;
                    return voltages[nodeIdx] || 0;
                },
                solveVector: x,
                nodeCount,
                dt: context.dt,
                resolveDynamicIntegrationMethod: (targetComp) => this.resolveDynamicIntegrationMethod(targetComp, context),
                getSourceInstantVoltage: (targetComp) => this.getSourceInstantVoltage(targetComp, context),
                state
            }, {
                n1: comp.nodes?.[0],
                n2: comp.nodes?.[1],
                nodeCount
            });
        }
        // Unknown component types without registry current handlers are treated as 0A.
        return 0;
    }
}
