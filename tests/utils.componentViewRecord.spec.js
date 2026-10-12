import { describe, expect, it } from 'vitest';
import { resolveComponentViewRecord } from '../src/utils/componentViewRecord.js';

describe('resolveComponentViewRecord', () => {
    it('returns live when no ViewMap is attached', () => {
        const fuse = { id: 'F1', type: 'Fuse', blown: false, currentValue: 9 };
        expect(resolveComponentViewRecord(fuse, null)).toBe(fuse);
        expect(resolveComponentViewRecord(fuse, undefined)).toBe(fuse);
    });

    it('overlays I/U/P and fuse/motor dynamics from the ViewMap record', () => {
        const fuse = {
            id: 'F1',
            type: 'Fuse',
            blown: false,
            i2tAccum: 0,
            currentValue: 9,
            voltageValue: 9,
            powerValue: 9
        };
        const motor = {
            id: 'M1',
            type: 'Motor',
            speed: 0,
            backEmf: 0,
            currentValue: 9
        };
        const viewMap = new Map([
            ['F1', { currentValue: 0, voltageValue: 2.4, powerValue: 0, blown: true, i2tAccum: 0.4 }],
            ['M1', { currentValue: 0.2, speed: 12, backEmf: 1.2 }]
        ]);

        const fuseView = resolveComponentViewRecord(fuse, viewMap);
        expect(fuseView).not.toBe(fuse);
        expect(fuseView.currentValue).toBe(0);
        expect(fuseView.voltageValue).toBe(2.4);
        expect(fuseView.blown).toBe(true);
        expect(fuseView.i2tAccum).toBe(0.4);
        expect(fuse.blown).toBe(false);
        expect(fuse.currentValue).toBe(9);

        const motorView = resolveComponentViewRecord(motor, viewMap);
        expect(motorView.speed).toBe(12);
        expect(motorView.backEmf).toBe(1.2);
        expect(motor.speed).toBe(0);
    });

    it('zeros I/U/P when ViewMap is attached but the id is missing', () => {
        const resistor = {
            id: 'R1',
            type: 'Resistor',
            currentValue: 0.5,
            voltageValue: 4,
            powerValue: 2
        };
        const overlay = resolveComponentViewRecord(resistor, new Map([
            ['OTHER', { currentValue: 9, voltageValue: 9, powerValue: 9 }]
        ]));
        expect(overlay).not.toBe(resistor);
        expect(overlay.currentValue).toBe(0);
        expect(overlay.voltageValue).toBe(0);
        expect(overlay.powerValue).toBe(0);
        expect(resistor.currentValue).toBe(0.5);
    });
});
