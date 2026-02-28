import { describe, expect, it } from 'vitest';
import { Circuit } from '../src/engine/Circuit.js';
import { createComponent } from '../src/components/Component.js';
import { CircuitSerializer } from '../src/core/io/CircuitSerializer.js';
import { CircuitDeserializer } from '../src/core/io/CircuitDeserializer.js';
import { CircuitSchemaGateway } from '../src/core/io/CircuitSchemaGateway.js';
import { getClassroomScenarioPack } from '../src/core/scenarios/ClassroomScenarioPack.js';

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

    it('loads and runs all classroom scenario presets', () => {
        const scenarios = getClassroomScenarioPack();
        expect(scenarios).toHaveLength(6);

        for (const scenario of scenarios) {
            expect(() => CircuitSchemaGateway.validate(scenario.circuit)).not.toThrow();

            const loaded = CircuitDeserializer.deserialize(scenario.circuit);
            expect(loaded.components.length).toBeGreaterThan(0);
            expect(loaded.wires.length).toBeGreaterThan(0);

            const runtimeCircuit = new Circuit();
            runtimeCircuit.fromJSON(scenario.circuit);
            runtimeCircuit.dt = Number.isFinite(Number(scenario?.simulation?.dt))
                ? Number(scenario.simulation.dt)
                : 0.01;
            runtimeCircuit.simTime = 0;
            runtimeCircuit.isRunning = true;

            const steps = Number.isFinite(Number(scenario?.simulation?.steps))
                ? Math.max(1, Math.floor(Number(scenario.simulation.steps)))
                : 1;
            for (let i = 0; i < steps; i += 1) {
                runtimeCircuit.step();
                expect(runtimeCircuit.lastResults?.valid).toBe(
                    true,
                    `scenario ${scenario.id} became invalid at step ${i}`
                );
            }
            runtimeCircuit.isRunning = false;
        }
    });
});
