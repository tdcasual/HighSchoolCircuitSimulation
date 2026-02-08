import { describe, expect, it } from 'vitest';
import { NetlistBuilder } from '../src/core/simulation/NetlistBuilder.js';

describe('NetlistBuilder', () => {
    it('creates a netlist DTO', () => {
        const builder = new NetlistBuilder();
        const netlist = builder.build({ components: [], nodes: [] });
        expect(netlist).toEqual({ nodes: [], components: [] });
    });
});
