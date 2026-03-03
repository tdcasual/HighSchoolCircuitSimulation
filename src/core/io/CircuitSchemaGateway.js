import { ComponentDefaults, getComponentTerminalCount } from '../../components/Component.js';

const SUPPORTED_COMPONENT_TYPES = new Set(Object.keys(ComponentDefaults));
const POWER_COMPONENT_TYPES = new Set(['PowerSource', 'ACVoltageSource']);
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
const SUPPORTED_PROBE_TYPES = new Set(['NodeVoltageProbe', 'WireCurrentProbe']);

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertPlainObject(value, label) {
    if (!isPlainObject(value)) {
        throw new Error(`${label} 不是对象`);
    }
}

function assertKnownKeys(value, allowed, label) {
    for (const key of Object.keys(value)) {
        if (!allowed.has(key)) {
            throw new Error(`${label} 包含未知字段: ${key}`);
        }
    }
}

function assertFiniteNumber(value, label) {
    if (!Number.isFinite(Number(value))) {
        throw new Error(`${label} 坐标非法: ${JSON.stringify(value)}`);
    }
}

function assertNoLegacyAliases(value, path = 'payload') {
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

function validatePoint(point, label) {
    assertPlainObject(point, label);
    assertKnownKeys(point, POINT_KEYS, label);
    assertFiniteNumber(point.x, `${label}.x`);
    assertFiniteNumber(point.y, `${label}.y`);
}

export class CircuitSchemaGateway {
    static validate(data) {
        if (!isPlainObject(data)) {
            throw new Error('返回结果不是对象');
        }

        assertNoLegacyAliases(data);
        assertKnownKeys(data, TOP_LEVEL_KEYS, 'payload');

        assertPlainObject(data.meta, 'payload.meta');
        assertKnownKeys(data.meta, META_KEYS, 'payload.meta');
        validateVersion(data.meta);

        if (!Array.isArray(data.components) || data.components.length === 0) {
            throw new Error('组件列表缺失或为空');
        }
        if (!Array.isArray(data.wires) || data.wires.length === 0) {
            throw new Error('导线列表缺失或为空');
        }
        if (data.probes !== undefined && !Array.isArray(data.probes)) {
            throw new Error('probes 必须是数组');
        }

        const componentsById = new Map();
        let hasPowerSource = false;

        const requireTerminalRef = (ref, label) => {
            if (!ref) return true;
            assertPlainObject(ref, label);
            assertKnownKeys(ref, TERMINAL_REF_KEYS, label);
            if (ref.componentId === undefined || ref.componentId === null) {
                throw new Error(`${label} 缺少 componentId: ${JSON.stringify(ref)}`);
            }
            if (ref.terminalIndex === undefined || ref.terminalIndex === null) {
                throw new Error(`${label} 缺少 terminalIndex: ${JSON.stringify(ref)}`);
            }
            const componentId = String(ref.componentId);
            const boundComponent = componentsById.get(componentId);
            if (!boundComponent) {
                throw new Error(`${label}.componentId 不存在: ${componentId}`);
            }
            const idx = Number(ref.terminalIndex);
            if (!Number.isInteger(idx) || idx < 0) {
                throw new Error(`${label}.terminalIndex 非法: ${ref.terminalIndex}`);
            }
            const terminalCount = getComponentTerminalCount(boundComponent.type);
            if (idx >= terminalCount) {
                throw new Error(`${label}.terminalIndex 超出范围: ${ref.terminalIndex}`);
            }
            return true;
        };

        for (const comp of data.components) {
            assertPlainObject(comp, 'component');
            assertKnownKeys(comp, COMPONENT_KEYS, `component:${comp?.id || 'unknown'}`);
            if (!comp.id || !comp.type) {
                throw new Error(`组件缺少 id/type: ${JSON.stringify(comp)}`);
            }
            const type = String(comp.type);
            if (!SUPPORTED_COMPONENT_TYPES.has(type)) {
                throw new Error(`不支持的元器件类型: ${type}`);
            }
            assertFiniteNumber(comp.x, `component:${comp.id}.x`);
            assertFiniteNumber(comp.y, `component:${comp.id}.y`);
            const id = String(comp.id);
            if (componentsById.has(id)) {
                throw new Error(`组件 id 重复: ${id}`);
            }
            componentsById.set(id, { ...comp, type });
            if (POWER_COMPONENT_TYPES.has(type)) {
                hasPowerSource = true;
            }
        }

        if (!hasPowerSource) {
            throw new Error('至少需要一个电源元件（PowerSource 或 ACVoltageSource）');
        }

        const wireIds = new Set();
        for (const wire of data.wires) {
            assertPlainObject(wire, 'wire');
            assertKnownKeys(wire, WIRE_KEYS, `wire:${wire?.id || 'unknown'}`);
            if (wire.id === undefined || wire.id === null || String(wire.id).trim() === '') {
                throw new Error(`导线缺少 id: ${JSON.stringify(wire)}`);
            }
            const wireId = String(wire.id).trim();
            if (wireIds.has(wireId)) {
                throw new Error(`导线 id 重复: ${wireId}`);
            }
            wireIds.add(wireId);
            if (!wire.a || !wire.b) {
                throw new Error(`导线必须使用 a/b 端点坐标: ${JSON.stringify(wire)}`);
            }
            validatePoint(wire.a, 'wire.a');
            validatePoint(wire.b, 'wire.b');
            if (Number(wire.a.x) === Number(wire.b.x) && Number(wire.a.y) === Number(wire.b.y)) {
                throw new Error(`导线起点与终点重合: ${JSON.stringify(wire)}`);
            }
            requireTerminalRef(wire.aRef, 'wire.aRef');
            requireTerminalRef(wire.bRef, 'wire.bRef');
        }

        const probeIds = new Set();
        for (const probe of data.probes || []) {
            assertPlainObject(probe, 'probe');
            assertKnownKeys(probe, PROBE_KEYS, `probe:${probe?.id || 'unknown'}`);
            if (!probe.id || !probe.type || !probe.wireId) {
                throw new Error(`probe 字段不完整: ${JSON.stringify(probe)}`);
            }
            const probeId = String(probe.id).trim();
            if (!probeId) {
                throw new Error(`probe.id 非法: ${JSON.stringify(probe.id)}`);
            }
            if (probeIds.has(probeId)) {
                throw new Error(`probe id 重复: ${probeId}`);
            }
            probeIds.add(probeId);
            const probeType = String(probe.type).trim();
            if (!SUPPORTED_PROBE_TYPES.has(probeType)) {
                throw new Error(`不支持的探针类型: ${probeType}`);
            }
            const wireId = String(probe.wireId).trim();
            if (!wireIds.has(wireId)) {
                throw new Error(`probe.wireId 不存在: ${wireId}`);
            }
        }

        return true;
    }
}
