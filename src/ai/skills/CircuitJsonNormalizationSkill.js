/**
 * CircuitJsonNormalizationSkill.js
 * Normalize model output into canonical circuit JSON (v2 wire schema: a/b + aRef/bRef).
 */

import { normalizeCanvasPoint, toCanvasInt } from '../../utils/CanvasCoords.js';
import { getTerminalWorldPosition } from '../../utils/TerminalGeometry.js';

const RESERVED_COMPONENT_KEYS = new Set([
    'id', 'type', 'label', 'x', 'y', 'rotation', 'properties', 'terminalExtensions', 'display'
]);

const LABEL_PREFIX_BY_TYPE = Object.freeze({
    Ground: 'G',
    PowerSource: 'E',
    ACVoltageSource: 'AC',
    Resistor: 'R',
    Diode: 'D',
    LED: 'LED',
    Thermistor: 'RT',
    Photoresistor: 'LDR',
    Relay: 'K',
    Rheostat: 'R',
    Bulb: 'L',
    Capacitor: 'C',
    ParallelPlateCapacitor: 'C',
    Inductor: 'L',
    Motor: 'M',
    Switch: 'S',
    SPDTSwitch: 'S',
    Fuse: 'F',
    Ammeter: 'A',
    Voltmeter: 'V',
    BlackBox: 'B'
});

function makeUniqueString(base, usedSet) {
    const normalized = String(base || '').trim() || 'unnamed';
    if (!usedSet.has(normalized)) {
        usedSet.add(normalized);
        return normalized;
    }
    let index = 1;
    while (usedSet.has(`${normalized}_${index}`)) {
        index += 1;
    }
    const next = `${normalized}_${index}`;
    usedSet.add(next);
    return next;
}

function normalizeRotation(rotation) {
    const value = Number(rotation);
    if (!Number.isFinite(value)) return 0;
    const normalized = ((Math.round(value / 90) * 90) % 360 + 360) % 360;
    return normalized;
}

function normalizeComponentProperties(component = {}) {
    const base = (component.properties && typeof component.properties === 'object')
        ? { ...component.properties }
        : {};

    for (const [key, value] of Object.entries(component)) {
        if (RESERVED_COMPONENT_KEYS.has(key)) continue;
        if (value === undefined) continue;
        if (!Object.prototype.hasOwnProperty.call(base, key)) {
            base[key] = value;
        }
    }
    return base;
}

function normalizeTerminalExtensions(rawExtensions) {
    if (!rawExtensions || typeof rawExtensions !== 'object') return null;
    const normalized = {};
    for (const [terminalKey, value] of Object.entries(rawExtensions)) {
        if (!value || typeof value !== 'object') continue;
        const point = normalizeCanvasPoint(value);
        if (!point) continue;
        normalized[terminalKey] = point;
    }
    return Object.keys(normalized).length > 0 ? normalized : null;
}

function normalizeDisplay(rawDisplay) {
    if (!rawDisplay || typeof rawDisplay !== 'object') return null;
    const normalized = {};
    for (const key of ['current', 'voltage', 'power']) {
        if (typeof rawDisplay[key] === 'boolean') {
            normalized[key] = rawDisplay[key];
        }
    }
    return Object.keys(normalized).length > 0 ? normalized : null;
}

function defaultLabelForComponent(type, typeIndex) {
    const prefix = LABEL_PREFIX_BY_TYPE[type] || 'X';
    return `${prefix}${typeIndex}`;
}

