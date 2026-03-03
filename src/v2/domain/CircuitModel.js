function clonePlainValue(value) {
    if (value == null) return value;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map((item) => clonePlainValue(item));
    }
    if (typeof value === 'object') {
        const output = {};
        for (const [key, nested] of Object.entries(value)) {
            const cloned = clonePlainValue(nested);
            if (cloned === undefined) continue;
            output[key] = cloned;
        }
        return output;
    }
    return undefined;
}

function cloneMapEntries(input) {
    const source = input instanceof Map ? input : new Map();
    const cloned = new Map();
    for (const [key, value] of source.entries()) {
        cloned.set(String(key), clonePlainValue(value));
    }
    return cloned;
}

function normalizeVersion(value) {
    return Number.isInteger(value) && value >= 0 ? value : 0;
}

export class CircuitModel {
    #components;
    #wires;
    #version;

    constructor({ components = new Map(), wires = new Map(), version = 0 } = {}) {
        this.#components = cloneMapEntries(components);
        this.#wires = cloneMapEntries(wires);
        this.#version = normalizeVersion(version);
    }

    static empty() {
        return new CircuitModel();
    }

    get version() {
        return this.#version;
    }

    get components() {
        return cloneMapEntries(this.#components);
    }

    get wires() {
        return cloneMapEntries(this.#wires);
    }

    getComponent(id) {
        if (!this.#components.has(String(id))) return undefined;
        return clonePlainValue(this.#components.get(String(id)));
    }

    getWire(id) {
        if (!this.#wires.has(String(id))) return undefined;
        return clonePlainValue(this.#wires.get(String(id)));
    }

    cloneComponentsMap() {
        return cloneMapEntries(this.#components);
    }

    cloneWiresMap() {
        return cloneMapEntries(this.#wires);
    }

    withState({ components = this.#components, wires = this.#wires, version = this.#version } = {}) {
        return new CircuitModel({
            components,
            wires,
            version
        });
    }
}
