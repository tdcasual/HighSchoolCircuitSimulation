import { describe, expect, it, vi } from 'vitest';
import {
    getWireCurrentInfo,
    isWireInShortCircuit,
    refreshShortCircuitDiagnostics
} from '../src/engine/runtime/CircuitShortCircuitDiagnosticsService.js';

function createBaseCircuitMock() {
    return {
        components: new Map(),
        wires: new Map(),
        solver: {
            getSourceInstantVoltage: vi.fn(() => 12)
        },
        getTerminalWorldPositionCached: vi.fn(),
        ensureWireFlowCache: vi.fn(),
        _wireFlowCache: { map: new Map() },
        shortedSourceIds: new Set(),
        shortedPowerNodes: new Set(),
        shortedWireIds: new Set(),
        shortCircuitCacheVersion: null,
        getWire(id) {
            return this.wires.get(id) || null;
        }
    };
}

describe('CircuitShortCircuitDiagnosticsService', () => {
    it('marks wires that touch a direct-short source terminal when results are missing', () => {
        const circuit = createBaseCircuitMock();
        circuit.components.set('V1', {
            id: 'V1',
            type: 'PowerSource',
            nodes: [0, 0],
            internalResistance: 0.5
        });
        circuit.wires.set('W_touch', {
            id: 'W_touch',
            a: { x: 10, y: 20 },
            b: { x: 30, y: 20 }
        });
        circuit.wires.set('W_other', {
            id: 'W_other',
            a: { x: 100, y: 200 },
            b: { x: 130, y: 200 }
        });
        circuit.getTerminalWorldPositionCached.mockImplementation((_id, terminalIndex) => (
            terminalIndex === 0 ? { x: 10, y: 20 } : { x: 30, y: 20 }
        ));

        refreshShortCircuitDiagnostics(circuit, null);

        expect(circuit.shortedSourceIds.has('V1')).toBe(true);
        expect(circuit.shortedPowerNodes.has(0)).toBe(true);
        expect(circuit.shortedWireIds.has('W_touch')).toBe(true);
        expect(circuit.shortedWireIds.has('W_other')).toBe(false);
        expect(circuit.shortCircuitCacheVersion).toBe(null);
    });

    it('resolves short-circuit status from cached wire IDs and topology fallback', () => {
        const circuit = createBaseCircuitMock();
        circuit.wires.set('W1', { id: 'W1', nodeIndex: 5 });
        circuit.wires.set('W2', { id: 'W2', nodeIndex: 7 });

        circuit.shortedWireIds = new Set(['W1']);
        circuit.shortCircuitCacheVersion = {};
        expect(isWireInShortCircuit(circuit, 'W1')).toBe(true);

        circuit.shortedWireIds = new Set();
        circuit.shortCircuitCacheVersion = null;
        circuit.shortedPowerNodes = new Set([7]);
        expect(isWireInShortCircuit(circuit, circuit.wires.get('W2'))).toBe(true);
        expect(isWireInShortCircuit(circuit, circuit.wires.get('W1'))).toBe(false);
    });

    it('builds wire current info from flow cache and voltage table', () => {
        const circuit = createBaseCircuitMock();
        const wire = { id: 'W_flow', nodeIndex: 1 };
        circuit.wires.set('W_flow', wire);
        circuit.shortedWireIds = new Set(['W_flow']);
        circuit.shortCircuitCacheVersion = {};
        circuit._wireFlowCache.map.set('W_flow', { currentMagnitude: 2.4, flowDirection: -1 });

        const info = getWireCurrentInfo(circuit, wire, {
            valid: true,
            voltages: { 1: 9.6 }
        });

        expect(circuit.ensureWireFlowCache).toHaveBeenCalled();
        expect(info).toEqual({
            current: 2.4,
            voltage1: 9.6,
            voltage2: 9.6,
            isShorted: false,
            flowDirection: -1,
            voltageDiff: 0
        });
    });
});