function normalizeComponent(rawComponent, index, usedIds, typeCounters) {
    if (!rawComponent || typeof rawComponent !== 'object') {
        throw new Error(`组件 ${index + 1} 不是对象`);
    }

    const type = String(rawComponent.type || '').trim();
    if (!type) {
        throw new Error(`组件 ${index + 1} 缺少 type`);
    }

    const nextTypeCount = (typeCounters.get(type) || 0) + 1;
    typeCounters.set(type, nextTypeCount);

    const defaultId = `${type}_${nextTypeCount}`;
    const id = makeUniqueString(rawComponent.id || defaultId, usedIds);
    const label = String(rawComponent.label || defaultLabelForComponent(type, nextTypeCount)).trim() || defaultLabelForComponent(type, nextTypeCount);
    const x = toCanvasInt(rawComponent.x || 0);
    const y = toCanvasInt(rawComponent.y || 0);
    const rotation = normalizeRotation(rawComponent.rotation);
    const properties = normalizeComponentProperties(rawComponent);

    const normalized = {
        id,
        type,
        label,
        x,
        y,
        rotation,
        properties
    };

    const terminalExtensions = normalizeTerminalExtensions(rawComponent.terminalExtensions);
    if (terminalExtensions) {
        normalized.terminalExtensions = terminalExtensions;
    }

    const display = normalizeDisplay(rawComponent.display);
    if (display) {
        normalized.display = display;
    }

    return normalized;
}

function normalizeTerminalRef(rawRef) {
    if (!rawRef || typeof rawRef !== 'object') return null;
    const componentId = rawRef.componentId;
    const terminalIndex = Number(rawRef.terminalIndex);
    if (componentId === undefined || componentId === null) return null;
    if (!Number.isInteger(terminalIndex) || terminalIndex < 0 || terminalIndex > 2) return null;
    return {
        componentId: String(componentId),
        terminalIndex
    };
}

function getLegacyRef(rawWire, prefix) {
    const componentId = rawWire?.[`${prefix}ComponentId`];
    const terminalIndex = rawWire?.[`${prefix}TerminalIndex`];
    if (componentId === undefined || componentId === null) return null;
    return normalizeTerminalRef({ componentId, terminalIndex });
}

function buildComponentGeometryMap(components = []) {
    const map = new Map();
    components.forEach(component => {
        map.set(component.id, {
            ...component,
            ...(component.properties || {})
        });
    });
    return map;
}

function resolveTerminalPoint(ref, componentGeometryMap) {
    if (!ref) return null;
    const component = componentGeometryMap.get(ref.componentId);
    if (!component) return null;
    const point = getTerminalWorldPosition(component, ref.terminalIndex);
    return normalizeCanvasPoint(point);
}

function normalizeJsonText(rawText) {
    const text = String(rawText || '');
    return text
        .replace(/\uFEFF/g, '')
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:\\])\/\/.*$/gm, '$1')
        .replace(/,\s*([}\]])/g, '$1')
        .trim();
}

function collectJsonCandidates(text) {
    const candidates = [];
    const fenceRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
    let match;
    while ((match = fenceRegex.exec(text)) !== null) {
        if (match[1]) {
            candidates.push(match[1].trim());
        }
    }

    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
        candidates.push(text.slice(firstBrace, lastBrace + 1).trim());
    }
    candidates.push(text.trim());

    return [...new Set(candidates.filter(Boolean))];
}

