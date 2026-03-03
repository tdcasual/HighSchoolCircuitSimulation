const LEGACY_ALIAS_KEYS = new Set(['templateName', 'bindingMap', 'pendingToolType']);
const TOP_LEVEL_KEYS = new Set(['meta', 'components', 'wires', 'probes']);
const META_KEYS = new Set(['version', 'name', 'timestamp']);
const COMPONENT_KEYS = new Set([
    'id',
    'type',
    'label',
    'x',
    'y',
    'rotation',
    'properties',
    'display',
    'terminalExtensions'
]);
const WIRE_KEYS = new Set(['id', 'a', 'b', 'aRef', 'bRef']);
const POINT_KEYS = new Set(['x', 'y']);
const TERMINAL_REF_KEYS = new Set(['componentId', 'terminalIndex']);
const PROBE_KEYS = new Set(['id', 'type', 'wireId', 'label']);
const SUPPORTED_COMPONENT_TYPES = new Set([
    'Ground',
    'PowerSource',
    'ACVoltageSource',
    'Resistor',
    'Diode',
    'LED',
    'Thermistor',
    'Photoresistor',
    'Relay',
    'Rheostat',
    'Bulb',
    'Capacitor',
    'Inductor',
    'ParallelPlateCapacitor',
    'Motor',
    'Switch',
    'SPDTSwitch',
    'Fuse',
    'Ammeter',
    'Voltmeter',
    'BlackBox'
]);
const SUPPORTED_PROBE_TYPES = new Set(['NodeVoltageProbe', 'WireCurrentProbe']);
const COMPONENT_TERMINAL_COUNTS = Object.freeze({
    Ground: 1,
    PowerSource: 2,
    ACVoltageSource: 2,
    Resistor: 2,
    Diode: 2,
    LED: 2,
    Thermistor: 2,
    Photoresistor: 2,
    Relay: 4,
    Rheostat: 3,
    Bulb: 2,
    Capacitor: 2,
    Inductor: 2,
    ParallelPlateCapacitor: 2,
    Motor: 2,
    Switch: 2,
    SPDTSwitch: 3,
    Fuse: 2,
    Ammeter: 2,
    Voltmeter: 2,
    BlackBox: 2
});

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertPlainObject(value, label) {
    if (!isPlainObject(value)) {
        throw new Error(`${label} must be an object`);
    }
}

function assertFiniteNumber(value, label) {
    if (!Number.isFinite(Number(value))) {
        throw new Error(`${label} must be a finite number`);
    }
}

function assertKnownKeys(objectValue, allowedKeys, label) {
    for (const key of Object.keys(objectValue)) {
        if (!allowedKeys.has(key)) {
            throw new Error(`${label} contains unknown key "${key}"`);
        }
    }
}

function assertNoLegacyAliases(value, path = 'root') {
    if (Array.isArray(value)) {
        value.forEach((item, index) => assertNoLegacyAliases(item, `${path}[${index}]`));
        return;
    }
    if (!isPlainObject(value)) return;

    for (const [key, nested] of Object.entries(value)) {
        if (LEGACY_ALIAS_KEYS.has(key)) {
            throw new Error(`legacy field "${key}" is not allowed at ${path}.${key}`);
        }
        assertNoLegacyAliases(nested, `${path}.${key}`);
    }
}

function validateVersion(meta) {
    const version = meta.version;
    const isV3 = version === 3 || version === '3' || version === '3.0';
    if (!isV3) {
        throw new Error(`meta.version must be 3, received "${String(version)}"`);
    }
}

function validateTerminalRef(ref, label) {
    if (ref == null) return;
    assertPlainObject(ref, label);
    assertKnownKeys(ref, TERMINAL_REF_KEYS, label);
    if (typeof ref.componentId !== 'string' || !ref.componentId.trim()) {
        throw new Error(`${label}.componentId must be a non-empty string`);
    }
    if (!Number.isInteger(ref.terminalIndex) || ref.terminalIndex < 0) {
        throw new Error(`${label}.terminalIndex must be a non-negative integer`);
    }
}

function validatePoint(point, label) {
    assertPlainObject(point, label);
    assertKnownKeys(point, POINT_KEYS, label);
    assertFiniteNumber(point.x, `${label}.x`);
    assertFiniteNumber(point.y, `${label}.y`);
}

function validateComponent(component, index) {
    const label = `components[${index}]`;
    assertPlainObject(component, label);
    assertKnownKeys(component, COMPONENT_KEYS, label);
    if (typeof component.id !== 'string' || !component.id.trim()) {
        throw new Error(`${label}.id must be a non-empty string`);
    }
    if (typeof component.type !== 'string' || !component.type.trim()) {
        throw new Error(`${label}.type must be a non-empty string`);
    }
    if (!SUPPORTED_COMPONENT_TYPES.has(component.type)) {
        throw new Error(`${label}.type unsupported component type: ${component.type}`);
    }
    assertFiniteNumber(component.x, `${label}.x`);
    assertFiniteNumber(component.y, `${label}.y`);
    if (component.rotation !== undefined) {
        assertFiniteNumber(component.rotation, `${label}.rotation`);
    }
    if (component.properties !== undefined && !isPlainObject(component.properties)) {
        throw new Error(`${label}.properties must be an object`);
    }
    if (component.display !== undefined && component.display !== null && !isPlainObject(component.display)) {
        throw new Error(`${label}.display must be an object or null`);
    }
    if (
        component.terminalExtensions !== undefined
        && component.terminalExtensions !== null
        && !isPlainObject(component.terminalExtensions)
    ) {
        throw new Error(`${label}.terminalExtensions must be an object or null`);
    }
}

