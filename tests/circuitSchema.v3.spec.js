import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CircuitSchemaGateway } from '../src/core/io/CircuitSchemaGateway.js';
import { validateCircuitV3 } from '../src/v2/infra/io/CircuitSchemaV3.js';
import { CircuitDeserializerV3 } from '../src/v2/infra/io/CircuitDeserializerV3.js';

function validate(payload) {
    return CircuitSchemaGateway.validate(payload);
}

const validV3Payload = {
    meta: {
        version: 3,
        name: 'v3-circuit',
        timestamp: 1760000000000
    },
    components: [
        {
            id: 'V1',
            type: 'PowerSource',
            x: 120,
            y: 120,
            rotation: 0,
            properties: {
                voltage: 3,
                internalResistance: 2
            }
        },
        {
            id: 'R1',
            type: 'Resistor',
            x: 320,
            y: 120,
            rotation: 0,
            properties: {
                resistance: 8
            }
        }
    ],
    wires: [
        {
            id: 'W1',
            a: { x: 140, y: 120 },
            b: { x: 300, y: 120 },
            aRef: { componentId: 'V1', terminalIndex: 0 },
            bRef: { componentId: 'R1', terminalIndex: 0 }
        }
    ],
    probes: []
};

describe('CircuitSchema v3 strict validator', () => {
    it('uses CircuitSchemaGateway as the schema source of truth', () => {
        const source = readFileSync(resolve(process.cwd(), 'src/v2/infra/io/CircuitSchemaV3.js'), 'utf8');
        expect(source).toContain('CircuitSchemaGateway');
        expect(source).not.toContain("new Set(['meta', 'components', 'wires', 'probes'])");
        expect(validate(validV3Payload)).toBe(true);
        expect(validateCircuitV3(validV3Payload)).toBe(true);
    });

    it('accepts canonical schema v3 payload', () => {
        expect(validate(validV3Payload)).toBe(true);
        expect(validateCircuitV3(validV3Payload)).toBe(true);
        const deserialized = CircuitDeserializerV3.deserialize(validV3Payload);
        expect(deserialized.meta.version).toBe(3);
        expect(deserialized.components).toHaveLength(2);
        expect(deserialized.wires).toHaveLength(1);
    });

    it('rejects legacy alias fields', () => {
        const legacyTemplate = { ...validV3Payload, templateName: 'legacy' };
        const legacyBinding = { ...validV3Payload, bindingMap: [] };
        const legacyPendingTool = { ...validV3Payload, pendingToolType: 'wire' };

        expect(() => validate(legacyTemplate)).toThrow(/templateName/u);
        expect(() => validate(legacyBinding)).toThrow(/bindingMap/u);
        expect(() => validate(legacyPendingTool)).toThrow(/pendingToolType/u);
    });

    it('rejects legacy wire aliases and unknown top-level keys', () => {
        const legacyWire = {
            ...validV3Payload,
            wires: [{
                id: 'W1',
                start: { componentId: 'V1', terminalIndex: 0 },
                end: { componentId: 'R1', terminalIndex: 0 }
            }]
        };
        const withUnknown = {
            ...validV3Payload,
            compatMode: true
        };

        expect(() => validate(legacyWire)).toThrow(/wire\.a|wire\.b|start|end/u);
        expect(() => validate(withUnknown)).toThrow(/compatMode/u);
    });

    it('rejects unknown component types', () => {
        const badTypePayload = {
            ...validV3Payload,
            components: [
                {
                    id: 'X1',
                    type: 'FakeComponentType',
                    x: 0,
                    y: 0
                }
            ]
        };

        expect(() => validate(badTypePayload)).toThrow(/unsupported component type|不支持的元器件类型/u);
    });

    it('rejects probe type outside supported probe set', () => {
        const badProbePayload = {
            ...validV3Payload,
            probes: [
                { id: 'P1', type: 'BadProbeType', wireId: 'W1' }
            ]
        };

        expect(() => validate(badProbePayload)).toThrow(/unsupported probe type|不支持的探针类型/u);
    });

    it('rejects probes that reference unknown wire ids', () => {
        const badProbeWirePayload = {
            ...validV3Payload,
            probes: [
                { id: 'P1', type: 'WireCurrentProbe', wireId: 'W404' }
            ]
        };

        expect(() => validate(badProbeWirePayload)).toThrow(/wireId.*not found|wireId.*不存在/u);
    });

    it('rejects duplicate component ids', () => {
        const duplicateComponentPayload = {
            ...validV3Payload,
            components: [
                { id: 'R1', type: 'Resistor', x: 0, y: 0 },
                { id: 'R1', type: 'Resistor', x: 10, y: 0 }
            ]
        };

        expect(() => validate(duplicateComponentPayload)).toThrow(/duplicate component id|组件 id 重复/u);
    });

    it('rejects duplicate wire ids', () => {
        const duplicateWirePayload = {
            ...validV3Payload,
            wires: [
                {
                    id: 'W1',
                    a: { x: 0, y: 0 },
                    b: { x: 10, y: 0 }
                },
                {
                    id: 'W1',
                    a: { x: 20, y: 0 },
                    b: { x: 30, y: 0 }
                }
            ]
        };

        expect(() => validate(duplicateWirePayload)).toThrow(/duplicate wire id|导线 id 重复/u);
    });

    it('rejects duplicate probe ids', () => {
        const duplicateProbePayload = {
            ...validV3Payload,
            probes: [
                { id: 'P1', type: 'WireCurrentProbe', wireId: 'W1' },
                { id: 'P1', type: 'NodeVoltageProbe', wireId: 'W1' }
            ]
        };

        expect(() => validate(duplicateProbePayload)).toThrow(/duplicate probe id|probe id 重复/u);
    });

    it('rejects zero-length wires (same start/end point)', () => {
        const badWirePayload = {
            ...validV3Payload,
            wires: [
                {
                    id: 'W1',
                    a: { x: 120, y: 120 },
                    b: { x: 120, y: 120 }
                }
            ]
        };

        expect(() => validate(badWirePayload)).toThrow(/wire endpoints overlap|导线起点与终点重合/u);
    });

    it('rejects wire terminal refs pointing to unknown components', () => {
        const badRefPayload = {
            ...validV3Payload,
            wires: [
                {
                    id: 'W1',
                    a: { x: 140, y: 120 },
                    b: { x: 300, y: 120 },
                    aRef: { componentId: 'NOT_EXISTS', terminalIndex: 0 },
                    bRef: { componentId: 'R1', terminalIndex: 0 }
                }
            ]
        };

        expect(() => validate(badRefPayload)).toThrow(/componentId.*not found|componentId.*不存在/u);
    });

    it('rejects legacy meta.version even when allowLegacyMigration is requested', () => {
        const legacyPayload = {
            ...validV3Payload,
            meta: {
                ...validV3Payload.meta,
                version: '1.0'
            }
        };

        expect(() => CircuitDeserializerV3.deserialize(legacyPayload)).toThrow(/meta\.version/u);
        expect(() => CircuitDeserializerV3.deserialize(legacyPayload, {
            allowLegacyMigration: true
        })).toThrow(/meta\.version/u);
        expect(() => validate(legacyPayload)).toThrow(/meta\.version/u);
    });

    it('rejects wire terminal refs with out-of-range terminalIndex', () => {
        const badTerminalIndexPayload = {
            ...validV3Payload,
            wires: [
                {
                    id: 'W1',
                    a: { x: 140, y: 120 },
                    b: { x: 300, y: 120 },
                    aRef: { componentId: 'V1', terminalIndex: 99 },
                    bRef: { componentId: 'R1', terminalIndex: 0 }
                }
            ]
        };

        expect(() => validate(badTerminalIndexPayload)).toThrow(/terminalIndex.*out of range|terminalIndex.*超出范围/u);
    });
});
