import { describe, expect, it } from 'vitest';
import { CircuitModel } from '../src/v2/domain/CircuitModel.js';
import {
    addComponent,
    addWire,
    removeComponent,
    removeWire
} from '../src/v2/domain/CircuitModelCommands.js';

describe('CircuitModel v2 immutable commands', () => {
    it('returns a new model with monotonically increasing version for each command', () => {
        const initial = CircuitModel.empty();
        const withComponent = addComponent(initial, {
            id: 'R1',
            type: 'Resistor',
            resistance: 100
        });
        const withWire = addWire(withComponent, {
            id: 'W1',
            aRef: { componentId: 'R1', terminalIndex: 0 },
            bRef: { componentId: 'GND', terminalIndex: 0 }
        });
        const withoutComponent = removeComponent(withWire, 'R1');
        const withoutWire = removeWire(withoutComponent, 'W1');

        expect(initial.version).toBe(0);
        expect(withComponent.version).toBe(1);
        expect(withWire.version).toBe(2);
        expect(withoutComponent.version).toBe(3);
        expect(withoutWire.version).toBe(4);

        expect(initial.components.size).toBe(0);
        expect(withComponent.components.has('R1')).toBe(true);
        expect(withComponent.wires.has('W1')).toBe(false);
        expect(withWire.wires.has('W1')).toBe(true);
        expect(withoutComponent.components.has('R1')).toBe(false);
        expect(withoutWire.wires.has('W1')).toBe(false);
    });

    it('prevents direct external mutation of internal maps and entries', () => {
        const model = addComponent(CircuitModel.empty(), {
            id: 'R1',
            type: 'Resistor',
            resistance: 100
        });

        const viewMap = model.components;
        viewMap.clear();

        expect(model.components.size).toBe(1);

        const leakedValue = model.components.get('R1');
        leakedValue.type = 'MutatedOutside';
        leakedValue.resistance = 1;

        const fromModel = model.getComponent('R1');
        expect(fromModel).toEqual({
            id: 'R1',
            type: 'Resistor',
            resistance: 100
        });
    });

    it('removing component also removes wires when wire refs use numeric component ids', () => {
        const withComponent = addComponent(CircuitModel.empty(), {
            id: '1',
            type: 'Resistor'
        });
        const withWire = addWire(withComponent, {
            id: 'W1',
            aRef: { componentId: 1, terminalIndex: 0 },
            bRef: { componentId: 'GND', terminalIndex: 0 }
        });

        const withoutComponent = removeComponent(withWire, '1');

        expect(withoutComponent.components.has('1')).toBe(false);
        expect(withoutComponent.wires.has('W1')).toBe(false);
    });

    it('preserves numeric zero ids instead of replacing with fallback ids', () => {
        const withComponent = addComponent(CircuitModel.empty(), {
            id: 0,
            type: 'Resistor'
        });
        const withWire = addWire(withComponent, {
            id: 0,
            aRef: { componentId: '0', terminalIndex: 0 },
            bRef: { componentId: 'GND', terminalIndex: 0 }
        });

        expect(withComponent.components.has('0')).toBe(true);
        expect(withComponent.components.has('Unknown_0')).toBe(false);
        expect(withWire.wires.has('0')).toBe(true);
        expect(withWire.wires.has('Wire_0')).toBe(false);
    });
});
