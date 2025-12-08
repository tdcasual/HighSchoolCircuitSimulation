import { describe, it, expect } from 'vitest';
import { createTestCircuit, addComponent, connectWire, solveCircuit } from './helpers/circuitTestUtils.js';

describe('Wire connection validation - prevents phantom current', () => {
    it('should NOT show current on wires when components are not fully connected', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 12,
            internalResistance: 0
        });
        const r1 = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        const r2 = addComponent(circuit, 'Resistor', 'R2', { resistance: 100 });

        // Connect power source fully (both terminals)
        connectWire(circuit, 'Wpos', source, 0, r1, 0);
        connectWire(circuit, 'Wneg', r1, 1, source, 1);
        
        // R2 is only connected on ONE terminal - incomplete connection
        const incompleteWire = connectWire(circuit, 'Wincomplete', source, 0, r2, 0);

        // Force node rebuild
        circuit.rebuildNodes();

        // R1 should be connected (both terminals wired)
        expect(circuit.isComponentConnected(r1.id)).toBe(true);
        
        // R2 should NOT be connected (only one terminal wired)
        expect(circuit.isComponentConnected(r2.id)).toBe(false);

        // Solve circuit
        const results = solveCircuit(circuit);
        expect(results.valid).toBe(true);

        // The incomplete wire should report ZERO current (no animation should appear)
        const wireInfo = circuit.getWireCurrentInfo(incompleteWire, results);
        expect(wireInfo).not.toBeNull();
        expect(wireInfo.current).toBe(0);
        expect(wireInfo.flowDirection).toBe(0);
    });

    it('should show current only after both terminals are connected', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 12,
            internalResistance: 0
        });
        const r1 = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });

        // Initially connect only one terminal
        const wire1 = connectWire(circuit, 'W1', source, 0, r1, 0);
        circuit.rebuildNodes();
        
        expect(circuit.isComponentConnected(r1.id)).toBe(false);
        
        let results = solveCircuit(circuit);
        let wireInfo = circuit.getWireCurrentInfo(wire1, results);
        
        // Should have NO current (incomplete connection)
        expect(wireInfo.current).toBe(0);

        // Now complete the connection
        connectWire(circuit, 'W2', r1, 1, source, 1);
        circuit.rebuildNodes();
        
        expect(circuit.isComponentConnected(r1.id)).toBe(true);
        
        results = solveCircuit(circuit);
        wireInfo = circuit.getWireCurrentInfo(wire1, results);
        
        // NOW should have current (complete connection)
        expect(wireInfo.current).toBeGreaterThan(0);
        expect(wireInfo.flowDirection).not.toBe(0);
    });

    it('should NOT show current on rheostat wires when less than 2 terminals are connected', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 12,
            internalResistance: 0
        });
        const rheostat = addComponent(circuit, 'Rheostat', 'Rh1', {
            minResistance: 0,
            maxResistance: 100,
            position: 0.5
        });

        // Connect only left terminal (terminal 0) - incomplete for rheostat
        const incompleteWire = connectWire(circuit, 'W1', source, 0, rheostat, 0);
        circuit.rebuildNodes();

        // Rheostat needs at least 2 different terminals connected
        expect(circuit.isComponentConnected(rheostat.id)).toBe(false);

        const results = solveCircuit(circuit);
        const wireInfo = circuit.getWireCurrentInfo(incompleteWire, results);
        
        // Should have NO current
        expect(wireInfo.current).toBe(0);
        expect(wireInfo.flowDirection).toBe(0);
    });

    it('rheostat should show current when at least 2 terminals are properly connected', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 12,
            internalResistance: 0
        });
        const rheostat = addComponent(circuit, 'Rheostat', 'Rh1', {
            minResistance: 0,
            maxResistance: 100,
            position: 0.5
        });

        // Connect left and slider terminals (2 terminals) - valid for rheostat
        const wire1 = connectWire(circuit, 'W1', source, 0, rheostat, 0);  // left terminal
        connectWire(circuit, 'W2', rheostat, 2, source, 1);  // slider terminal
        circuit.rebuildNodes();

        // Rheostat should now be connected
        expect(circuit.isComponentConnected(rheostat.id)).toBe(true);

        const results = solveCircuit(circuit);
        const wireInfo = circuit.getWireCurrentInfo(wire1, results);
        
        // Should have current
        expect(wireInfo.current).toBeGreaterThan(0);
    });
});
