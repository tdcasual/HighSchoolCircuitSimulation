import { describe, expect, it } from 'vitest';
import { createComponent } from '../src/components/Component.js';
import { getTerminalWorldPosition } from '../src/utils/TerminalGeometry.js';
import { NodeBuilder } from '../src/core/topology/NodeBuilder.js';

function createWireFromTerminals(id, startComp, startTerminal, endComp, endTerminal) {
    const a = getTerminalWorldPosition(startComp, startTerminal);
    const b = getTerminalWorldPosition(endComp, endTerminal);
    return { id, a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y } };
}

describe('NodeBuilder', () => {
    it('maps connected terminals to the same node index', () => {
        const power = createComponent('PowerSource', 0, 0, 'E1');
        const resistor = createComponent('Resistor', 220, 0, 'R1');
        const components = new Map([
            [power.id, power],
            [resistor.id, resistor]
        ]);
        const wire = createWireFromTerminals('W1', power, 0, resistor, 0);
        const wires = new Map([[wire.id, wire]]);
        const builder = new NodeBuilder();

        builder.build({
            components,
            wires,
            getTerminalWorldPosition: (componentId, terminalIndex, comp) =>
                getTerminalWorldPosition(comp || components.get(componentId), terminalIndex)
        });

        expect(power.nodes[0]).toBeGreaterThanOrEqual(0);
        expect(resistor.nodes[0]).toBe(power.nodes[0]);
        expect(wire.nodeIndex).toBe(power.nodes[0]);
    });
});
