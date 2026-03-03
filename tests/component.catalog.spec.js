import { describe, expect, it } from 'vitest';
import {
    ComponentDefaults,
    ComponentNames,
    getComponentTerminalCount
} from '../src/components/catalog/ComponentCatalog.js';

describe('ComponentCatalog', () => {
    it('exports canonical component metadata collections', () => {
        expect(ComponentDefaults).toBeTruthy();
        expect(ComponentNames).toBeTruthy();
        expect(typeof getComponentTerminalCount).toBe('function');
    });

    it('contains required high-impact component entries', () => {
        expect(ComponentDefaults.Resistor).toBeTruthy();
        expect(ComponentDefaults.Switch).toBeTruthy();
        expect(ComponentDefaults.Rheostat).toBeTruthy();
        expect(ComponentDefaults.Relay).toBeTruthy();
        expect(ComponentDefaults.BlackBox).toBeTruthy();
    });

    it('resolves terminal count for multi-terminal components', () => {
        expect(getComponentTerminalCount('Ground')).toBe(1);
        expect(getComponentTerminalCount('Rheostat')).toBe(3);
        expect(getComponentTerminalCount('SPDTSwitch')).toBe(3);
        expect(getComponentTerminalCount('Relay')).toBe(4);
        expect(getComponentTerminalCount('Resistor')).toBe(2);
    });
});