function parseJsonWithRepairs(rawText) {
    if (rawText && typeof rawText === 'object') {
        return rawText;
    }
    const text = String(rawText || '').trim();
    if (!text) {
        throw new Error('AI 响应为空');
    }

    const candidates = collectJsonCandidates(text);
    let lastError = null;

    for (const candidate of candidates) {
        const attempts = [...new Set([
            candidate,
            normalizeJsonText(candidate),
            normalizeJsonText(candidate).replace(/`+/g, '')
        ])];
        for (const attempt of attempts) {
            try {
                return JSON.parse(attempt);
            } catch (error) {
                lastError = error;
            }
        }
    }

    throw new Error(`AI 响应无法解析为 JSON: ${lastError?.message || 'Invalid JSON'}`);
}

function normalizeWireSegmentsFromLegacy(rawWire, componentGeometryMap, usedWireIds, fallbackWireBase) {
    const startRef = normalizeTerminalRef(rawWire.start) || getLegacyRef(rawWire, 'start');
    const endRef = normalizeTerminalRef(rawWire.end) || getLegacyRef(rawWire, 'end');
    if (!startRef || !endRef) return [];

    const startPoint = resolveTerminalPoint(startRef, componentGeometryMap);
    const endPoint = resolveTerminalPoint(endRef, componentGeometryMap);
    if (!startPoint || !endPoint) return [];

    const controlPoints = Array.isArray(rawWire.controlPoints)
        ? rawWire.controlPoints.map(normalizeCanvasPoint).filter(Boolean)
        : [];
    const polyline = [startPoint, ...controlPoints, endPoint];
    if (polyline.length < 2) return [];

    const segments = [];
    const rawBaseId = String(rawWire.id || fallbackWireBase || 'wire');
    for (let index = 0; index < polyline.length - 1; index += 1) {
        const pointA = polyline[index];
        const pointB = polyline[index + 1];
        if (!pointA || !pointB) continue;
        const baseId = index === 0 ? rawBaseId : `${rawBaseId}_${index}`;
        const id = makeUniqueString(baseId, usedWireIds);
        const segment = { id, a: pointA, b: pointB };
        if (index === 0) segment.aRef = startRef;
        if (index === polyline.length - 2) segment.bRef = endRef;
        segments.push(segment);
    }
    return segments;
}

function normalizeWire(rawWire, index, componentGeometryMap, usedWireIds) {
    if (!rawWire || typeof rawWire !== 'object') return [];

    const aRef = normalizeTerminalRef(rawWire.aRef);
    const bRef = normalizeTerminalRef(rawWire.bRef);

    let pointA = normalizeCanvasPoint(rawWire.a);
    let pointB = normalizeCanvasPoint(rawWire.b);
    if (!pointA && aRef) {
        pointA = resolveTerminalPoint(aRef, componentGeometryMap);
    }
    if (!pointB && bRef) {
        pointB = resolveTerminalPoint(bRef, componentGeometryMap);
    }

    if (pointA && pointB) {
        const id = makeUniqueString(rawWire.id || `wire_${index + 1}`, usedWireIds);
        const normalized = {
            id,
            a: pointA,
            b: pointB
        };
        if (aRef) normalized.aRef = aRef;
        if (bRef) normalized.bRef = bRef;
        return [normalized];
    }

    return normalizeWireSegmentsFromLegacy(rawWire, componentGeometryMap, usedWireIds, `wire_${index + 1}`);
}

function normalizeMeta(rawMeta = {}) {
    const meta = (rawMeta && typeof rawMeta === 'object') ? rawMeta : {};
    return {
        version: String(meta.version || '1.0'),
        timestamp: Number.isFinite(Number(meta.timestamp)) ? Number(meta.timestamp) : Date.now(),
        name: String(meta.name || 'AI转换电路'),
        description: String(meta.description || '由AI输出归一化生成')
    };
}

function normalizeCircuitJson(rawJson) {
    const componentsRaw = Array.isArray(rawJson?.components) ? rawJson.components : [];
    const wiresRaw = Array.isArray(rawJson?.wires) ? rawJson.wires : [];
    if (componentsRaw.length === 0) {
        throw new Error('转换结果缺少 components');
    }

    const usedComponentIds = new Set();
    const typeCounters = new Map();
    const components = componentsRaw.map((component, index) => (
        normalizeComponent(component, index, usedComponentIds, typeCounters)
    ));

    const componentGeometryMap = buildComponentGeometryMap(components);
    const usedWireIds = new Set();
    const wires = [];
    wiresRaw.forEach((rawWire, index) => {
        const normalizedSegments = normalizeWire(rawWire, index, componentGeometryMap, usedWireIds);
        wires.push(...normalizedSegments);
    });

    const normalized = {
        meta: normalizeMeta(rawJson.meta),
        components,
        wires
    };

    if (Array.isArray(rawJson.probes)) {
        normalized.probes = rawJson.probes;
    }
    if (rawJson.meta?.exerciseBoard) {
        normalized.meta.exerciseBoard = rawJson.meta.exerciseBoard;
    }
    if (rawJson.meta?.observation) {
        normalized.meta.observation = rawJson.meta.observation;
    }

    return normalized;
}

export const CircuitJsonNormalizationSkill = {
    name: 'circuit_json_normalize',

    run(input = {}) {
        const payload = (input && typeof input === 'object' && 'rawText' in input)
            ? input.rawText
            : input;
        const parsed = parseJsonWithRepairs(payload);
        return normalizeCircuitJson(parsed);
    }
};
