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

        return {
            meta: {
                version: '2.0',
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
            wires: wires.map(wire => ({
                id: wire.id,
                a: { x: toCanvasInt(wire?.a?.x ?? 0), y: toCanvasInt(wire?.a?.y ?? 0) },
                b: { x: toCanvasInt(wire?.b?.x ?? 0), y: toCanvasInt(wire?.b?.y ?? 0) },
                ...(wire?.aRef ? { aRef: wire.aRef } : {}),
                ...(wire?.bRef ? { bRef: wire.bRef } : {})
            })),
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