function validateWire(wire, index) {
    const label = `wires[${index}]`;
    assertPlainObject(wire, label);
    assertKnownKeys(wire, WIRE_KEYS, label);
    if (typeof wire.id !== 'string' || !wire.id.trim()) {
        throw new Error(`${label}.id must be a non-empty string`);
    }
    if (!wire.a || !wire.b) {
        throw new Error(`${label} must include wire.a and wire.b endpoints`);
    }
    validatePoint(wire.a, `${label}.a`);
    validatePoint(wire.b, `${label}.b`);
    validateTerminalRef(wire.aRef, `${label}.aRef`);
    validateTerminalRef(wire.bRef, `${label}.bRef`);
}

function validateTerminalRefBinding(ref, label, componentTypeById) {
    if (!ref) return;
    const componentId = String(ref.componentId);
    if (!componentTypeById.has(componentId)) {
        throw new Error(`${label}.componentId not found: ${componentId}`);
    }
    const componentType = componentTypeById.get(componentId);
    const terminalCount = Number(COMPONENT_TERMINAL_COUNTS[componentType]);
    if (!Number.isInteger(terminalCount) || terminalCount <= 0) {
        throw new Error(`${label}.component type has invalid terminal count: ${componentType}`);
    }
    if (ref.terminalIndex >= terminalCount) {
        throw new Error(`${label}.terminalIndex out of range: ${ref.terminalIndex}`);
    }
}

function validateProbe(probe, index) {
    const label = `probes[${index}]`;
    assertPlainObject(probe, label);
    assertKnownKeys(probe, PROBE_KEYS, label);
    if (typeof probe.id !== 'string' || !probe.id.trim()) {
        throw new Error(`${label}.id must be a non-empty string`);
    }
    if (typeof probe.type !== 'string' || !probe.type.trim()) {
        throw new Error(`${label}.type must be a non-empty string`);
    }
    if (!SUPPORTED_PROBE_TYPES.has(probe.type)) {
        throw new Error(`${label}.type unsupported probe type: ${probe.type}`);
    }
    if (typeof probe.wireId !== 'string' || !probe.wireId.trim()) {
        throw new Error(`${label}.wireId must be a non-empty string`);
    }
    if (probe.label !== undefined && probe.label !== null && typeof probe.label !== 'string') {
        throw new Error(`${label}.label must be a string or null`);
    }
}

export function validateCircuitV3(payload) {
    assertPlainObject(payload, 'payload');
    assertNoLegacyAliases(payload);
    assertKnownKeys(payload, TOP_LEVEL_KEYS, 'payload');

    assertPlainObject(payload.meta, 'payload.meta');
    assertKnownKeys(payload.meta, META_KEYS, 'payload.meta');
    validateVersion(payload.meta);

    if (!Array.isArray(payload.components)) {
        throw new Error('payload.components must be an array');
    }
    if (!Array.isArray(payload.wires)) {
        throw new Error('payload.wires must be an array');
    }
    if (payload.probes !== undefined && !Array.isArray(payload.probes)) {
        throw new Error('payload.probes must be an array when present');
    }

    const componentIds = new Set();
    const componentTypeById = new Map();
    payload.components.forEach((component, index) => {
        validateComponent(component, index);
        if (componentIds.has(component.id)) {
            throw new Error(`components[${index}].id duplicate component id: ${component.id}`);
        }
        componentIds.add(component.id);
        componentTypeById.set(component.id, component.type);
    });

    const wireIds = new Set();
    payload.wires.forEach((wire, index) => {
        validateWire(wire, index);
        if (wireIds.has(wire.id)) {
            throw new Error(`wires[${index}].id duplicate wire id: ${wire.id}`);
        }
        if (Number(wire.a.x) === Number(wire.b.x) && Number(wire.a.y) === Number(wire.b.y)) {
            throw new Error(`wires[${index}] wire endpoints overlap`);
        }
        validateTerminalRefBinding(wire.aRef, `wires[${index}].aRef`, componentTypeById);
        validateTerminalRefBinding(wire.bRef, `wires[${index}].bRef`, componentTypeById);
        wireIds.add(wire.id);
    });

    const probeIds = new Set();
    (payload.probes || []).forEach((probe, index) => {
        validateProbe(probe, index);
        if (probeIds.has(probe.id)) {
            throw new Error(`probes[${index}].id duplicate probe id: ${probe.id}`);
        }
        probeIds.add(probe.id);
        if (!wireIds.has(probe.wireId)) {
            throw new Error(`probes[${index}].wireId not found: ${probe.wireId}`);
        }
    });

    return true;
}
