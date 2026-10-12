import { describe, expect, it } from 'vitest';
import { Circuit } from '../src/core/runtime/Circuit.js';
import { createComponent } from '../src/components/Component.js';
import { CircuitSerializer } from '../src/core/io/CircuitSerializer.js';
import { CircuitDeserializer } from '../src/core/io/CircuitDeserializer.js';
import { CircuitSchemaGateway } from '../src/core/io/CircuitSchemaGateway.js';
import { getClassroomScenarioPack } from '../src/core/scenarios/ClassroomScenarioPack.js';
import { createInjectedSolverBackend } from '../src/v2/app/createInjectedSolverBackend.js';

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
            runtimeCircuit.solverBackend = createInjectedSolverBackend();
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

    it('fromJSON of invalid payload does not empty a 2-component circuit', () => {
        const circuit = new Circuit();
        circuit.addComponent(createComponent('PowerSource', 0, 0, 'V1'));
        circuit.addComponent(createComponent('Resistor', 100, 0, 'R1'));
        circuit.isRunning = true;

        expect(() => circuit.fromJSON({ components: [], wires: [] })).toThrow();
        expect(circuit.components.size).toBe(2);
        expect(circuit.components.has('V1')).toBe(true);
        expect(circuit.components.has('R1')).toBe(true);
        expect(circuit.isRunning).toBe(true);
    });

    it('fromJSON of an app envelope throws without clearing the live circuit', () => {
        const circuit = new Circuit();
        circuit.addComponent(createComponent('Resistor', 0, 0, 'Rkeep'));
        circuit.addComponent(createComponent('Resistor', 40, 0, 'R2'));

        expect(() => circuit.fromJSON({
            format: 'hscs-app',
            formatVersion: 1,
            circuit: {
                meta: { version: 3, name: 'empty' },
                components: [],
                wires: []
            },
            ui: { exerciseBoard: { markdown: 'x' } }
        })).toThrow(/未知字段|format/);
        expect(circuit.components.size).toBe(2);
        expect(circuit.components.has('Rkeep')).toBe(true);
    });

    it('ideal voltmeter resistance survives JSON.stringify as Infinity sentinel', () => {
        const circuit = new Circuit();
        const voltmeter = createComponent('Voltmeter', 0, 0, 'VM1');
        voltmeter.resistance = Infinity;
        circuit.addComponent(voltmeter);

        const json = circuit.toJSON();
        const dumped = json.components.find((component) => component.id === 'VM1')?.properties?.resistance;
        expect(dumped).toBe('Infinity');
        const serialized = JSON.stringify(json);
        expect(serialized).toContain('"Infinity"');
        expect(JSON.parse(serialized).components.find((component) => component.id === 'VM1').properties.resistance)
            .toBe('Infinity');

        const restored = new Circuit();
        restored.fromJSON(JSON.parse(serialized));
        expect(restored.getComponent('VM1').resistance).toBe(Infinity);
    });

    it('removeComponent drops referenced wires and leaves unreferenced segments', () => {
        const circuit = new Circuit();
        circuit.addComponent(createComponent('PowerSource', 0, 0, 'V1'));
        circuit.addComponent(createComponent('Resistor', 100, 0, 'R1'));
        circuit.addWire({
            id: 'W1',
            a: { x: 0, y: 0 },
            b: { x: 100, y: 0 },
            aRef: { componentId: 'V1', terminalIndex: 1 },
            bRef: { componentId: 'R1', terminalIndex: 0 }
        });
        circuit.addWire({
            id: 'Wloose',
            a: { x: 10, y: 40 },
            b: { x: 80, y: 40 }
        });

        circuit.removeComponent('R1');
        expect(circuit.wires.has('W1')).toBe(false);
        expect(circuit.wires.has('Wloose')).toBe(true);

        const payload = circuit.toJSON();
        expect(() => CircuitSchemaGateway.validate(payload)).not.toThrow();
        expect(payload.wires.find((wire) => wire.id === 'W1')).toBeUndefined();
        expect(payload.wires.find((wire) => wire.id === 'Wloose')).toBeTruthy();
    });

    it('omitted integrationMethod stays auto', () => {
        const loaded = CircuitDeserializer.deserialize({
            meta: { version: 3, name: 'cap-auto' },
            components: [{
                id: 'C1',
                type: 'Capacitor',
                x: 0,
                y: 0,
                properties: { capacitance: 0.001 }
            }],
            wires: []
        });
        expect(loaded.components[0].integrationMethod).toBe('auto');
    });

    it('explicit backward-euler is preserved', () => {
        const loaded = CircuitDeserializer.deserialize({
            meta: { version: 3, name: 'cap-be' },
            components: [{
                id: 'C1',
                type: 'Capacitor',
                x: 0,
                y: 0,
                properties: {
                    capacitance: 0.001,
                    integrationMethod: 'backward-euler'
                }
            }],
            wires: []
        });
        expect(loaded.components[0].integrationMethod).toBe('backward-euler');
    });

    it('replaceLoadedCircuit drops reused-id dynamic fields from the previous circuit', () => {
        const circuit = new Circuit();
        const motor = createComponent('Motor', 0, 0, 'M1');
        motor.backEmf = 9;
        motor.speed = 12;
        motor.prevVoltage = 4;
        circuit.addComponent(motor);

        circuit.fromJSON({
            meta: { version: 3, name: 'reuse' },
            components: [{
                id: 'M1',
                type: 'Motor',
                x: 0,
                y: 0,
                properties: { resistance: 5 }
            }],
            wires: []
        });

        const loaded = circuit.getComponent('M1');
        expect(loaded).not.toBe(motor);
        expect(loaded.backEmf === undefined || loaded.backEmf === 0).toBe(true);
        expect(loaded.speed === undefined || loaded.speed === 0).toBe(true);
    });
});
