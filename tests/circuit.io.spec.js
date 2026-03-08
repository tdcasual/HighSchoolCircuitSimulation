import { describe, expect, it } from 'vitest';
import { Circuit } from '../src/core/runtime/Circuit.js';
import { createComponent } from '../src/components/Component.js';
import { CircuitSerializer } from '../src/core/io/CircuitSerializer.js';
import { CircuitDeserializer } from '../src/core/io/CircuitDeserializer.js';
import { CircuitSchemaGateway } from '../src/core/io/CircuitSchemaGateway.js';
import { getClassroomScenarioPack } from '../src/core/scenarios/ClassroomScenarioPack.js';

describe('Circuit IO gateway', () => {
    it('round-trips an empty circuit without schema rejection', () => {
        const circuit = new Circuit();
        const empty = circuit.toJSON();

        const restored = new Circuit();
        expect(() => restored.fromJSON(empty)).not.toThrow();
        expect(restored.components.size).toBe(0);
        expect(restored.wires.size).toBe(0);
    });

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

    it('rejects malformed runtime-critical numeric properties on deserialize instead of silently sanitizing', () => {
        const json = {
            meta: {
                version: 3,
                name: 'sanitize-case',
                timestamp: 1760000000000
            },
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
            wires: [{
                id: 'W1',
                a: { x: 0, y: 0 },
                b: { x: 120, y: 0 },
                aRef: { componentId: 'V1', terminalIndex: 0 },
                bRef: { componentId: 'M1', terminalIndex: 0 }
            }]
        };

        expect(() => CircuitDeserializer.deserialize(json)).toThrow(/internalResistance|resistance|inertia/u);
    });

    it('rejects non-v3 payloads during deserialize', () => {
        const legacy = {
            meta: {
                version: '1.0'
            },
            components: [
                { id: 'V1', type: 'PowerSource', x: 0, y: 0, properties: { voltage: 3 } },
                { id: 'R1', type: 'Resistor', x: 100, y: 0, properties: { resistance: 8 } }
            ],
            wires: [{
                id: 'W1',
                a: { x: 0, y: 0 },
                b: { x: 100, y: 0 },
                aRef: { componentId: 'V1', terminalIndex: 0 },
                bRef: { componentId: 'R1', terminalIndex: 0 }
            }]
        };

        expect(() => CircuitDeserializer.deserialize(legacy)).toThrow(/meta\.version.*3/u);
    });

    it('does not allow component properties to override top-level id/type during deserialize', () => {
        const payload = {
            meta: {
                version: 3,
                name: 'override-guard',
                timestamp: 1760000000000
            },
            components: [
                {
                    id: 'V1',
                    type: 'PowerSource',
                    x: 0,
                    y: 0,
                    properties: {
                        id: 'V_HIJACK',
                        type: 'Resistor',
                        x: 999,
                        voltage: 6,
                        internalResistance: 2
                    }
                },
                {
                    id: 'R1',
                    type: 'Resistor',
                    x: 100,
                    y: 0,
                    properties: {
                        resistance: 8
                    }
                }
            ],
            wires: [{
                id: 'W1',
                a: { x: 0, y: 0 },
                b: { x: 100, y: 0 },
                aRef: { componentId: 'V1', terminalIndex: 0 },
                bRef: { componentId: 'R1', terminalIndex: 0 }
            }]
        };

        const loaded = CircuitDeserializer.deserialize(payload);
        const ids = loaded.components.map((component) => component.id);

        expect(ids).toContain('V1');
        expect(ids).not.toContain('V_HIJACK');
        expect(loaded.components.find((component) => component.id === 'V1')?.type).toBe('PowerSource');
        expect(loaded.components.find((component) => component.id === 'V1')?.x).toBe(0);
    });

    it('keeps probes when payload uses numeric wire ids by normalizing wire ids to strings', () => {
        const payload = {
            meta: {
                version: 3,
                name: 'numeric-wire-id',
                timestamp: 1760000000000
            },
            components: [
                {
                    id: 'V1',
                    type: 'PowerSource',
                    x: 0,
                    y: 0,
                    properties: { voltage: 3, internalResistance: 1 }
                },
                {
                    id: 'R1',
                    type: 'Resistor',
                    x: 100,
                    y: 0,
                    properties: { resistance: 8 }
                }
            ],
            wires: [{
                id: 1,
                a: { x: 0, y: 0 },
                b: { x: 100, y: 0 },
                aRef: { componentId: 'V1', terminalIndex: 0 },
                bRef: { componentId: 'R1', terminalIndex: 0 }
            }],
            probes: [{
                id: 'P1',
                type: 'WireCurrentProbe',
                wireId: '1'
            }]
        };

        const loaded = CircuitDeserializer.deserialize(payload);

        expect(loaded.wires[0]?.id).toBe('1');
        expect(loaded.probes).toHaveLength(1);
        expect(loaded.probes[0]).toMatchObject({
            id: 'P1',
            wireId: '1'
        });
    });

    it('does not drop wire/probe when payload uses wire id 0', () => {
        const payload = {
            meta: {
                version: 3,
                name: 'wire-id-zero',
                timestamp: 1760000000000
            },
            components: [
                {
                    id: 'V1',
                    type: 'PowerSource',
                    x: 0,
                    y: 0,
                    properties: { voltage: 3, internalResistance: 1 }
                },
                {
                    id: 'R1',
                    type: 'Resistor',
                    x: 100,
                    y: 0,
                    properties: { resistance: 8 }
                }
            ],
            wires: [{
                id: 0,
                a: { x: 0, y: 0 },
                b: { x: 100, y: 0 },
                aRef: { componentId: 'V1', terminalIndex: 0 },
                bRef: { componentId: 'R1', terminalIndex: 0 }
            }],
            probes: [{
                id: 'P0',
                type: 'WireCurrentProbe',
                wireId: '0'
            }]
        };

        const loaded = CircuitDeserializer.deserialize(payload);

        expect(loaded.wires).toHaveLength(1);
        expect(loaded.wires[0]?.id).toBe('0');
        expect(loaded.probes).toHaveLength(1);
        expect(loaded.probes[0]?.wireId).toBe('0');
    });

    it('accepts numeric zero component/probe ids and normalizes them to strings', () => {
        const payload = {
            meta: {
                version: 3,
                name: 'component-probe-zero-id',
                timestamp: 1760000000000
            },
            components: [
                {
                    id: 0,
                    type: 'PowerSource',
                    x: 0,
                    y: 0,
                    properties: { voltage: 3, internalResistance: 1 }
                },
                {
                    id: 'R1',
                    type: 'Resistor',
                    x: 100,
                    y: 0,
                    properties: { resistance: 8 }
                }
            ],
            wires: [{
                id: 'W1',
                a: { x: 0, y: 0 },
                b: { x: 100, y: 0 },
                aRef: { componentId: 0, terminalIndex: 0 },
                bRef: { componentId: 'R1', terminalIndex: 0 }
            }],
            probes: [{
                id: 0,
                type: 'WireCurrentProbe',
                wireId: 'W1'
            }]
        };

        const loaded = CircuitDeserializer.deserialize(payload);

        expect(loaded.components.find((component) => component.id === '0')).toBeTruthy();
        expect(loaded.probes[0]).toMatchObject({
            id: '0',
            wireId: 'W1'
        });
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
