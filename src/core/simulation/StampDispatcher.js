export class StampDispatcher {
    constructor(handlers = {}) {
        this.handlers = handlers;
        this.routeByType = {
            Resistor: 'stampResistor',
            Bulb: 'stampResistor'
        };
    }

    resolveHandlerKey(componentType) {
        return this.routeByType[componentType] || 'default';
    }

    stamp(component, context = {}) {
        const key = this.resolveHandlerKey(component?.type);
        const handler = this.handlers[key];
        if (typeof handler === 'function') {
            handler(component, context);
            return true;
        }
        if (key !== 'default' && typeof this.handlers.default === 'function') {
            this.handlers.default(component, context);
            return true;
        }
        return false;
    }
}
