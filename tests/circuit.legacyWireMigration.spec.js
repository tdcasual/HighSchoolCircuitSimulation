import { describe, it, expect } from 'vitest';
import { Circuit } from '../src/engine/Circuit.js';
import { getTerminalWorldPosition } from '../src/utils/TerminalGeometry.js';

describe('Circuit legacy wire migration', () => {
    it('converts start/end + controlPoints to segmented v2 wires', () => {
        const circuit = new Circuit();
        circuit.fromJSON({
            components: [
                { id: 'V1', type: 'PowerSource', x: 100, y: 100, rotation: 0, properties: { voltage: 12, internalResistance: 1 } },
                { id: 'R1', type: 'Resistor', x: 300, y: 100, rotation: 0, properties: { resistance: 100 } }
            ],
            wires: [
                {
                    id: 'Wlegacy',
                    start: { componentId: 'V1', terminalIndex: 1 },
                    end: { componentId: 'R1', terminalIndex: 0 },
                    controlPoints: [{ x: 180, y: 120 }, { x: 220, y: 120 }]
                }
            ]
        });

        const w0 = circuit.getWire('Wlegacy');
        const w1 = circuit.getWire('Wlegacy_1');
        const w2 = circuit.getWire('Wlegacy_2');

        expect(w0).toBeTruthy();
        expect(w1).toBeTruthy();
        expect(w2).toBeTruthy();
        expect(circuit.getAllWires()).toHaveLength(3);

        const v1 = circuit.getComponent('V1');
        const r1 = circuit.getComponent('R1');
        const startPos = getTerminalWorldPosition(v1, 1);
        const endPos = getTerminalWorldPosition(r1, 0);

        expect(w0.a).toEqual(startPos);
        expect(w0.b).toEqual({ x: 180, y: 120 });
        expect(w1.a).toEqual({ x: 180, y: 120 });
        expect(w1.b).toEqual({ x: 220, y: 120 });
        expect(w2.a).toEqual({ x: 220, y: 120 });
        expect(w2.b).toEqual(endPos);

        expect(w0.aRef).toEqual({ componentId: 'V1', terminalIndex: 1 });
        expect(w2.bRef).toEqual({ componentId: 'R1', terminalIndex: 0 });
        expect(w1.aRef).toBeUndefined();
        expect(w1.bRef).toBeUndefined();

        const dumped = circuit.toJSON();
        expect(dumped.wires).toHaveLength(3);
        dumped.wires.forEach((wire) => {
            expect(wire.a).toBeTruthy();
            expect(wire.b).toBeTruthy();
            expect(wire.start).toBeUndefined();
            expect(wire.end).toBeUndefined();
            expect(wire.startComponentId).toBeUndefined();
            expect(wire.endComponentId).toBeUndefined();
            expect(wire.controlPoints).toBeUndefined();
        });
    });

    it('converts flat startComponentId/endComponentId schema', () => {
        const circuit = new Circuit();
        circuit.fromJSON({
            components: [
                { id: 'V1', type: 'PowerSource', x: 80, y: 80, rotation: 0, properties: { voltage: 9, internalResistance: 1 } },
                { id: 'R1', type: 'Resistor', x: 200, y: 80, rotation: 0, properties: { resistance: 50 } }
            ],
            wires: [
                {
                    id: 'Wflat',
                    startComponentId: 'V1',
                    startTerminalIndex: 1,
                    endComponentId: 'R1',
                    endTerminalIndex: 0
                }
            ]
        });

        const wire = circuit.getWire('Wflat');
        expect(wire).toBeTruthy();
        expect(circuit.getAllWires()).toHaveLength(1);
        expect(wire.aRef).toEqual({ componentId: 'V1', terminalIndex: 1 });
        expect(wire.bRef).toEqual({ componentId: 'R1', terminalIndex: 0 });
    });
});
