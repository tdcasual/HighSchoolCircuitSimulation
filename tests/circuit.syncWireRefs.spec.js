import { describe, expect, it } from 'vitest';
import { Circuit } from '../src/core/runtime/Circuit.js';
import { createComponent } from '../src/components/Component.js';
import { getTerminalWorldPosition } from '../src/utils/TerminalGeometry.js';

describe('Circuit wire terminal ref sync', () => {
    it('syncs wire endpoint when terminal ref uses numeric componentId for a string-keyed component', () => {
        const circuit = new Circuit();
        const resistor = createComponent('Resistor', 100, 100, '1');
        circuit.addComponent(resistor);

        circuit.addWire({
            id: 'W1',
            a: { x: 0, y: 0 },
            b: { x: 10, y: 10 },
            aRef: { componentId: 1, terminalIndex: 0 }
        });

        const expected = getTerminalWorldPosition(resistor, 0);
        circuit.syncWireEndpointsToTerminalRefs();

        const synced = circuit.getWire('W1');
        expect(synced.a).toEqual({
            x: expected.x,
            y: expected.y
        });
    });

    it('syncs wire endpoint after fromJSON when terminalIndex in ref is a numeric string', () => {
        const circuit = new Circuit();
        circuit.fromJSON({
            meta: { version: 3, name: 'wire-ref-index-string', timestamp: 1760000000000 },
            components: [
                {
                    id: 'V1',
                    type: 'PowerSource',
                    x: 0,
                    y: 0,
                    properties: { voltage: 3, internalResistance: 1 }
                },
                {
                    id: 'R1',
                    type: 'Resistor',
                    x: 100,
                    y: 100,
                    properties: { resistance: 100 }
                }
            ],
            wires: [
                {
                    id: 'W1',
                    a: { x: 0, y: 0 },
                    b: { x: 20, y: 0 },
                    aRef: { componentId: 'R1', terminalIndex: '0' }
                }
            ]
        });

        const resistor = circuit.components.get('R1');
        const expected = getTerminalWorldPosition(resistor, 0);
        const synced = circuit.getWire('W1');

        expect(synced.a).toEqual({
            x: expected.x,
            y: expected.y
        });
        expect(synced.aRef.terminalIndex).toBe(0);
    });
});
