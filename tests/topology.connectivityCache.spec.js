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
});
