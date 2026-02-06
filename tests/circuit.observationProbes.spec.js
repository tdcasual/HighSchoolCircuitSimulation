import { describe, it, expect } from 'vitest';
import { Circuit } from '../src/engine/Circuit.js';

describe('Circuit observation probes', () => {
    it('adds and removes probes', () => {
        const circuit = new Circuit();
        circuit.addWire({ id: 'W1', a: { x: 0, y: 0 }, b: { x: 20, y: 0 } });

        const probe = circuit.addObservationProbe({
            id: 'P1',
            type: 'NodeVoltageProbe',
            wireId: 'W1',
            label: '节点电压1'
        });

        expect(probe).toBeTruthy();
        expect(circuit.getObservationProbe('P1')?.wireId).toBe('W1');
        expect(circuit.removeObservationProbe('P1')).toBe(true);
        expect(circuit.getObservationProbe('P1')).toBeUndefined();
    });

    it('removes probes when wire is deleted', () => {
        const circuit = new Circuit();
        circuit.addWire({ id: 'W1', a: { x: 0, y: 0 }, b: { x: 20, y: 0 } });
        circuit.addWire({ id: 'W2', a: { x: 0, y: 20 }, b: { x: 20, y: 20 } });

        circuit.addObservationProbe({ id: 'P1', type: 'NodeVoltageProbe', wireId: 'W1' });
        circuit.addObservationProbe({ id: 'P2', type: 'WireCurrentProbe', wireId: 'W2' });

        circuit.removeWire('W1');

        expect(circuit.getObservationProbe('P1')).toBeUndefined();
        expect(circuit.getObservationProbe('P2')).toBeTruthy();
    });

    it('remaps probe wireId when compaction merges segments', () => {
        const circuit = new Circuit();
        circuit.addWire({ id: 'W1', a: { x: 0, y: 0 }, b: { x: 10, y: 0 } });
        circuit.addWire({ id: 'W2', a: { x: 10, y: 0 }, b: { x: 20, y: 0 } });

        circuit.addObservationProbe({ id: 'P2', type: 'WireCurrentProbe', wireId: 'W2' });

        const result = circuit.compactWires();

        expect(result.changed).toBe(true);
        expect(result.replacementByRemovedId.W2).toBe('W1');
        expect(circuit.getObservationProbe('P2')?.wireId).toBe('W1');
    });

    it('drops probes for removed zero-length wires during compaction', () => {
        const circuit = new Circuit();
        circuit.addWire({ id: 'Wz', a: { x: 5, y: 5 }, b: { x: 5, y: 5 } });
        circuit.addObservationProbe({ id: 'Pz', type: 'NodeVoltageProbe', wireId: 'Wz' });

        circuit.compactWires();

        expect(circuit.getObservationProbe('Pz')).toBeUndefined();
    });

    it('round-trips probes via toJSON/fromJSON', () => {
        const circuit = new Circuit();
        circuit.addWire({ id: 'W1', a: { x: 0, y: 0 }, b: { x: 20, y: 0 } });
        circuit.addWire({ id: 'W2', a: { x: 0, y: 20 }, b: { x: 20, y: 20 } });
        circuit.addObservationProbe({ id: 'P1', type: 'NodeVoltageProbe', wireId: 'W1', label: '节点V' });
        circuit.addObservationProbe({ id: 'P2', type: 'WireCurrentProbe', wireId: 'W2', label: '支路I' });

        const json = circuit.toJSON();
        expect(Array.isArray(json.probes)).toBe(true);
        expect(json.probes).toHaveLength(2);

        const restored = new Circuit();
        restored.fromJSON(json);

        expect(restored.getAllObservationProbes()).toHaveLength(2);
        expect(restored.getObservationProbe('P1')?.wireId).toBe('W1');
        expect(restored.getObservationProbe('P2')?.type).toBe('WireCurrentProbe');
    });
});
