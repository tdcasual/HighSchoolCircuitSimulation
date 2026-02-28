import { DynamicIntegrationMethods } from './DynamicIntegrator.js';
import { computeNtcThermistorResistance, computePhotoresistorResistance } from '../../utils/Physics.js';

export class ComponentRegistry {
    constructor() {
        this.byType = new Map();
    }

    register(type, handlers) {
        if (!type) return;
        this.byType.set(type, handlers || {});
    }

    get(type) {
        return this.byType.get(type) || null;
    }
}

export const DefaultComponentRegistry = new ComponentRegistry();

DefaultComponentRegistry.register('Resistor', {
    stamp: (comp, context, nodes) => {
        context.stampResistor(nodes.i1, nodes.i2, comp.resistance);
    },
    current: (comp, context, nodes) => {
        const dV = context.voltage(nodes.n1) - context.voltage(nodes.n2);
        return comp.resistance > 0 ? dV / comp.resistance : 0;
    }
});

DefaultComponentRegistry.register('Bulb', DefaultComponentRegistry.get('Resistor'));

DefaultComponentRegistry.register('Thermistor', {
    stamp: (comp, context, nodes) => {
        context.stampResistor(nodes.i1, nodes.i2, computeNtcThermistorResistance(comp));
    },
    current: (comp, context, nodes) => {
        const dV = context.voltage(nodes.n1) - context.voltage(nodes.n2);
        const resistance = computeNtcThermistorResistance(comp);
        return resistance > 0 ? dV / resistance : 0;
    }
});

DefaultComponentRegistry.register('Photoresistor', {
    stamp: (comp, context, nodes) => {
        context.stampResistor(nodes.i1, nodes.i2, computePhotoresistorResistance(comp));
    },
    current: (comp, context, nodes) => {
        const dV = context.voltage(nodes.n1) - context.voltage(nodes.n2);
        const resistance = computePhotoresistorResistance(comp);
        return resistance > 0 ? dV / resistance : 0;
    }
});

DefaultComponentRegistry.register('Ammeter', {
    stamp: (comp, context, nodes) => {
        const resistance = Number(comp.resistance);
        const hasFiniteResistance = Number.isFinite(resistance) && resistance > 0;
        if (hasFiniteResistance) {
            context.stampResistor(nodes.i1, nodes.i2, resistance);
            return;
        }
        if (typeof context.stampVoltageSource === 'function') {
            context.stampVoltageSource(nodes.i1, nodes.i2, 0, comp.vsIndex, nodes.nodeCount);
        }
    },
    current: (comp, context, nodes) => {
        const dV = context.voltage(nodes.n1) - context.voltage(nodes.n2);
        const resistance = Number(comp.resistance);
        const hasFiniteResistance = Number.isFinite(resistance) && resistance > 0;
        if (hasFiniteResistance) {
            return dV / resistance;
        }
        const vector = Array.isArray(context.solveVector) ? context.solveVector : [];
        const nodeCount = Number.isFinite(context.nodeCount) ? context.nodeCount : 0;
        return -(vector[nodeCount - 1 + comp.vsIndex] || 0);
    }
});

DefaultComponentRegistry.register('Voltmeter', {
    stamp: (comp, context, nodes) => {
        const resistance = Number(comp.resistance);
        if (Number.isFinite(resistance) && resistance > 0) {
            context.stampResistor(nodes.i1, nodes.i2, resistance);
        }
    },
    current: (comp, context, nodes) => {
        const resistance = Number(comp.resistance);
        if (Number.isFinite(resistance) && resistance > 0) {
            const dV = context.voltage(nodes.n1) - context.voltage(nodes.n2);
            return dV / resistance;
        }
        return 0;
    }
});

DefaultComponentRegistry.register('Switch', {
    stamp: (comp, context, nodes) => {
        if (comp.closed) {
            context.stampResistor(nodes.i1, nodes.i2, 1e-9);
            return;
        }
        context.stampResistor(nodes.i1, nodes.i2, 1e12);
    },
    current: (comp, context, nodes) => {
        const dV = context.voltage(nodes.n1) - context.voltage(nodes.n2);
        if (comp.closed) {
            return dV / 1e-9;
        }
        return 0;
    }
});

