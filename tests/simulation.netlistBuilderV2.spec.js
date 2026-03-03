import { describe, expect, it } from 'vitest';
import { NetlistBuilderV2 } from '../src/v2/simulation/NetlistBuilderV2.js';

describe('NetlistBuilderV2', () => {
    it('builds pure netlist DTO without source references or function values', () => {
        const builder = new NetlistBuilderV2();
        const component = {
            id: 'R1',
            type: 'Resistor',
            nodes: [1, 0],
            resistance: 100,
            profile: {
                stage: 'lab'
            },
            helper: () => 42
        };

        const netlist = builder.build({
            components: [component],
            nodes: ['gnd', 'n1']
        });

        expect(netlist.meta).toEqual({ version: 2 });
        expect(netlist.nodes).toEqual([{ id: 'gnd' }, { id: 'n1' }]);
        expect(netlist.components).toHaveLength(1);
        expect(netlist.components[0]).toEqual({
            id: 'R1',
            type: 'Resistor',
            nodes: [1, 0],
            params: {
                resistance: 100,
                profile: { stage: 'lab' }
            }
        });
        expect(netlist.components[0]).not.toHaveProperty('source');
        expect(Object.getPrototypeOf(netlist.components[0].params)).toBe(Object.prototype);
        expect(netlist.components[0].params.profile).not.toBe(component.profile);
    });

    it('normalizes unknown component payloads and keeps DTO serializable', () => {
        const builder = new NetlistBuilderV2();
        const netlist = builder.build({
            components: [null, { type: 'Custom', nodes: ['n1', 'n2'], payload: { value: 5 } }],
            nodes: [{ id: 'n0', label: 'ground' }, 2]
        });

        expect(netlist.components[0]).toEqual({
            id: 'Unknown_0',
            type: 'Unknown',
            nodes: [],
            params: {}
        });
        expect(netlist.components[1]).toEqual({
            id: 'Custom_1',
            type: 'Custom',
            nodes: ['n1', 'n2'],
            params: { payload: { value: 5 } }
        });
        expect(netlist.nodes).toEqual([{ id: 'n0' }, { id: '2' }]);
        expect(() => JSON.stringify(netlist)).not.toThrow();
    });
});
