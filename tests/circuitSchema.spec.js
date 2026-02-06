import { describe, it, expect } from 'vitest';
import { validateCircuitJSON } from '../src/utils/circuitSchema.js';

const base = {
    meta: { version: '1.0' },
    components: [{ id: 'R1', type: 'Resistor', properties: { resistance: 10 } }],
    wires: [{
        id: 'w1',
        a: { x: 0, y: 0 },
        b: { x: 20, y: 0 }
    }]
};

describe('validateCircuitJSON', () => {
    it('accepts a minimal valid circuit', () => {
        expect(validateCircuitJSON(base)).toBe(true);
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
        expect(() => validateCircuitJSON(legacy)).toThrow(/a\/b 端点坐标/);
    });
});
