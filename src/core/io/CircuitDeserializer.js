import { createComponent } from '../../components/Component.js';
import { computeOverlapFractionFromOffsetPx, computeParallelPlateCapacitance } from '../../utils/Physics.js';
import { normalizeCanvasPoint, toCanvasInt } from '../../utils/CanvasCoords.js';

function defaultNormalizeObservationProbe(probe) {
    if (!probe || typeof probe !== 'object') return null;
    const type = probe.type;
    if (type !== 'NodeVoltageProbe' && type !== 'WireCurrentProbe') return null;
    if (!probe.id) return null;
    if (!probe.wireId) return null;
    return {
        id: String(probe.id),
        type,
        wireId: String(probe.wireId),
        label: typeof probe.label === 'string' ? probe.label : null
    };
}

function sanitizeRuntimeCriticalProperties(comp) {
    if (!comp || typeof comp !== 'object') return;
    const normalizeFinite = (value, fallback) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    };

    if (comp.type === 'PowerSource' || comp.type === 'ACVoltageSource') {
        const internalResistance = normalizeFinite(comp.internalResistance, 0.5);
        comp.internalResistance = internalResistance >= 0 ? internalResistance : 0.5;
    }

    if (comp.type === 'Ammeter') {
        const resistance = normalizeFinite(comp.resistance, 0);
        comp.resistance = resistance >= 0 ? resistance : 0;
    }

    if (comp.type === 'Motor') {
        const resistance = normalizeFinite(comp.resistance, 5);
        const inertia = normalizeFinite(comp.inertia, 0.01);
        comp.resistance = resistance > 0 ? resistance : 5;
        comp.inertia = inertia > 0 ? inertia : 0.01;
    }
}

export class CircuitDeserializer {
    static deserialize(json, options = {}) {
        const componentList = Array.isArray(json?.components) ? json.components : [];
        const wireList = Array.isArray(json?.wires) ? json.wires : [];
        const probeList = Array.isArray(json?.probes) ? json.probes : [];
        const normalizeObservationProbe = typeof options.normalizeObservationProbe === 'function'
            ? options.normalizeObservationProbe
            : defaultNormalizeObservationProbe;

        const components = [];
        const componentsById = new Map();

        for (const compData of componentList) {
            const comp = createComponent(
                compData.type,
                toCanvasInt(compData.x),
                toCanvasInt(compData.y),
                compData.id
            );

            comp.rotation = compData.rotation || 0;
            if (compData.label) {
                comp.label = compData.label;
            }
            Object.assign(comp, compData.properties);
            sanitizeRuntimeCriticalProperties(comp);

            if ((comp.type === 'Capacitor' || comp.type === 'Inductor' || comp.type === 'ParallelPlateCapacitor')
                && !compData?.properties?.integrationMethod) {
                comp.integrationMethod = 'backward-euler';
            }

            if (comp.type === 'ParallelPlateCapacitor') {
                const plateLengthPx = 24;
                const overlapFraction = computeOverlapFractionFromOffsetPx(comp.plateOffsetYPx || 0, plateLengthPx);
                comp.capacitance = computeParallelPlateCapacitance({
                    plateArea: comp.plateArea,
                    plateDistance: comp.plateDistance,
                    dielectricConstant: comp.dielectricConstant,
                    overlapFraction
                });
            }

            if (comp.type === 'Inductor') {
                comp.prevCurrent = Number.isFinite(comp.initialCurrent) ? comp.initialCurrent : 0;
                comp.prevVoltage = 0;
                comp._dynamicHistoryReady = false;
            }
            if (comp.type === 'Capacitor' || comp.type === 'ParallelPlateCapacitor') {
                comp.prevCurrent = 0;
                comp.prevVoltage = 0;
                comp._dynamicHistoryReady = false;
            }

            if (compData.display && typeof compData.display === 'object') {
                comp.display = {
                    ...(comp.display || {}),
                    ...compData.display
                };
            }

            if (compData.terminalExtensions) {
                const normalized = {};
                for (const [k, v] of Object.entries(compData.terminalExtensions)) {
                    if (!v || typeof v !== 'object') continue;
                    const x = toCanvasInt(v.x || 0);
                    const y = toCanvasInt(v.y || 0);
                    normalized[k] = { x, y };
                }
                comp.terminalExtensions = normalized;
            }

            components.push(comp);
            componentsById.set(comp.id, comp);
        }

        const wires = new Map();
        const ensureUniqueWireId = (baseId) => {
            if (!wires.has(baseId)) return baseId;
            let i = 1;
            while (wires.has(`${baseId}_${i}`)) i += 1;
            return `${baseId}_${i}`;
        };

        const safePoint = (pt) => normalizeCanvasPoint(pt);

        for (const wireData of wireList) {
            if (!wireData || !wireData.id) continue;

            if (!wireData.a || !wireData.b) continue;
            const a = safePoint(wireData.a);
            const b = safePoint(wireData.b);
            if (!a || !b) continue;
            const id = ensureUniqueWireId(wireData.id);
            const wire = { id, a, b };
            if (wireData.aRef) wire.aRef = wireData.aRef;
            if (wireData.bRef) wire.bRef = wireData.bRef;
            wires.set(id, wire);
        }

        const probes = [];
        for (const probeData of probeList) {
            const normalized = normalizeObservationProbe(probeData);
            if (!normalized) continue;
            if (!wires.has(normalized.wireId)) continue;
            probes.push(normalized);
        }

        return {
            components,
            wires: Array.from(wires.values()),
            probes
        };
    }
}
