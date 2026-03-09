export class CircuitObservationProbeService {
    ensureUniqueObservationProbeId(circuit, baseId = `probe_${Date.now()}`) {
        if (!circuit?.observationProbes?.has?.(baseId)) return baseId;
        let index = 1;
        while (circuit.observationProbes.has(`${baseId}_${index}`)) {
            index += 1;
        }
        return `${baseId}_${index}`;
    }

    normalizeObservationProbe(probe) {
        if (!probe || typeof probe !== 'object') return null;
        const type = probe.type;
        if (type !== 'NodeVoltageProbe' && type !== 'WireCurrentProbe') return null;
        if (probe.id === undefined || probe.id === null || String(probe.id).trim() === '') return null;
        if (probe.wireId === undefined || probe.wireId === null || String(probe.wireId).trim() === '') return null;
        return {
            id: String(probe.id),
            type,
            wireId: String(probe.wireId),
            label: typeof probe.label === 'string' ? probe.label : null
        };
    }

    addObservationProbe(circuit, probe) {
        const normalized = this.normalizeObservationProbe(probe);
        if (!normalized) return null;
        circuit?.observationProbes?.set?.(normalized.id, normalized);
        return normalized;
    }

    removeObservationProbe(circuit, id) {
        if (id === undefined || id === null || String(id).trim() === '') return false;
        return !!circuit?.observationProbes?.delete?.(String(id));
    }

    removeObservationProbesByWireId(circuit, wireId) {
        if (wireId === undefined || wireId === null || String(wireId).trim() === '') return;
        const target = String(wireId);
        for (const [id, probe] of circuit?.observationProbes?.entries?.() || []) {
            if (probe?.wireId === target) {
                circuit.observationProbes.delete(id);
            }
        }
    }

    remapObservationProbeWireIds(circuit, replacementByRemovedId = {}) {
        if (!replacementByRemovedId || typeof replacementByRemovedId !== 'object') return;
        for (const probe of circuit?.observationProbes?.values?.() || []) {
            if (!probe?.wireId) continue;
            let current = probe.wireId;
            const seen = new Set();
            while (replacementByRemovedId[current] && !seen.has(current)) {
                seen.add(current);
                current = replacementByRemovedId[current];
            }
            probe.wireId = current;
        }
    }

    getObservationProbe(circuit, id) {
        if (id === undefined || id === null || String(id).trim() === '') return undefined;
        return circuit?.observationProbes?.get?.(String(id));
    }

    getAllObservationProbes(circuit) {
        return Array.from(circuit?.observationProbes?.values?.() || []);
    }
}
