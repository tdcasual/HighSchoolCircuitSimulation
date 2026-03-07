import { describe, expect, it } from 'vitest';
import {
    COMPONENT_DEFINITION_REGISTRY,
    buildComponentDefaultsMap,
    buildComponentDisplayNameMap,
    buildComponentTerminalCountMap,
    getComponentDefinition,
    listComponentDefinitionTypes
} from '../src/components/ComponentDefinitionRegistry.js';

describe('ComponentDefinitionRegistry', () => {
    it('exposes canonical definitions for all supported component types', () => {
        const types = listComponentDefinitionTypes();

        expect(types.length).toBeGreaterThan(0);
        expect(types).toEqual(Object.keys(COMPONENT_DEFINITION_REGISTRY));

        for (const type of types) {
            const definition = getComponentDefinition(type);
            expect(definition).toBeTruthy();
            expect(definition.type).toBe(type);
            expect(typeof definition.displayName).toBe('string');
            expect(definition.displayName.length).toBeGreaterThan(0);
            expect(definition.terminalCount).toBeGreaterThanOrEqual(1);
            expect(definition.defaults).toBeTypeOf('object');
        }
    });

    it('returns cloned defaults so consumers cannot mutate the registry source', () => {
        const firstRead = getComponentDefinition('Resistor');
        firstRead.defaults.resistance = 999;

        const secondRead = getComponentDefinition('Resistor');
        expect(secondRead.defaults.resistance).toBe(100);
    });

    it('builds defaults/name/terminal-count maps from the same source', () => {
        const defaults = buildComponentDefaultsMap();
        const names = buildComponentDisplayNameMap();
        const terminalCounts = buildComponentTerminalCountMap();

        expect(defaults.Rheostat.maxResistance).toBe(100);
        expect(names.Rheostat).toBe('滑动变阻器');
        expect(terminalCounts.Relay).toBe(4);
    });
});
