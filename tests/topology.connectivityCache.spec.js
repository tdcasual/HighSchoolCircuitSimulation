import { describe, expect, it } from 'vitest';
import { createComponent } from '../src/components/Component.js';
import { ConnectivityCache } from '../src/core/topology/ConnectivityCache.js';

describe('ConnectivityCache', () => {
    it('marks component connected when terminal degree is greater than zero', () => {
        const cache = new ConnectivityCache();
        const resistor = createComponent('Resistor', 0, 0, 'R1');
        resistor.nodes = [0, 1];
        const connected = cache.computeComponentConnectedState('R1', resistor, new Map([
            ['R1:0', 1],
            ['R1:1', 1]
        ]));

        expect(connected).toBe(true);
    });

    it('normalizes numeric component ids for cached connectivity lookup', () => {
        const cache = new ConnectivityCache();
        const resistor = createComponent('Resistor', 0, 0, '0');
        resistor.nodes = [0, 1];
        const components = new Map([['0', resistor]]);
        const terminalConnectionMap = new Map([
            ['0:0', 1],
            ['0:1', 1]
        ]);

        const connected = cache.isComponentConnected(
            0,
            components,
            1,
            terminalConnectionMap
        );

        expect(connected).toBe(true);
    });
});
