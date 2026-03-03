import { describe, expect, it } from 'vitest';
import {
    COMPONENT_MANIFEST_V2,
    getComponentManifestV2,
    listComponentTypesV2
} from '../src/v2/domain/components/ComponentManifest.js';
import { createComponentV2, resetV2ComponentIdCounter } from '../src/v2/domain/components/createComponentV2.js';

const EXPECTED_TYPES = [
    'Ground',
    'PowerSource',
    'ACVoltageSource',
    'Resistor',
    'Diode',
    'LED',
    'Thermistor',
    'Photoresistor',
    'Relay',
    'Rheostat',
    'Bulb',
    'Capacitor',
    'Inductor',
    'ParallelPlateCapacitor',
    'Motor',
    'Switch',
    'SPDTSwitch',
    'Fuse',
    'Ammeter',
    'Voltmeter',
    'BlackBox'
];

describe('component manifest v2', () => {
    it('provides manifest entries for all supported component types', () => {
        expect(listComponentTypesV2().sort()).toEqual([...EXPECTED_TYPES].sort());
        for (const type of EXPECTED_TYPES) {
            expect(COMPONENT_MANIFEST_V2[type]).toBeDefined();
            expect(typeof COMPONENT_MANIFEST_V2[type].displayName).toBe('string');
            expect(COMPONENT_MANIFEST_V2[type].displayName.length).toBeGreaterThan(0);
            expect(COMPONENT_MANIFEST_V2[type].terminalCount).toBeGreaterThanOrEqual(1);
            expect(COMPONENT_MANIFEST_V2[type].defaults).toBeTypeOf('object');
        }
    });

    it('exposes readable terminal count/default params', () => {
        const resistor = getComponentManifestV2('Resistor');
        const rheostat = getComponentManifestV2('Rheostat');

        expect(resistor.terminalCount).toBe(2);
        expect(resistor.defaults.resistance).toBe(100);
        expect(rheostat.terminalCount).toBe(3);
        expect(rheostat.defaults.maxResistance).toBe(100);
    });

    it('creates component instance from manifest defaults', () => {
        resetV2ComponentIdCounter();
        const component = createComponentV2('Rheostat', 10, 20);

        expect(component.id).toBe('Rheostat_1');
        expect(component.type).toBe('Rheostat');
        expect(component.nodes).toEqual([-1, -1, -1]);
        expect(component.maxResistance).toBe(100);
    });
});
