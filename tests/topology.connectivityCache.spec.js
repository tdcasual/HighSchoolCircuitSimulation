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

    it('invalidates cached connectivity versions deterministically before topology publish', () => {
        const cache = new ConnectivityCache();
        const resistor = createComponent('Resistor', 0, 0, 'R1');
        const ammeter = createComponent('Ammeter', 0, 0, 'A1');
        resistor.nodes = [0, 1];
        ammeter.nodes = [1, 2];
        resistor._isConnectedCached = true;
        resistor._connectionTopologyVersion = 7;
        ammeter._isConnectedCached = false;
        ammeter._connectionTopologyVersion = 7;

        cache.invalidateComponentConnectivityCache(new Map([
            ['R1', resistor],
            ['A1', ammeter]
        ]));

        expect(resistor._connectionTopologyVersion).toBe(-1);
        expect(ammeter._connectionTopologyVersion).toBe(-1);
        expect('_isConnectedCached' in resistor).toBe(false);
        expect('_isConnectedCached' in ammeter).toBe(false);
    });
});
