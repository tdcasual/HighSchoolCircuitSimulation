import { describe, it, expect } from 'vitest';
import { CircuitJsonNormalizationSkill } from '../src/ai/skills/CircuitJsonNormalizationSkill.js';

describe('CircuitJsonNormalizationSkill', () => {
    it('converts legacy start/end wires into v2 a/b segments', () => {
        const payload = {
            components: [
                {
                    id: 'PowerSource_1',
                    type: 'PowerSource',
                    x: 120,
                    y: 160,
                    rotation: 270,
                    properties: { voltage: 3, internalResistance: 1 }
                },
                {
                    id: 'Resistor_1',
                    type: 'Resistor',
                    x: 260,
                    y: 160,
                    resistance: 8
                }
            ],
            wires: [
                {
                    id: 'wire_legacy',
                    start: { componentId: 'PowerSource_1', terminalIndex: 1 },
                    end: { componentId: 'Resistor_1', terminalIndex: 0 },
                    controlPoints: [{ x: 200, y: 120 }]
                }
            ]
        };

        const rawText = `\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``;
        const normalized = CircuitJsonNormalizationSkill.run({ rawText });

        expect(normalized.components).toHaveLength(2);
        expect(normalized.components[1].properties.resistance).toBe(8);
        expect(normalized.wires).toHaveLength(2);
        expect(normalized.wires[0].aRef).toEqual({ componentId: 'PowerSource_1', terminalIndex: 1 });
        expect(normalized.wires[1].bRef).toEqual({ componentId: 'Resistor_1', terminalIndex: 0 });
        expect(normalized.wires[0].a).toHaveProperty('x');
        expect(normalized.wires[1].b).toHaveProperty('y');
    });

    it('repairs trailing commas and auto-fills component ids/labels', () => {
        const rawText = `{
            "components": [
                { "type": "Resistor", "x": 20, "y": 40, "properties": { "resistance": 10 }, },
            ],
            "wires": [
                { "id": "wire_1", "a": { "x": 0, "y": 0 }, "b": { "x": 20, "y": 0 }, },
            ],
        }`;

        const normalized = CircuitJsonNormalizationSkill.run({ rawText });
        expect(normalized.components).toHaveLength(1);
        expect(normalized.components[0].id).toMatch(/^Resistor_/);
        expect(normalized.components[0].label).toMatch(/^R\d+$/);
        expect(normalized.wires).toHaveLength(1);
        expect(normalized.wires[0].a).toEqual({ x: 0, y: 0 });
        expect(normalized.wires[0].b).toEqual({ x: 20, y: 0 });
    });

    it('maps common alias types and auto-binds nearby wire endpoints to terminal refs', () => {
        const payload = {
            components: [
                {
                    id: 'VoltageSource_1',
                    type: 'VoltageSource',
                    x: 100,
                    y: 100,
                    rotation: 270,
                    properties: { voltage: 3 }
                },
                {
                    id: 'Lamp_1',
                    type: 'Lamp',
                    x: 220,
                    y: 100,
                    properties: { resistance: 12 }
                }
            ],
            wires: [
                {
                    id: 'w1',
                    a: { x: 99, y: 71 },
                    b: { x: 190, y: 100 }
                }
            ]
        };

        const normalized = CircuitJsonNormalizationSkill.run({ rawText: payload });
        expect(normalized.components[0].type).toBe('PowerSource');
        expect(normalized.components[1].type).toBe('Bulb');
        expect(normalized.wires[0].aRef).toEqual({
            componentId: 'VoltageSource_1',
            terminalIndex: 1
        });
        expect(normalized.wires[0].bRef).toEqual({
            componentId: 'Lamp_1',
            terminalIndex: 0
        });
    });
});
