import { describe, it, expect } from 'vitest';
import { createTestCircuit, addComponent, connectWire, solveCircuit } from './helpers/circuitTestUtils.js';

describe('BlackBox component', () => {
    it('serializes and restores viewMode/size', () => {
        const circuit = createTestCircuit();
        addComponent(circuit, 'BlackBox', 'B1', { boxWidth: 240, boxHeight: 160, viewMode: 'opaque' });

        const json = circuit.toJSON();
        const boxJson = json.components.find((c) => c.id === 'B1');
        expect(boxJson).toBeTruthy();
        expect(boxJson.type).toBe('BlackBox');
        expect(boxJson.properties.boxWidth).toBe(240);
        expect(boxJson.properties.boxHeight).toBe(160);
        expect(boxJson.properties.viewMode).toBe('opaque');

        const restored = createTestCircuit();
        restored.fromJSON(json);
        const restoredBox = restored.getComponent('B1');
        expect(restoredBox).toBeTruthy();
        expect(restoredBox.boxWidth).toBe(240);
        expect(restoredBox.boxHeight).toBe(160);
        expect(restoredBox.viewMode).toBe('opaque');
    });

    it('does not interfere with circuit solving when used as a container', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 10, internalResistance: 0 });
        const box = addComponent(circuit, 'BlackBox', 'B1', { boxWidth: 200, boxHeight: 120, viewMode: 'opaque' });
        const rInside = addComponent(circuit, 'Resistor', 'Rin', { resistance: 10, x: 0, y: 0 });

        // external: source across black box ports
        connectWire(circuit, 'Wext1', source, 0, box, 0);
        connectWire(circuit, 'Wext2', box, 1, source, 1);

        // internal: resistor bridges the two ports
        connectWire(circuit, 'Win1', box, 0, rInside, 0);
        connectWire(circuit, 'Win2', rInside, 1, box, 1);

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);
        expect(results.currents.get('Rin')).toBeCloseTo(1, 6);
    });
});
