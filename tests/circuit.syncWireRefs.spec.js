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
});
