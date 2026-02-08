import { describe, expect, it } from 'vitest';
import { Circuit } from '../src/engine/Circuit.js';
import { createComponent } from '../src/components/Component.js';

describe('Solver uses SimulationState', () => {
    it('stores diode conduction state in SimulationState', () => {
        const circuit = new Circuit();
        const diode = createComponent('Diode', 0, 0, 'D1');
        diode.nodes = [0, 1];
        diode.forwardVoltage = 0.7;
        diode.onResistance = 1;
        diode.offResistance = 1e9;

        circuit.addComponent(diode);
        circuit.rebuildNodes();
        circuit.resetSimulationState();

        circuit.solver.setCircuit([diode], circuit.nodes);
        circuit.solver.setSimulationState(circuit.simulationState);
        const result = circuit.solver.solve(0.01, 0);

        const entry = circuit.simulationState.get('D1');
        expect(result.valid).toBe(true);
        expect(entry.conducting).toBeTypeOf('boolean');
    });
});
