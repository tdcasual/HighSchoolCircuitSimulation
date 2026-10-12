import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createTestCircuit } from './helpers/circuitTestUtils.js';

describe('Circuit haltSimulation', () => {
    it('only clears isRunning and does not own a timer field', () => {
        const circuit = createTestCircuit();
        circuit.isRunning = true;
        circuit.haltSimulation();
        expect(circuit.isRunning).toBe(false);
        expect(circuit.simulationInterval).toBeUndefined();

        const source = readFileSync(resolve(process.cwd(), 'src/core/runtime/Circuit.js'), 'utf8');
        expect(source).not.toContain('simulationInterval');
        expect(source).not.toContain('clearInterval');
        expect(source).not.toContain('setInterval');
    });
});
