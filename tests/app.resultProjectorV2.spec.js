import { describe, expect, it } from 'vitest';
import { projectResultV2 } from '../src/v2/app/ResultProjector.js';
import { CircuitModel } from '../src/v2/domain/CircuitModel.js';
import { addComponent } from '../src/v2/domain/CircuitModelCommands.js';

describe('ResultProjector v2', () => {
    it('projects solve result into readonly component view models', () => {
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

        const solveResult = {
            valid: true,
            voltages: [0, 2.4],
            currents: new Map([
                ['V1', -0.3],
                ['R1', 0.3]
            ]),
            diagnostics: { code: '', warnings: [] }
        };

        const viewModel = projectResultV2({
            circuitModel: model,
            solveResult
        });

        expect(viewModel.valid).toBe(true);
        expect(viewModel.components).toHaveLength(2);
        const resistorVM = viewModel.components.find((item) => item.id === 'R1');
        expect(resistorVM.status).toBe('ok');
        expect(resistorVM.measurements.voltage).toBeCloseTo(2.4, 6);
        expect(resistorVM.measurements.current).toBeCloseTo(0.3, 6);
        expect(resistorVM.measurements.power).toBeCloseTo(0.72, 6);

        const originalResistor = model.getComponent('R1');
        expect(originalResistor.display).toBeUndefined();
        expect(originalResistor.measurements).toBeUndefined();
    });

    it('marks disconnected component when current is missing from solve result', () => {
        let model = CircuitModel.empty();
        model = addComponent(model, {
            id: 'R1',
            type: 'Resistor',
            nodes: [1, 0],
            resistance: 8
        });

        const viewModel = projectResultV2({
            circuitModel: model,
            solveResult: {
                valid: true,
                voltages: [0, 2.4],
                currents: new Map(),
                diagnostics: { code: '', warnings: [] }
            }
        });

        expect(viewModel.components[0].status).toBe('disconnected');
        expect(viewModel.components[0].measurements.current).toBe(0);
    });
});
