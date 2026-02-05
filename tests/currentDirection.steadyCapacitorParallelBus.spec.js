import { describe, it, expect } from 'vitest';
import { createTestCircuit, addComponent, connectWire, solveCircuit } from './helpers/circuitTestUtils.js';

describe('Steady-state capacitor on a bus node', () => {
    it('does not zero out bus wires when the capacitor terminal is used as a junction', () => {
        const circuit = createTestCircuit();
        circuit.dt = 0.01;

        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 12,
            internalResistance: 0.5
        });
        const cap = addComponent(circuit, 'Capacitor', 'C1', { capacitance: 0.001 });
        const load = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });

        // Wire the rails so that the capacitor terminals are "in the middle" of each rail (degree=2 junction).
        // Top rail (current forward): source(+) -> cap(0) -> load(0)
        const wTopLeft = connectWire(circuit, 'WtopL', source, 0, cap, 0);
        const wTopRight = connectWire(circuit, 'WtopR', cap, 0, load, 0);

        // Bottom rail (current return): load(1) -> cap(1) -> source(-)
        const wBotRight = connectWire(circuit, 'WbotR', load, 1, cap, 1);
        const wBotLeft = connectWire(circuit, 'WbotL', cap, 1, source, 1);

        circuit.rebuildNodes();

        // Pre-charge the capacitor so its steady-state current is ~0 at the DC operating point.
        // With the capacitor open at DC, the loop is just: source(r=0.5Ω) -> R=100Ω.
        const expectedLoopCurrent = source.voltage / (load.resistance + source.internalResistance);
        const expectedTerminalVoltage = expectedLoopCurrent * load.resistance;
        cap.prevCharge = (cap.capacitance || 0) * expectedTerminalVoltage;

        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);

        // Sanity: load current matches the DC loop current and capacitor current is ~0.
        expect(results.currents.get('R1')).toBeCloseTo(expectedLoopCurrent, 6);
        expect(Math.abs(results.currents.get('C1') || 0)).toBeLessThan(1e-6);

        // Regression: bus wires must still report current even though the capacitor branch is steady.
        const infos = [
            circuit.getWireCurrentInfo(wTopLeft, results),
            circuit.getWireCurrentInfo(wTopRight, results),
            circuit.getWireCurrentInfo(wBotRight, results),
            circuit.getWireCurrentInfo(wBotLeft, results)
        ];
        for (const info of infos) {
            expect(info).not.toBeNull();
            expect(info.flowDirection).toBe(1);
            expect(info.current).toBeGreaterThan(0.05);
            expect(info.current).toBeCloseTo(expectedLoopCurrent, 3);
        }
    });
});

