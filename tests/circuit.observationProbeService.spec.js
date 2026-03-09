import { describe, expect, it } from 'vitest';
import { CircuitObservationProbeService } from '../src/core/services/CircuitObservationProbeService.js';

function createProbeContext() {
    return {
        observationProbes: new Map()
    };
}

describe('CircuitObservationProbeService', () => {
    it('normalizes, stores, and remaps observation probes', () => {
        const service = new CircuitObservationProbeService();
        const circuit = createProbeContext();

        const stored = service.addObservationProbe(circuit, {
            id: 'probe_1',
            type: 'WireCurrentProbe',
            wireId: 'W1',
            label: 'Probe'
        });
        service.remapObservationProbeWireIds(circuit, { W1: 'W2' });

        expect(stored).toMatchObject({ id: 'probe_1', wireId: 'W2' });
        expect(service.getObservationProbe(circuit, 'probe_1')?.wireId).toBe('W2');
        expect(service.ensureUniqueObservationProbeId(circuit, 'probe_1')).toBe('probe_1_1');
    });
});
