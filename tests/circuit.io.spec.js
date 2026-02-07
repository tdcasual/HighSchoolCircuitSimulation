import { describe, expect, it } from 'vitest';
import { Circuit } from '../src/engine/Circuit.js';
import { createComponent } from '../src/components/Component.js';
import { CircuitSerializer } from '../src/core/io/CircuitSerializer.js';
import { CircuitDeserializer } from '../src/core/io/CircuitDeserializer.js';
import { CircuitSchemaGateway } from '../src/core/io/CircuitSchemaGateway.js';

describe('Circuit IO gateway', () => {
    it('serializes and deserializes circuit with stable schema', () => {
        const circuit = new Circuit();
        const source = createComponent('PowerSource', 100, 100, 'V1');
        source.voltage = 3;
        source.internalResistance = 2;
        const resistor = createComponent('Resistor', 220, 100, 'R1');
        resistor.resistance = 8;

        circuit.addComponent(source);
        circuit.addComponent(resistor);
        circuit.addWire({
            id: 'W1',
            a: { x: 130, y: 100 },
            b: { x: 190, y: 100 },
            aRef: { componentId: 'V1', terminalIndex: 1 },
            bRef: { componentId: 'R1', terminalIndex: 0 }
        });
        circuit.addWire({
            id: 'W2',
            a: { x: 70, y: 100 },
            b: { x: 250, y: 100 },
            aRef: { componentId: 'V1', terminalIndex: 0 },
            bRef: { componentId: 'R1', terminalIndex: 1 }
        });

        const json = CircuitSerializer.serialize(circuit);
        expect(() => CircuitSchemaGateway.validate(json)).not.toThrow();

        const loaded = CircuitDeserializer.deserialize(json);
        expect(loaded.components.length).toBeGreaterThan(0);
        expect(loaded.wires.length).toBeGreaterThan(0);
    });
});
