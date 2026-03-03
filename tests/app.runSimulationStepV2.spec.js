import { describe, expect, it } from 'vitest';
import { CircuitModel } from '../src/v2/domain/CircuitModel.js';
import { addComponent } from '../src/v2/domain/CircuitModelCommands.js';
import { SimulationStateV2 } from '../src/v2/simulation/SimulationStateV2.js';
import { runSimulationStepV2 } from '../src/v2/app/usecases/RunSimulationStepV2.js';

describe('RunSimulationStepV2', () => {
    it('runs one simulation step and returns projection + diagnostics', () => {
        let model = CircuitModel.empty();
        model = addComponent(model, {
            id: 'V1',
            type: 'PowerSource',
            nodes: [1, 0],
            voltage: 3,
            internalResistance: 2
        });
        model = addComponent(model, {
            id: 'R1',
            type: 'Resistor',
            nodes: [1, 0],
            resistance: 8
        });

        const result = runSimulationStepV2({
            circuitModel: model,
            simulationState: new SimulationStateV2(),
            options: { dt: 0.01 }
        });

        expect(result.solveResult.valid).toBe(true);
        expect(result.projection.components).toHaveLength(2);
        expect(result.projection.components.find((item) => item.id === 'R1')?.measurements.current).toBeCloseTo(0.3, 6);
        expect(result.diagnostics.code).toBe('');
        expect(result.nextState).toBeInstanceOf(SimulationStateV2);
    });
});
