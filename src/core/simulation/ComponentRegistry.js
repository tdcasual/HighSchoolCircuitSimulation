import { DynamicIntegrationMethods } from './DynamicIntegrator.js';

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

const resolveMethod = (context, comp) => {
    if (context && typeof context.resolveDynamicIntegrationMethod === 'function') {
        return context.resolveDynamicIntegrationMethod(comp);
    }
    return DynamicIntegrationMethods.BackwardEuler;
};

DefaultComponentRegistry.register('Capacitor', {
    stamp: (comp, context, nodes) => {
        const C = Math.max(1e-18, comp.capacitance || 0);
        const dt = Number.isFinite(context?.dt) && context.dt > 0 ? context.dt : 0.001;
        const method = resolveMethod(context, comp);
        const entry = context?.state && comp?.id ? context.state.get(comp.id) : null;

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
    }
});

DefaultComponentRegistry.register('ParallelPlateCapacitor', DefaultComponentRegistry.get('Capacitor'));

DefaultComponentRegistry.register('Inductor', {
    stamp: (comp, context, nodes) => {
        const L = Math.max(1e-12, comp.inductance || 0);
        const dt = Number.isFinite(context?.dt) && context.dt > 0 ? context.dt : 0.001;
        const method = resolveMethod(context, comp);
        const entry = context?.state && comp?.id ? context.state.get(comp.id) : null;
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
    }
});
