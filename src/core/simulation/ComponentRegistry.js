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
