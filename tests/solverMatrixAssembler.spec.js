import { describe, expect, it, vi } from 'vitest';
import { SolverMatrixAssembler } from '../src/core/simulation/SolverMatrixAssembler.js';

describe('SolverMatrixAssembler', () => {
    it('prepares voltage-source indexing and switch state independently from MNASolver', () => {
        const assembler = new SolverMatrixAssembler();
        const logger = { warn: vi.fn() };
        const source = { id: 'V1', type: 'PowerSource', nodes: [1, 0], voltage: 9, internalResistance: 0 };
        const ammeter = { id: 'A1', type: 'Ammeter', nodes: [2, 0], resistance: 0 };
        const sw = { id: 'S1', type: 'Switch', nodes: [1, 2], closed: false };

        const prepared = assembler.prepareComponents({
            components: [source, ammeter, sw],
            logger
        });

        expect(prepared.voltageSourceCount).toBe(2);
        expect(prepared.shortCircuitDetected).toBe(false);
        expect(prepared.hasConnectedSwitch).toBe(true);
        expect(source.vsIndex).toBe(0);
        expect(ammeter.vsIndex).toBe(1);
    });

    it('assembles matrix/vector shells through an injected stamp callback', () => {
        const assembler = new SolverMatrixAssembler();
        const stampComponent = vi.fn((_comp, A, z) => {
            assembler.stampResistor(A, 0, -1, 10);
            assembler.stampCurrentSource(z, -1, 0, 0.5);
        });

        const { A, z, size } = assembler.assemble({
            components: [{ id: 'R1', type: 'Resistor' }],
            nodeCount: 2,
            voltageSourceCount: 0,
            gmin: 1e-12,
            stampComponent
        });

        expect(size).toBe(1);
        expect(stampComponent).toHaveBeenCalledTimes(1);
        expect(A[0][0]).toBeCloseTo(0.100000000001, 12);
        expect(z[0]).toBeCloseTo(0.5, 12);
    });
});