DefaultComponentRegistry.register('SPDTSwitch', {
    stamp: (comp, context, nodes) => {
        const nCommon = comp.nodes?.[0];
        const nA = comp.nodes?.[1];
        const nB = comp.nodes?.[2];
        const isValidNode = typeof nodes.isValidNode === 'function'
            ? nodes.isValidNode
            : (nodeIdx) => nodeIdx !== undefined && nodeIdx !== null && nodeIdx >= 0;
        const toMatrixIndex = (nodeIdx) => (isValidNode(nodeIdx) ? nodeIdx - 1 : null);
        const iCommon = toMatrixIndex(nCommon);
        const iA = toMatrixIndex(nA);
        const iB = toMatrixIndex(nB);
        const routeToB = comp.position === 'b';
        const onR = Math.max(1e-9, Number(comp.onResistance) || 1e-9);
        const offR = Math.max(onR, Number(comp.offResistance) || 1e12);

        if (iCommon !== null && iA !== null) {
            context.stampResistor(iCommon, iA, routeToB ? offR : onR);
        }
        if (iCommon !== null && iB !== null) {
            context.stampResistor(iCommon, iB, routeToB ? onR : offR);
        }
    },
    current: (comp, context) => {
        const routeToB = comp.position === 'b';
        const targetIdx = routeToB ? 2 : 1;
        const commonNode = comp.nodes?.[0];
        const targetNode = comp.nodes?.[targetIdx];
        const vCommon = commonNode !== undefined && commonNode >= 0 ? context.voltage(commonNode) : 0;
        const vTarget = targetNode !== undefined && targetNode >= 0 ? context.voltage(targetNode) : 0;
        const onR = Math.max(1e-9, Number(comp.onResistance) || 1e-9);
        return (vCommon - vTarget) / onR;
    }
});

DefaultComponentRegistry.register('Fuse', {
    stamp: (comp, context, nodes) => {
        const resistance = comp.blown
            ? Math.max(1, Number(comp.blownResistance) || 1e12)
            : Math.max(1e-9, Number(comp.coldResistance) || 0.05);
        context.stampResistor(nodes.i1, nodes.i2, resistance);
    },
    current: (comp, context, nodes) => {
        const dV = context.voltage(nodes.n1) - context.voltage(nodes.n2);
        const resistance = comp.blown
            ? Math.max(1, Number(comp.blownResistance) || 1e12)
            : Math.max(1e-9, Number(comp.coldResistance) || 0.05);
        return dV / resistance;
    }
});

const stampSourceViaMNA = (comp, context, nodes) => {
    const sourceVoltage = typeof context.getSourceInstantVoltage === 'function'
        ? context.getSourceInstantVoltage(comp)
        : (Number.isFinite(comp.voltage) ? comp.voltage : 0);
    const internalResistance = Number(comp.internalResistance);
    if (comp._nortonModel && Number.isFinite(internalResistance) && internalResistance > 1e-9) {
        context.stampResistor(nodes.i1, nodes.i2, internalResistance);
        context.stampCurrentSource(nodes.i2, nodes.i1, sourceVoltage / internalResistance);
        return;
    }
    if (typeof context.stampVoltageSource === 'function') {
        context.stampVoltageSource(nodes.i1, nodes.i2, sourceVoltage, comp.vsIndex, nodes.nodeCount);
    }
};

const currentForSourceViaMNA = (comp, context, nodes) => {
    const terminalVoltage = context.voltage(nodes.n1) - context.voltage(nodes.n2);
    if (comp._nortonModel) {
        const sourceVoltage = typeof context.getSourceInstantVoltage === 'function'
            ? context.getSourceInstantVoltage(comp)
            : (Number.isFinite(comp.voltage) ? comp.voltage : 0);
        const resistance = Number(comp.internalResistance);
        if (Number.isFinite(resistance) && resistance > 1e-9) {
            return (sourceVoltage - terminalVoltage) / resistance;
        }
        return 0;
    }
    const vector = Array.isArray(context.solveVector) ? context.solveVector : [];
    const nodeCount = Number.isFinite(context.nodeCount) ? context.nodeCount : 0;
    if (!Number.isInteger(comp.vsIndex)) {
        return 0;
    }
    return -(vector[nodeCount - 1 + comp.vsIndex] || 0);
};

DefaultComponentRegistry.register('PowerSource', {
    stamp: (comp, context, nodes) => stampSourceViaMNA(comp, context, nodes),
    current: (comp, context, nodes) => currentForSourceViaMNA(comp, context, nodes)
});

DefaultComponentRegistry.register('ACVoltageSource', DefaultComponentRegistry.get('PowerSource'));

const resolveMethod = (context, comp) => {
    if (context && typeof context.resolveDynamicIntegrationMethod === 'function') {
        return context.resolveDynamicIntegrationMethod(comp);
    }
    return DynamicIntegrationMethods.BackwardEuler;
};

const resolveStateEntry = (context, comp) => {
    const source = context?.state;
    if (!source) {
        return null;
    }
    if (typeof source.get === 'function' && comp?.id) {
        return source.get(comp.id) || null;
    }
    return source;
};

