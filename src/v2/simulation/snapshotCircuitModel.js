/**
 * @internal experimental
 * One-shot geometric + electrical snapshot. Does not copy live nodes.
 */

const SNAPSHOT_OMIT_KEYS = new Set([
    'currentValue',
    'voltageValue',
    'powerValue',
    'brightness',
    'vsIndex',
    '_nortonModel',
    '_isShorted',
    'prevVoltage',
    'prevCharge',
    'prevCurrent',
    'junctionVoltage',
    'junctionCurrent',
    'nodes'
]);

function cloneSnapshotValue(value) {
    if (value == null) return value;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }
    if (Array.isArray(value)) {
        return value
            .map((item) => cloneSnapshotValue(item))
            .filter((item) => item !== undefined);
    }
    if (typeof value === 'object') {
        const output = {};
        for (const [key, nested] of Object.entries(value)) {
            if (SNAPSHOT_OMIT_KEYS.has(key)) continue;
            if (typeof nested === 'function') continue;
            const cloned = cloneSnapshotValue(nested);
            if (cloned === undefined) continue;
            output[key] = cloned;
        }
        return output;
    }
    return undefined;
}

function readCollection(source) {
    if (!source) return [];
    if (source instanceof Map) return Array.from(source.values());
    if (Array.isArray(source)) return source;
    return [];
}

function snapshotComponent(component) {
    if (!component || typeof component !== 'object') return null;
    const cloned = cloneSnapshotValue(component);
    if (!cloned || cloned.id === undefined || cloned.id === null) return null;
    return cloned;
}

function snapshotWire(wire) {
    if (!wire || typeof wire !== 'object') return null;
    if (wire.id === undefined || wire.id === null) return null;
    if (typeof wire.id === 'string' && !wire.id.trim()) return null;
    const entry = { id: String(wire.id) };
    if (wire.a && typeof wire.a === 'object') {
        entry.a = { x: Number(wire.a.x), y: Number(wire.a.y) };
    }
    if (wire.b && typeof wire.b === 'object') {
        entry.b = { x: Number(wire.b.x), y: Number(wire.b.y) };
    }
    if (wire.aRef !== undefined) entry.aRef = cloneSnapshotValue(wire.aRef);
    if (wire.bRef !== undefined) entry.bRef = cloneSnapshotValue(wire.bRef);
    return entry;
}

export function snapshotCircuitModel(circuit) {
    const source = circuit && typeof circuit === 'object' ? circuit : {};
    const topologyVersion = Number.isInteger(source.topologyVersion)
        ? source.topologyVersion
        : (Number.isInteger(source.version) ? source.version : 0);

    const components = [];
    for (const component of readCollection(source.components)) {
        const snapped = snapshotComponent(component);
        if (snapped) components.push(snapped);
    }

    const wires = [];
    for (const wire of readCollection(source.wires)) {
        const snapped = snapshotWire(wire);
        if (snapped) wires.push(snapped);
    }

    return {
        topologyVersion,
        components,
        wires
    };
}
