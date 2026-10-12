import { toCanvasInt } from '../../utils/CanvasCoords.js';

export class CircuitSerializer {
    static serialize(circuit, options = {}) {
        const components = Array.isArray(options.components)
            ? options.components
            : (circuit?.components instanceof Map ? Array.from(circuit.components.values()) : []);
        const wires = Array.isArray(options.wires)
            ? options.wires
            : (circuit?.wires instanceof Map ? Array.from(circuit.wires.values()) : []);
        const probes = Array.isArray(options.probes)
            ? options.probes
            : (typeof circuit?.getAllObservationProbes === 'function'
                ? circuit.getAllObservationProbes()
                : []);
        const getComponentProperties = typeof options.getComponentProperties === 'function'
            ? options.getComponentProperties
            : (typeof circuit?.getComponentProperties === 'function'
                ? (comp) => circuit.getComponentProperties(comp)
                : () => ({}));
        const hasWire = typeof options.hasWire === 'function'
            ? options.hasWire
            : (wireId => (circuit?.wires instanceof Map ? circuit.wires.has(wireId) : false));

        const componentIds = new Set(components.map((comp) => String(comp?.id)));
        const serializeRef = (ref) => {
            if (!ref || typeof ref !== 'object') return null;
            const componentId = ref.componentId;
            if (componentId === undefined || componentId === null) return null;
            if (!componentIds.has(String(componentId))) return null;
            return ref;
        };

        return {
            meta: {
                version: 3,
                timestamp: Date.now(),
                name: '电路设计'
            },
            components: components.map(comp => ({
                id: comp.id,
                type: comp.type,
                label: comp.label || null,
                x: toCanvasInt(comp.x),
                y: toCanvasInt(comp.y),
                rotation: comp.rotation || 0,
                properties: getComponentProperties(comp),
                display: comp.display || null,
                terminalExtensions: comp.terminalExtensions || null
            })),
            wires: wires.map(wire => {
                const aRef = serializeRef(wire?.aRef);
                const bRef = serializeRef(wire?.bRef);
                return {
                    id: wire.id,
                    a: { x: toCanvasInt(wire?.a?.x ?? 0), y: toCanvasInt(wire?.a?.y ?? 0) },
                    b: { x: toCanvasInt(wire?.b?.x ?? 0), y: toCanvasInt(wire?.b?.y ?? 0) },
                    ...(aRef ? { aRef } : {}),
                    ...(bRef ? { bRef } : {})
                };
            }),
            probes: probes
                .filter((probe) => probe?.wireId && hasWire(probe.wireId))
                .map((probe) => ({
                    id: probe.id,
                    type: probe.type,
                    wireId: probe.wireId,
                    ...(probe.label ? { label: probe.label } : {})
                }))
        };
    }
}
