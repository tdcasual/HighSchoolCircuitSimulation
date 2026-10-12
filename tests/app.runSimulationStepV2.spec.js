import { describe, expect, it } from 'vitest';
import { getTerminalWorldPosition } from '../src/utils/TerminalGeometry.js';
import { SimulationStateV2 } from '../src/v2/simulation/SimulationStateV2.js';
import { snapshotCircuitModel } from '../src/v2/simulation/snapshotCircuitModel.js';
import { runSimulationStepV2 } from '../src/v2/app/usecases/RunSimulationStepV2.js';
import { addComponent, connectWire, createTestCircuit } from './helpers/circuitTestUtils.js';

describe('RunSimulationStepV2', () => {
    it('runs one simulation step from a wire-only snapshot and projects 0.3A / 2.4V', () => {
        const circuit = createTestCircuit();
        addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 3,
            internalResistance: 2
        }, { x: 100, y: 100 });
        addComponent(circuit, 'Resistor', 'R1', {
            resistance: 8
        }, { x: 300, y: 100 });
        connectWire(circuit, 'W1', 'V1', 0, 'R1', 0);
        connectWire(circuit, 'W2', 'V1', 1, 'R1', 1);

        const snapshot = snapshotCircuitModel(circuit);
        expect(snapshot.components.every((component) => component.nodes === undefined)).toBe(true);
        expect(snapshot.wires).toHaveLength(2);

        const result = runSimulationStepV2({
            circuitModel: snapshot,
            simulationState: new SimulationStateV2(),
            options: {
                dt: 0.01,
                getTerminalWorldPosition: (_componentId, terminalIndex, comp) => (
                    getTerminalWorldPosition(comp, terminalIndex)
                )
            }
        });

        expect(result.solveResult.valid).toBe(true);
        expect(result.projection.components).toHaveLength(2);
        const resistor = result.projection.components.find((item) => item.id === 'R1');
        expect(resistor?.measurements.current).toBeCloseTo(0.3, 6);
        expect(resistor?.measurements.voltage).toBeCloseTo(2.4, 6);
        expect(result.diagnostics.code).toBe('');
        expect(result.nextState).toBeInstanceOf(SimulationStateV2);
    });
});
