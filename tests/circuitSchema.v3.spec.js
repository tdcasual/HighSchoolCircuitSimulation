import { describe, expect, it } from 'vitest';
import { validateCircuitV3 } from '../src/v2/infra/io/CircuitSchemaV3.js';
import { CircuitDeserializerV3 } from '../src/v2/infra/io/CircuitDeserializerV3.js';

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
    it('accepts canonical schema v3 payload', () => {
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

        expect(() => validateCircuitV3(legacyTemplate)).toThrow(/templateName/u);
        expect(() => validateCircuitV3(legacyBinding)).toThrow(/bindingMap/u);
        expect(() => validateCircuitV3(legacyPendingTool)).toThrow(/pendingToolType/u);
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

        expect(() => validateCircuitV3(legacyWire)).toThrow(/wire\.a|wire\.b|start|end/u);
        expect(() => validateCircuitV3(withUnknown)).toThrow(/compatMode/u);
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

        expect(() => validateCircuitV3(badTypePayload)).toThrow(/unsupported component type|不支持的元器件类型/u);
    });

    it('rejects probe type outside supported probe set', () => {
        const badProbePayload = {
            ...validV3Payload,
            probes: [
                { id: 'P1', type: 'BadProbeType', wireId: 'W1' }
            ]
        };

        expect(() => validateCircuitV3(badProbePayload)).toThrow(/unsupported probe type|不支持的探针类型/u);
    });

    it('rejects probes that reference unknown wire ids', () => {
        const badProbeWirePayload = {
            ...validV3Payload,
            probes: [
                { id: 'P1', type: 'WireCurrentProbe', wireId: 'W404' }
            ]
        };

        expect(() => validateCircuitV3(badProbeWirePayload)).toThrow(/wireId.*not found|wireId.*不存在/u);
    });

    it('rejects duplicate component ids', () => {
        const duplicateComponentPayload = {
            ...validV3Payload,
            components: [
                { id: 'R1', type: 'Resistor', x: 0, y: 0 },
                { id: 'R1', type: 'Resistor', x: 10, y: 0 }
            ]
        };

        expect(() => validateCircuitV3(duplicateComponentPayload)).toThrow(/duplicate component id|组件 id 重复/u);
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

        expect(() => validateCircuitV3(duplicateWirePayload)).toThrow(/duplicate wire id|导线 id 重复/u);
    });

    it('rejects duplicate probe ids', () => {
        const duplicateProbePayload = {
            ...validV3Payload,
            probes: [
                { id: 'P1', type: 'WireCurrentProbe', wireId: 'W1' },
                { id: 'P1', type: 'NodeVoltageProbe', wireId: 'W1' }
            ]
        };

        expect(() => validateCircuitV3(duplicateProbePayload)).toThrow(/duplicate probe id|probe id 重复/u);
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

        expect(() => validateCircuitV3(badWirePayload)).toThrow(/wire endpoints overlap|导线起点与终点重合/u);
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

        expect(() => validateCircuitV3(badRefPayload)).toThrow(/componentId.*not found|componentId.*不存在/u);
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

        expect(() => validateCircuitV3(badTerminalIndexPayload)).toThrow(/terminalIndex.*out of range|terminalIndex.*超出范围/u);
    });
});
