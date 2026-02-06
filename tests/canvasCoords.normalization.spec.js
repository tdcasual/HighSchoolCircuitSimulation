import { describe, expect, it } from 'vitest';
import { Circuit } from '../src/engine/Circuit.js';
import { createComponent } from '../src/components/Component.js';
import { normalizeCanvasPoint, pointKey, snapToGrid, toCanvasInt } from '../src/utils/CanvasCoords.js';

describe('Canvas coordinate normalization', () => {
    it('normalizes scalar and point helpers consistently', () => {
        expect(toCanvasInt(10.49)).toBe(10);
        expect(toCanvasInt(10.5)).toBe(11);
        expect(snapToGrid(39.1)).toBe(40);
        expect(normalizeCanvasPoint({ x: 1.4, y: 2.6 })).toEqual({ x: 1, y: 3 });
        expect(pointKey({ x: 10, y: 20 })).toBe('10,20');
        expect(pointKey({ x: 10.2, y: 20 })).toBeNull();
    });

    it('normalizes component and wire coordinates when added to circuit', () => {
        const circuit = new Circuit();
        const resistor = createComponent('Resistor', 120.3, 220.7, 'R1');
        circuit.addComponent(resistor);

        expect(circuit.getComponent('R1').x).toBe(120);
        expect(circuit.getComponent('R1').y).toBe(221);

        const wire = {
            id: 'W1',
            a: { x: 90.2, y: 220.6 },
            b: { x: 150.8, y: 219.7 }
        };
        circuit.addWire(wire);

        const storedWire = circuit.getWire('W1');
        expect(storedWire.a).toEqual({ x: 90, y: 221 });
        expect(storedWire.b).toEqual({ x: 151, y: 220 });
        // addWire mutates the caller object so renderer and engine stay consistent.
        expect(wire.a).toEqual({ x: 90, y: 221 });
        expect(wire.b).toEqual({ x: 151, y: 220 });
    });

    it('normalizes imported/exported JSON coordinates', () => {
        const circuit = new Circuit();
        circuit.fromJSON({
            components: [
                {
                    id: 'V1',
                    type: 'PowerSource',
                    x: 100.6,
                    y: 299.4,
                    rotation: 0,
                    properties: {
                        voltage: 12,
                        internalResistance: 0.5
                    }
                }
            ],
            wires: [
                {
                    id: 'Wjson',
                    a: { x: 70.2, y: 299.6 },
                    b: { x: 130.8, y: 299.2 }
                }
            ]
        });

        const comp = circuit.getComponent('V1');
        const wire = circuit.getWire('Wjson');
        expect(comp.x).toBe(101);
        expect(comp.y).toBe(299);
        expect(wire.a).toEqual({ x: 70, y: 300 });
        expect(wire.b).toEqual({ x: 131, y: 299 });

        const dumped = circuit.toJSON();
        expect(dumped.components[0].x).toBe(101);
        expect(dumped.components[0].y).toBe(299);
        expect(dumped.wires[0].a).toEqual({ x: 70, y: 300 });
        expect(dumped.wires[0].b).toEqual({ x: 131, y: 299 });
    });
});
