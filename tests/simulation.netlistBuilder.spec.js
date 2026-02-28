import { describe, expect, it } from 'vitest';
import { NetlistBuilder } from '../src/core/simulation/NetlistBuilder.js';

describe('NetlistBuilder', () => {
    it('builds explicit DTO entries for component terminals and node indices', () => {
        const builder = new NetlistBuilder();
        const resistor = {
            id: 'R1',
            type: 'Resistor',
            nodes: [1, 0],
            resistance: 100
        };
        const source = {
            id: 'V1',
            type: 'PowerSource',
            nodes: [1, 0],
            voltage: 3,
            internalResistance: 2
        };
        const netlist = builder.build({
            components: [source, resistor],
            nodes: ['gnd', 'n1']
        });

        expect(netlist.meta).toEqual({ version: 1 });
        expect(netlist.nodes).toEqual([
            { index: 0, node: 'gnd' },
            { index: 1, node: 'n1' }
        ]);
        expect(netlist.components).toHaveLength(2);
        expect(netlist.components[0]).toMatchObject({
            id: 'V1',
            type: 'PowerSource',
            nodes: [1, 0]
        });
        expect(netlist.components[0].params).toMatchObject({
            voltage: 3,
            internalResistance: 2
        });
        expect(netlist.components[0].source).toBe(source);
        expect(netlist.components[1]).toMatchObject({
            id: 'R1',
            type: 'Resistor',
            nodes: [1, 0]
        });
        expect(netlist.components[1].params).toMatchObject({
            resistance: 100
        });
        expect(netlist.components[1].source).toBe(resistor);
    });
});
