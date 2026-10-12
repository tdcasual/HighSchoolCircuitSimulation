import { describe, expect, it } from 'vitest';
import {
    applyComponentPropertyDialogChanges,
    getComponentPropertyDialogFields
} from '../src/ui/interaction/ComponentPropertySchema.js';
import { safeParseFloat } from '../src/ui/interaction/UIStateController.js';

const SHARED_TYPES = [
    'PowerSource',
    'ACVoltageSource',
    'Resistor',
    'Ammeter',
    'Voltmeter',
    'Motor',
    'BlackBox',
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
    'SPDTSwitch',
    'Fuse'
];

describe('ComponentPropertySchema', () => {
    it('exposes dialog fields for remaining production types including Motor', () => {
        for (const type of SHARED_TYPES) {
            const fields = getComponentPropertyDialogFields({ type });
            expect(fields.length, type).toBeGreaterThan(0);
        }
        const motorFields = getComponentPropertyDialogFields({ type: 'Motor' });
        expect(motorFields.map((field) => field.key)).toEqual([
            'resistance',
            'torqueConstant',
            'emfConstant',
            'inertia',
            'loadTorque'
        ]);
    });

    it('scales capacitor capacitance to microfarads for display', () => {
        const [capacitanceField] = getComponentPropertyDialogFields({
            type: 'Capacitor',
            capacitance: 0.001
        });
        expect(capacitanceField.value).toBeCloseTo(1000, 6);
    });

    it('applies scaled LED current and Motor mechanical fields from dialog values', () => {
        const led = { type: 'LED' };
        applyComponentPropertyDialogChanges({
            component: led,
            readFieldValue: (id) => ({
                'edit-forward-voltage': '2',
                'edit-on-resistance': '2',
                'edit-off-resistance': '1e9',
                'edit-rated-current': '20'
            }[id] || ''),
            safeParseFloat
        });
        expect(led.ratedCurrent).toBeCloseTo(0.02, 6);

        const motor = { type: 'Motor' };
        applyComponentPropertyDialogChanges({
            component: motor,
            readFieldValue: (id) => ({
                'edit-resistance': '8',
                'edit-torque-constant': '0.2',
                'edit-emf-constant': '0.3',
                'edit-inertia': '0.05',
                'edit-load-torque': '0.04'
            }[id] || ''),
            safeParseFloat
        });
        expect(motor.resistance).toBe(8);
        expect(motor.torqueConstant).toBeCloseTo(0.2, 6);
        expect(motor.emfConstant).toBeCloseTo(0.3, 6);
        expect(motor.inertia).toBeCloseTo(0.05, 6);
        expect(motor.loadTorque).toBeCloseTo(0.04, 6);
    });

    it('defaults PowerSource voltage to 6 V and clears fuse I²t when unblown', () => {
        const source = { type: 'PowerSource' };
        applyComponentPropertyDialogChanges({
            component: source,
            readFieldValue: () => '',
            safeParseFloat
        });
        expect(source.voltage).toBe(6);

        const fuse = { type: 'Fuse', blown: true, i2tAccum: 4 };
        applyComponentPropertyDialogChanges({
            component: fuse,
            readFieldValue: (id) => (id === 'edit-fuse-blown' ? 'false' : ''),
            safeParseFloat,
            readCheckbox: (id) => id !== 'edit-fuse-blown'
        });
        expect(fuse.blown).toBe(false);
        expect(fuse.i2tAccum).toBe(0);
    });
});
