function buildDefaultState(descriptor = {}) {
    switch (descriptor.type) {
        case 'Capacitor':
        case 'ParallelPlateCapacitor':
            return {
                prevVoltage: 0,
                prevCharge: 0,
                prevCurrent: 0,
                dynamicHistoryReady: false
            };
        case 'Inductor':
            return {
                prevCurrent: Number.isFinite(Number(descriptor.initialCurrent))
                    ? Number(descriptor.initialCurrent)
                    : 0,
                prevVoltage: 0,
                dynamicHistoryReady: false
            };
        case 'Motor':
            return {
                speed: 0,
                backEmf: 0
            };
        case 'Diode':
        case 'LED':
            return {
                conducting: false,
                junctionVoltage: 0,
                junctionCurrent: 0,
                brightness: 0
            };
        case 'Relay':
            return {
                energized: false
            };
        case 'Fuse':
            return {
                i2tAccum: 0,
                blown: false
            };
        default:
            return {};
    }
}

function normalizeDescriptor(componentOrId, type) {
    if (componentOrId && typeof componentOrId === 'object') {
        return {
            id: String(componentOrId.id || ''),
            type: typeof componentOrId.type === 'string' ? componentOrId.type : 'Unknown',
            initialCurrent: componentOrId.initialCurrent
        };
    }

    return {
        id: String(componentOrId || ''),
        type: typeof type === 'string' ? type : 'Unknown'
    };
}

export class SimulationStateV2 {
    constructor() {
        this.byId = new Map();
    }

    get size() {
        return this.byId.size;
    }

    get(id) {
        return this.byId.get(String(id));
    }

    ensure(componentOrId, type) {
        const descriptor = normalizeDescriptor(componentOrId, type);
        if (!descriptor.id) {
            throw new Error('SimulationStateV2.ensure requires component id');
        }
        if (!this.byId.has(descriptor.id)) {
            this.byId.set(descriptor.id, buildDefaultState(descriptor));
        }
        return this.byId.get(descriptor.id);
    }

    applyPatch(componentOrId, patch = {}) {
        const descriptor = normalizeDescriptor(componentOrId);
        const entry = this.ensure(descriptor);
        if (patch && typeof patch === 'object') {
            Object.assign(entry, patch);
        }
        return entry;
    }

    reset(components = null) {
        if (!Array.isArray(components)) {
            this.byId.clear();
            return this;
        }

        const next = new Map();
        for (const component of components) {
            const descriptor = normalizeDescriptor(component);
            if (!descriptor.id) continue;
            next.set(descriptor.id, buildDefaultState(descriptor));
        }
        this.byId = next;
        return this;
    }
}
