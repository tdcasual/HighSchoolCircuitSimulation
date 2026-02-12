import { computeNtcThermistorResistance, computePhotoresistorResistance } from '../../utils/Physics.js';
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

        const v1 = voltages[comp.nodes[0]] || 0;
        const v2 = voltages[comp.nodes[1]] || 0;
        const dV = v1 - v2;

        const registryRef = context.registry || DefaultComponentRegistry;
        const handler = registryRef ? registryRef.get(comp.type) : null;
        if (handler && typeof handler.current === 'function') {
            return handler.current(comp, {
                voltage: (nodeIdx) => {
                    if (nodeIdx === undefined || nodeIdx < 0) return 0;
                    return voltages[nodeIdx] || 0;
                }
            }, { n1: comp.nodes?.[0], n2: comp.nodes?.[1] });
        }

        switch (comp.type) {
            case 'Resistor':
            case 'Bulb':
                return comp.resistance > 0 ? dV / comp.resistance : 0;

            case 'Thermistor': {
                const resistance = computeNtcThermistorResistance(comp);
                return resistance > 0 ? dV / resistance : 0;
            }
            case 'Photoresistor': {
                const resistance = computePhotoresistorResistance(comp);
                return resistance > 0 ? dV / resistance : 0;
            }
            case 'Relay': {
                const coilR = Math.max(1e-9, Number(comp.coilResistance) || 200);
                return dV / coilR;
            }

            case 'Diode':
            case 'LED': {
                const vfDefault = comp.type === 'LED' ? 2.0 : 0.7;
                const ronDefault = comp.type === 'LED' ? 2 : 1;
                const vf = Math.max(0, Number(comp.forwardVoltage) || vfDefault);
                const ron = Math.max(1e-9, Number(comp.onResistance) || ronDefault);
                const roff = Math.max(1, Number(comp.offResistance) || 1e9);
                const conducting = state ? !!state.conducting : !!comp.conducting;
                if (conducting) {
                    return (dV - vf) / ron;
                }
                return dV / roff;
            }

            case 'Rheostat': {
                const getVoltage = (nodeIdx) => {
                    if (nodeIdx === undefined || nodeIdx < 0) return 0;
                    return voltages[nodeIdx] || 0;
                };

                const vLeft = getVoltage(comp.nodes[0]);
                const vRight = getVoltage(comp.nodes[1]);
                const vSlider = getVoltage(comp.nodes[2]);

                const minR = comp.minResistance ?? 0;
                const maxR = comp.maxResistance ?? 100;
                const position = comp.position == null ? 0.5 : Math.min(Math.max(comp.position, 0), 1);
                const range = Math.max(0, maxR - minR);
                const R1 = Math.max(1e-9, minR + range * position);
                const R2 = Math.max(1e-9, maxR - range * position);

                switch (comp.connectionMode) {
                    case 'left-slider':
                        return (vLeft - vSlider) / R1;
                    case 'right-slider':
                        return (vSlider - vRight) / R2;
                    case 'left-right':
                        return (vLeft - vRight) / Math.max(1e-9, maxR);
                    case 'all': {
                        const nLeft = comp.nodes[0];
                        const nRight = comp.nodes[1];
                        const nSlider = comp.nodes[2];

                        const leftEqSlider = (nLeft === nSlider);
                        const rightEqSlider = (nRight === nSlider);
                        const leftEqRight = (nLeft === nRight);

                        if (leftEqSlider && rightEqSlider) {
                            return 0;
                        } else if (leftEqSlider) {
                            return (vSlider - vRight) / R2;
                        } else if (rightEqSlider) {
                            return (vLeft - vSlider) / R1;
                        } else if (leftEqRight) {
                            const RParallel = (R1 * R2) / (R1 + R2);
                            return (vLeft - vSlider) / RParallel;
                        }

                        const I1 = (vLeft - vSlider) / R1;
                        const I2 = (vSlider - vRight) / R2;
                        return Math.abs(I1) > Math.abs(I2) ? I1 : I2;
                    }
                    default:
                        return 0;
                }
            }

            case 'PowerSource':
            case 'ACVoltageSource':
                if (comp._nortonModel) {
                    const terminalVoltage = v1 - v2;
                    const sourceVoltage = this.getSourceInstantVoltage(comp, context);
                    return (sourceVoltage - terminalVoltage) / comp.internalResistance;
                }
                if (!Number.isInteger(comp.vsIndex)) {
                    return 0;
                }
                return -(x[nodeCount - 1 + comp.vsIndex] || 0);

            case 'Motor': {
                const motorCurrent = x[nodeCount - 1 + comp.vsIndex] || 0;
                return -motorCurrent;
            }

            case 'Capacitor':
            case 'ParallelPlateCapacitor': {
                const C = comp.capacitance || 0;
                const method = this.resolveDynamicIntegrationMethod(comp, context);
                if (method === DynamicIntegrationMethods.Trapezoidal) {
                    const Req = context.dt / (2 * Math.max(1e-18, C));
                    const prevVoltage = Number.isFinite(state?.prevVoltage) ? state.prevVoltage
                        : (Number.isFinite(comp.prevVoltage) ? comp.prevVoltage : 0);
                    const prevCurrent = Number.isFinite(state?.prevCurrent) ? state.prevCurrent
                        : (Number.isFinite(comp.prevCurrent) ? comp.prevCurrent : 0);
                    const Ieq = -(prevVoltage / Req + prevCurrent);
                    return dV / Req + Ieq;
                }

                const qPrev = Number.isFinite(state?.prevCharge) ? state.prevCharge : (comp.prevCharge || 0);
                const qNew = C * dV;
                const dQ = qNew - qPrev;
                const dt = Number.isFinite(context.dt) && context.dt > 0 ? context.dt : 0.001;
                return dQ / dt;
            }

            case 'Inductor': {
                const L = Math.max(1e-12, comp.inductance || 0);
                const method = this.resolveDynamicIntegrationMethod(comp, context);
                const prevCurrent = Number.isFinite(state?.prevCurrent)
                    ? state.prevCurrent
                    : (Number.isFinite(comp.prevCurrent)
                        ? comp.prevCurrent
                        : (Number.isFinite(comp.initialCurrent) ? comp.initialCurrent : 0));
                if (method === DynamicIntegrationMethods.Trapezoidal) {
                    const dt = Number.isFinite(context.dt) && context.dt > 0 ? context.dt : 0.001;
                    const Req = (2 * L) / dt;
                    const prevVoltage = Number.isFinite(state?.prevVoltage) ? state.prevVoltage
                        : (Number.isFinite(comp.prevVoltage) ? comp.prevVoltage : 0);
                    const Ieq = prevCurrent + (prevVoltage / Req);
                    return dV / Req + Ieq;
                }
                const dt = Number.isFinite(context.dt) && context.dt > 0 ? context.dt : 0.001;
                return prevCurrent + (dt / L) * dV;
            }

            case 'Switch':
                if (comp.closed) {
                    return dV / 1e-9;
                }
                return 0;

            case 'SPDTSwitch': {
                const routeToB = comp.position === 'b';
                const targetIdx = routeToB ? 2 : 1;
                const commonNode = comp.nodes?.[0];
                const targetNode = comp.nodes?.[targetIdx];
                const vCommon = commonNode !== undefined && commonNode >= 0 ? (voltages[commonNode] || 0) : 0;
                const vTarget = targetNode !== undefined && targetNode >= 0 ? (voltages[targetNode] || 0) : 0;
                const onR = Math.max(1e-9, Number(comp.onResistance) || 1e-9);
                return (vCommon - vTarget) / onR;
            }

            case 'Fuse': {
                const resistance = comp.blown
                    ? Math.max(1, Number(comp.blownResistance) || 1e12)
                    : Math.max(1e-9, Number(comp.coldResistance) || 0.05);
                return dV / resistance;
            }

            case 'Ammeter':
                if (comp.resistance > 0) {
                    return dV / comp.resistance;
                }
                return -(x[nodeCount - 1 + comp.vsIndex] || 0);

            case 'Voltmeter': {
                const vmResistance = comp.resistance;
                if (vmResistance !== null && vmResistance !== undefined
                    && vmResistance !== Infinity && vmResistance > 0) {
                    return dV / vmResistance;
                }
                return 0;
            }

            default:
                return 0;
        }
    }
}
