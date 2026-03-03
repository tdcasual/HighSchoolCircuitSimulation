import { describe, it, expect } from 'vitest';
import { validateCircuitJSON } from '../src/core/validation/CircuitSchema.js';
import { getClassroomScenarioPack } from '../src/core/scenarios/ClassroomScenarioPack.js';

const base = {
    meta: { version: 3 },
    components: [
        { id: 'E1', type: 'PowerSource', x: 0, y: 0, properties: { voltage: 3, internalResistance: 1 } },
        { id: 'R1', type: 'Resistor', x: 20, y: 0, properties: { resistance: 10 } }
    ],
    wires: [{
        id: 'w1',
        a: { x: 0, y: 0 },
        b: { x: 20, y: 0 },
        aRef: { componentId: 'E1', terminalIndex: 1 },
        bRef: { componentId: 'R1', terminalIndex: 0 }
    }]
};

describe('validateCircuitJSON', () => {
    it('accepts a minimal valid circuit', () => {
        expect(validateCircuitJSON(base)).toBe(true);
    });

    it('rejects non-v3 meta version', () => {
        expect(() => validateCircuitJSON({
            ...base,
            meta: { version: '1.0' }
        })).toThrow(/meta\.version.*3/u);
    });

    it('throws when components missing', () => {
        expect(() => validateCircuitJSON({ ...base, components: [] }))
            .toThrow(/组件列表缺失/);
    });

    it('throws when wires missing', () => {
        expect(() => validateCircuitJSON({ ...base, wires: [] }))
            .toThrow(/导线列表缺失/);
    });

    it('throws when a wire has no endpoints', () => {
        const bad = {
            ...base,
            wires: [{ id: 'w1' }]
        };
        expect(() => validateCircuitJSON(bad)).toThrow(/a\/b 端点坐标/);
    });

    it('rejects wire without id to avoid silent wire drop during deserialize', () => {
        const bad = {
            ...base,
            wires: [{
                a: { x: 0, y: 0 },
                b: { x: 20, y: 0 },
                aRef: { componentId: 'E1', terminalIndex: 1 },
                bRef: { componentId: 'R1', terminalIndex: 0 }
            }]
        };
        expect(() => validateCircuitJSON(bad)).toThrow(/导线缺少 id/);
    });

    it('throws when terminalIndex is missing in endpoint binding', () => {
        const bad = {
            ...base,
            wires: [{
                id: 'w1',
                a: { x: 0, y: 0 },
                b: { x: 20, y: 0 },
                aRef: { componentId: 'R1' }
            }]
        };
        expect(() => validateCircuitJSON(bad)).toThrow(/terminalIndex/);
    });

    it('rejects legacy start/end wire schema', () => {
        const legacy = {
            ...base,
            wires: [{
                id: 'w1',
                start: { componentId: 'R1', terminalIndex: 0 },
                end: { componentId: 'R1', terminalIndex: 1 }
            }]
        };
        expect(() => validateCircuitJSON(legacy)).toThrow(/a\/b 端点坐标|未知字段: start/);
    });

    it('rejects unknown component type', () => {
        const bad = {
            ...base,
            components: [{ id: 'X1', type: 'VoltageSource', x: 0, y: 0 }]
        };
        expect(() => validateCircuitJSON(bad)).toThrow(/不支持的元器件类型/);
    });

    it('rejects terminal index that exceeds component terminal count', () => {
        const bad = {
            ...base,
            components: [
                { id: 'E1', type: 'PowerSource', x: 0, y: 0, properties: { voltage: 3, internalResistance: 1 } },
                { id: 'R1', type: 'Resistor', x: 20, y: 0, properties: { resistance: 10 } }
            ],
            wires: [{
                id: 'w1',
                a: { x: 0, y: 0 },
                b: { x: 20, y: 0 },
                aRef: { componentId: 'R1', terminalIndex: 2 }
            }]
        };
        expect(() => validateCircuitJSON(bad)).toThrow(/terminalIndex 超出范围/);
    });

    it('rejects probe that references unknown wire id', () => {
        const bad = {
            ...base,
            probes: [
                { id: 'P1', type: 'WireCurrentProbe', wireId: 'missing_wire' }
            ]
        };
        expect(() => validateCircuitJSON(bad)).toThrow(/wireId 不存在/);
    });

    it('rejects unsupported probe types instead of silently dropping them', () => {
        const bad = {
            ...base,
            probes: [
                { id: 'P1', type: 'BadProbeType', wireId: 'w1' }
            ]
        };
        expect(() => validateCircuitJSON(bad)).toThrow(/不支持的探针类型/);
    });

    it('rejects circuit without power source', () => {
        const bad = {
            ...base,
            components: [{ id: 'R1', type: 'Resistor', x: 20, y: 0, properties: { resistance: 10 } }]
        };
        expect(() => validateCircuitJSON(bad)).toThrow(/至少需要一个电源元件/);
    });

    it('accepts all classroom scenario preset fixtures', () => {
        const scenarios = getClassroomScenarioPack();
        expect(scenarios).toHaveLength(6);

        const ids = scenarios.map((scenario) => scenario.id).sort();
        expect(ids).toEqual([
            'classroom-divider',
            'classroom-motor-feedback',
            'classroom-parallel',
            'classroom-probe-measurement',
            'classroom-rc-charge-discharge',
            'classroom-series'
        ]);

        for (const scenario of scenarios) {
            expect(Object.keys(scenario.circuit.meta || {}).sort()).toEqual([
                'name',
                'timestamp',
                'version'
            ]);
            expect(() => validateCircuitJSON(scenario.circuit)).not.toThrow();
        }
    });
});
