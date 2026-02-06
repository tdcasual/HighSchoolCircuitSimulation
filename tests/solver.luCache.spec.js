import { describe, expect, it } from 'vitest';
import { addComponent, connectWire, createTestCircuit } from './helpers/circuitTestUtils.js';

describe('Solver LU cache reuse', () => {
    it('reuses LU factorization when matrix A is unchanged', () => {
        const circuit = createTestCircuit();
        circuit.dt = 0.001;

        const source = addComponent(circuit, 'ACVoltageSource', 'VAC', {
            rmsVoltage: 10,
            frequency: 50,
            phase: 0,
            offset: 0,
            internalResistance: 0
        });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });

        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, source, 1);

        circuit.rebuildNodes();
        circuit.solver.setCircuit(
            Array.from(circuit.components.values()),
            circuit.nodes
        );

        const resultAtZero = circuit.solver.solve(circuit.dt, 0);
        expect(resultAtZero.valid).toBe(true);
        const factorizationBefore = circuit.solver.systemFactorizationCache.factorization;
        const keyBefore = circuit.solver.systemFactorizationCache.key;
        expect(factorizationBefore).toBeTruthy();

        const resultAtQuarterCycle = circuit.solver.solve(circuit.dt, 0.005);
        expect(resultAtQuarterCycle.valid).toBe(true);
        const factorizationAfter = circuit.solver.systemFactorizationCache.factorization;
        const keyAfter = circuit.solver.systemFactorizationCache.key;

        expect(factorizationAfter).toBe(factorizationBefore);
        expect(keyAfter).toBe(keyBefore);

        const i0 = resultAtZero.currents.get('R1') || 0;
        const i1 = resultAtQuarterCycle.currents.get('R1') || 0;
        expect(Math.abs(i1 - i0)).toBeGreaterThan(1e-3);
    });

    it('refreshes LU factorization when auto integration changes stamp method', () => {
        const circuit = createTestCircuit();
        circuit.dt = 0.01;

        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 10, internalResistance: 0 });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        const capacitor = addComponent(circuit, 'Capacitor', 'C1', {
            capacitance: 0.001,
            integrationMethod: 'auto'
        });

        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, capacitor, 0);
        connectWire(circuit, 'W3', capacitor, 1, source, 1);

        circuit.rebuildNodes();
        circuit.solver.setCircuit(
            Array.from(circuit.components.values()),
            circuit.nodes
        );

        expect(circuit.solver.resolveDynamicIntegrationMethod(capacitor)).toBe('backward-euler');

        const firstStep = circuit.solver.solve(circuit.dt, 0);
        expect(firstStep.valid).toBe(true);
        const factorizationBefore = circuit.solver.systemFactorizationCache.factorization;
        expect(factorizationBefore).toBeTruthy();

        circuit.solver.updateDynamicComponents(firstStep.voltages, firstStep.currents);
        expect(circuit.solver.resolveDynamicIntegrationMethod(capacitor)).toBe('trapezoidal');

        const secondStep = circuit.solver.solve(circuit.dt, circuit.dt);
        expect(secondStep.valid).toBe(true);
        const factorizationAfter = circuit.solver.systemFactorizationCache.factorization;

        expect(factorizationAfter).toBeTruthy();
        expect(factorizationAfter).not.toBe(factorizationBefore);
    });
});
