import { describe, expect, it } from 'vitest';
import { MNASolver } from '../src/engine/Solver.js';
import { ResultPostprocessor } from '../src/core/simulation/ResultPostprocessor.js';
import { DefaultComponentRegistry } from '../src/core/simulation/ComponentRegistry.js';

describe('Registry fallback behavior', () => {
    it('falls back to DefaultComponentRegistry stamp handler when custom registry misses type', () => {
        const solver = new MNASolver();
        solver.componentRegistry = {
            get: () => null
        };

        const originalGet = DefaultComponentRegistry.get;
        let defaultLookupCount = 0;
        DefaultComponentRegistry.get = function patchedGet(type) {
            defaultLookupCount += 1;
            return originalGet.call(this, type);
        };

        try {
            const A = [[0]];
            const z = [0];
            solver.stampComponent({
                id: 'R1',
                type: 'Resistor',
                nodes: [1, 0],
                resistance: 10,
                _isShorted: false
            }, A, z, 2);

            expect(defaultLookupCount).toBeGreaterThan(0);
            expect(A[0][0]).toBeCloseTo(0.1, 12);
        } finally {
            DefaultComponentRegistry.get = originalGet;
        }
    });

    it('falls back to DefaultComponentRegistry current handler when custom registry misses type', () => {
        const postprocessor = new ResultPostprocessor();
        const customRegistry = {
            get: () => null
        };

        const originalGet = DefaultComponentRegistry.get;
        let defaultLookupCount = 0;
        DefaultComponentRegistry.get = function patchedGet(type) {
            defaultLookupCount += 1;
            return originalGet.call(this, type);
        };

        try {
            const current = postprocessor.calculateCurrent({
                id: 'R1',
                type: 'Resistor',
                nodes: [1, 0],
                resistance: 10,
                _isShorted: false
            }, {
                voltages: [0, 10],
                x: [],
                nodeCount: 2,
                registry: customRegistry
            });

            expect(defaultLookupCount).toBeGreaterThan(0);
            expect(current).toBeCloseTo(1, 12);
        } finally {
            DefaultComponentRegistry.get = originalGet;
        }
    });

    it('falls back to DefaultComponentRegistry stamp handler when custom handler lacks stamp()', () => {
        const solver = new MNASolver();
        solver.componentRegistry = {
            get: (type) => (type === 'Resistor' ? { current: () => 0 } : null)
        };

        const A = [[0]];
        const z = [0];
        solver.stampComponent({
            id: 'R1',
            type: 'Resistor',
            nodes: [1, 0],
            resistance: 10,
            _isShorted: false
        }, A, z, 2);

        expect(A[0][0]).toBeCloseTo(0.1, 12);
    });

    it('falls back to DefaultComponentRegistry current handler when custom handler lacks current()', () => {
        const postprocessor = new ResultPostprocessor();
        const customRegistry = {
            get: (type) => (type === 'Resistor' ? { stamp: () => {} } : null)
        };

        const current = postprocessor.calculateCurrent({
            id: 'R1',
            type: 'Resistor',
            nodes: [1, 0],
            resistance: 10,
            _isShorted: false
        }, {
            voltages: [0, 10],
            x: [],
            nodeCount: 2,
            registry: customRegistry
        });

        expect(current).toBeCloseTo(1, 12);
    });

    it('treats unknown component type as no-op during stamping', () => {
        const solver = new MNASolver();
        const A = [[0]];
        const z = [0];

        solver.stampComponent({
            id: 'X1',
            type: 'UnknownType',
            nodes: [1, 0],
            _isShorted: false
        }, A, z, 2);

        expect(A[0][0]).toBe(0);
        expect(z[0]).toBe(0);
    });

    it('returns 0A for unknown component type without current handler', () => {
        const postprocessor = new ResultPostprocessor();
        const current = postprocessor.calculateCurrent({
            id: 'X1',
            type: 'UnknownType',
            nodes: [1, 0]
        }, {
            voltages: [0, 10],
            x: [],
            nodeCount: 2,
            registry: {
                get: () => null
            }
        });

        expect(current).toBe(0);
    });
});
