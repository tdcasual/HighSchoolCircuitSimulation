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

    it('sanitizes malformed runtime-critical numeric properties on deserialize', () => {
        const json = {
            components: [
                {
                    id: 'V1',
                    type: 'PowerSource',
                    x: 0,
                    y: 0,
                    properties: {
                        voltage: 6,
                        internalResistance: 'bad'
                    }
                },
                {
                    id: 'M1',
                    type: 'Motor',
                    x: 100,
                    y: 0,
                    properties: {
                        resistance: 0,
                        inertia: 0
                    }
                },
                {
                    id: 'A1',
                    type: 'Ammeter',
                    x: 200,
                    y: 0,
                    properties: {
                        resistance: 'oops'
                    }
                }
            ],
            wires: []
        };

        const loaded = CircuitDeserializer.deserialize(json);
        const source = loaded.components.find((comp) => comp.id === 'V1');
        const motor = loaded.components.find((comp) => comp.id === 'M1');
        const ammeter = loaded.components.find((comp) => comp.id === 'A1');

        expect(Number.isFinite(source.internalResistance)).toBe(true);
        expect(source.internalResistance).toBeGreaterThan(0);
        expect(motor.resistance).toBeGreaterThan(0);
        expect(motor.inertia).toBeGreaterThan(0);
        expect(Number.isFinite(ammeter.resistance)).toBe(true);
        expect(ammeter.resistance).toBeGreaterThanOrEqual(0);
    });
});
