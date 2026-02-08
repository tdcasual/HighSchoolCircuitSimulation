import { describe, expect, it } from 'vitest';
import { Circuit } from '../src/engine/Circuit.js';
import { createComponent } from '../src/components/Component.js';

describe('Circuit simulation state reset', () => {
    it('resets state without starting timers', () => {
        const circuit = new Circuit();
        const cap = createComponent('Capacitor', 0, 0, 'C1');
        cap.nodes = [0, 1];
        circuit.addComponent(cap);

        circuit.resetSimulationState();

        const state = circuit.simulationState.get('C1');
        expect(state.prevVoltage).toBe(0);
        expect(state.prevCharge).toBe(0);
        expect(state._dynamicHistoryReady).toBe(false);
    });
});
