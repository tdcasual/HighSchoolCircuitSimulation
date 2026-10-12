import { describe, expect, it, vi } from 'vitest';
import { Circuit } from '../src/core/runtime/Circuit.js';
import { createComponent } from '../src/components/Component.js';

describe('Circuit façade delegation', () => {
    it('adds a component through the topology service and stores the live entity', () => {
        const circuit = new Circuit();
        const addSpy = vi.spyOn(circuit.topologyService, 'addComponent');
        const resistor = createComponent('Resistor', 10, 20, 'R1');
        resistor.resistance = 8;

        circuit.addComponent(resistor);

        expect(addSpy).toHaveBeenCalledWith(circuit, resistor);
        expect(circuit.getComponent('R1')).toBe(resistor);
        expect(circuit.getComponent('R1').x).toBe(10);
        expect(circuit.getComponent('R1').y).toBe(20);
    });

    it('prepareSimulation arms stepping through the simulation loop service', () => {
        const circuit = new Circuit();
        const prepareSpy = vi.spyOn(circuit.simulationLoopService, 'prepareSimulation');

        circuit.prepareSimulation();

        expect(prepareSpy).toHaveBeenCalledWith(circuit);
        expect(circuit.isRunning).toBe(true);
        expect(circuit.simTime).toBe(0);
    });

    it('does not prepare the V1 solver on a valid v2 step', () => {
        const circuit = new Circuit();
        const resistor = createComponent('Resistor', 0, 0, 'R1');
        resistor.resistance = 8;
        circuit.addComponent(resistor);
        circuit.solverBackend = {
            mode: 'v2',
            solveFrame: vi.fn(() => ({
                valid: true,
                voltages: [0],
                currents: new Map([['R1', 0.3]]),
                viewMap: new Map()
            }))
        };
        circuit.prepareSimulation();
        circuit.step();

        expect(circuit.solverBackend.solveFrame).toHaveBeenCalledTimes(1);
        expect(circuit.solver).toBeUndefined();
        expect(circuit.lastResults.backendUsed).toBe('v2');
    });
});