DefaultComponentRegistry.register('Capacitor', {
    stamp: (comp, context, nodes) => {
        const C = Math.max(1e-18, comp.capacitance || 0);
        const dt = Number.isFinite(context?.dt) && context.dt > 0 ? context.dt : 0.001;
        const method = resolveMethod(context, comp);
        const entry = resolveStateEntry(context, comp);

        if (method === DynamicIntegrationMethods.Trapezoidal) {
            const Req = dt / (2 * C);
            context.stampResistor(nodes.i1, nodes.i2, Req);
            const prevVoltage = Number.isFinite(entry?.prevVoltage)
                ? entry.prevVoltage
                : (Number.isFinite(comp.prevVoltage) ? comp.prevVoltage : 0);
            const prevCurrent = Number.isFinite(entry?.prevCurrent)
                ? entry.prevCurrent
                : (Number.isFinite(comp.prevCurrent) ? comp.prevCurrent : 0);
            const Ieq = -(prevVoltage / Req + prevCurrent);
            context.stampCurrentSource(nodes.i1, nodes.i2, Ieq);
            return;
        }

        const Req = dt / C;
        context.stampResistor(nodes.i1, nodes.i2, Req);
        const qPrev = Number.isFinite(entry?.prevCharge) ? entry.prevCharge : (comp.prevCharge || 0);
        const Ieq = qPrev / dt;
        context.stampCurrentSource(nodes.i2, nodes.i1, Ieq);
    },
    current: (comp, context, nodes) => {
        const C = Math.max(1e-18, comp.capacitance || 0);
        const dt = Number.isFinite(context?.dt) && context.dt > 0 ? context.dt : 0.001;
        const method = resolveMethod(context, comp);
        const entry = resolveStateEntry(context, comp);
        const dV = context.voltage(nodes.n1) - context.voltage(nodes.n2);

        if (method === DynamicIntegrationMethods.Trapezoidal) {
            const Req = dt / (2 * C);
            const prevVoltage = Number.isFinite(entry?.prevVoltage)
                ? entry.prevVoltage
                : (Number.isFinite(comp.prevVoltage) ? comp.prevVoltage : 0);
            const prevCurrent = Number.isFinite(entry?.prevCurrent)
                ? entry.prevCurrent
                : (Number.isFinite(comp.prevCurrent) ? comp.prevCurrent : 0);
            const Ieq = -(prevVoltage / Req + prevCurrent);
            return dV / Req + Ieq;
        }

        const qPrev = Number.isFinite(entry?.prevCharge) ? entry.prevCharge : (comp.prevCharge || 0);
        const qNew = C * dV;
        return (qNew - qPrev) / dt;
    }
});

DefaultComponentRegistry.register('ParallelPlateCapacitor', DefaultComponentRegistry.get('Capacitor'));

DefaultComponentRegistry.register('Inductor', {
    stamp: (comp, context, nodes) => {
        const L = Math.max(1e-12, comp.inductance || 0);
        const dt = Number.isFinite(context?.dt) && context.dt > 0 ? context.dt : 0.001;
        const method = resolveMethod(context, comp);
        const entry = resolveStateEntry(context, comp);
        const prevCurrent = Number.isFinite(entry?.prevCurrent)
            ? entry.prevCurrent
            : (Number.isFinite(comp.prevCurrent)
                ? comp.prevCurrent
                : (Number.isFinite(comp.initialCurrent) ? comp.initialCurrent : 0));

        if (method === DynamicIntegrationMethods.Trapezoidal) {
            const Req = (2 * L) / dt;
            context.stampResistor(nodes.i1, nodes.i2, Req);
            const prevVoltage = Number.isFinite(entry?.prevVoltage)
                ? entry.prevVoltage
                : (Number.isFinite(comp.prevVoltage) ? comp.prevVoltage : 0);
            const Ieq = prevCurrent + (prevVoltage / Req);
            context.stampCurrentSource(nodes.i1, nodes.i2, Ieq);
            return;
        }

        const Req = L / dt;
        context.stampResistor(nodes.i1, nodes.i2, Req);
        context.stampCurrentSource(nodes.i1, nodes.i2, prevCurrent);
    },
    current: (comp, context, nodes) => {
        const L = Math.max(1e-12, comp.inductance || 0);
        const dt = Number.isFinite(context?.dt) && context.dt > 0 ? context.dt : 0.001;
        const method = resolveMethod(context, comp);
        const entry = resolveStateEntry(context, comp);
        const dV = context.voltage(nodes.n1) - context.voltage(nodes.n2);
        const prevCurrent = Number.isFinite(entry?.prevCurrent)
            ? entry.prevCurrent
            : (Number.isFinite(comp.prevCurrent)
                ? comp.prevCurrent
                : (Number.isFinite(comp.initialCurrent) ? comp.initialCurrent : 0));

        if (method === DynamicIntegrationMethods.Trapezoidal) {
            const Req = (2 * L) / dt;
            const prevVoltage = Number.isFinite(entry?.prevVoltage)
                ? entry.prevVoltage
                : (Number.isFinite(comp.prevVoltage) ? comp.prevVoltage : 0);
            const Ieq = prevCurrent + (prevVoltage / Req);
            return dV / Req + Ieq;
        }

        return prevCurrent + (dt / L) * dV;
    }
});
