import { validateCircuitV3 } from './CircuitSchemaV3.js';
import { requireComponentDefinition } from '../components/ComponentDefinitionRegistry.js';

function clonePlainValue(value) {
    if (value == null) return value;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map((item) => clonePlainValue(item)).filter((item) => item !== undefined);
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

function normalizePoint(point) {
    return {
        x: Number(point.x),
        y: Number(point.y)
    };
}

function normalizeTerminalRef(ref) {
    if (!ref) return null;
    return {
        componentId: String(ref.componentId),
        terminalIndex: Number(ref.terminalIndex)
    };
}

function normalizeComponent(component) {
    const definition = requireComponentDefinition(component.type);
    return {
        id: String(component.id),
        type: definition.type,
        label: typeof component.label === 'string' ? component.label : null,
        x: Number(component.x),
        y: Number(component.y),
        rotation: Number.isFinite(Number(component.rotation)) ? Number(component.rotation) : 0,
        properties: clonePlainValue(component.properties || {}),
        display: component.display == null ? null : clonePlainValue(component.display),
        terminalExtensions: component.terminalExtensions == null ? null : clonePlainValue(component.terminalExtensions)
    };
}

function normalizeWire(wire) {
    const normalized = {
        id: String(wire.id),
        a: normalizePoint(wire.a),
        b: normalizePoint(wire.b)
    };
    const aRef = normalizeTerminalRef(wire.aRef);
    const bRef = normalizeTerminalRef(wire.bRef);
    if (aRef) normalized.aRef = aRef;
    if (bRef) normalized.bRef = bRef;
    return normalized;
}

function normalizeProbe(probe) {
    return {
        id: String(probe.id),
        type: String(probe.type),
        wireId: String(probe.wireId),
        label: typeof probe.label === 'string' ? probe.label : null
    };
}

export class CircuitDeserializerV3 {
    static deserialize(payload) {
        validateCircuitV3(payload);

        return {
            meta: {
                version: 3,
                name: typeof payload.meta.name === 'string' ? payload.meta.name : '',
                timestamp: Number.isFinite(Number(payload.meta.timestamp))
                    ? Number(payload.meta.timestamp)
                    : Date.now()
            },
            components: payload.components.map((component) => normalizeComponent(component)),
            wires: payload.wires.map((wire) => normalizeWire(wire)),
            probes: (payload.probes || []).map((probe) => normalizeProbe(probe))
        };
    }
}
