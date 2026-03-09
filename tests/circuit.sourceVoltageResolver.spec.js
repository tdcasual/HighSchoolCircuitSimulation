import { describe, expect, it } from 'vitest';

describe('Circuit source voltage resolver', () => {
    it('returns DC source voltage unchanged', async () => {
        const { resolveCircuitSourceVoltageAtTime } = await import('../src/core/services/CircuitSourceVoltageResolver.js');
        expect(resolveCircuitSourceVoltageAtTime({ type: 'PowerSource', voltage: 12 }, 1.25)).toBe(12);
    });

    it('computes AC source instantaneous voltage from RMS, phase, and offset', async () => {
        const { resolveCircuitSourceVoltageAtTime } = await import('../src/core/services/CircuitSourceVoltageResolver.js');
        const voltage = resolveCircuitSourceVoltageAtTime({
            type: 'ACVoltageSource',
            rmsVoltage: 10,
            frequency: 50,
            phase: 90,
            offset: 1
        }, 0);

        expect(voltage).toBeCloseTo(1 + 10 * Math.sqrt(2), 9);
    });

    it('can assign the computed instantaneous voltage onto the component', async () => {
        const { assignCircuitSourceInstantaneousVoltage } = await import('../src/core/services/CircuitSourceVoltageResolver.js');
        const comp = {
            type: 'ACVoltageSource',
            rmsVoltage: 5,
            frequency: 60,
            phase: 0,
            offset: 0
        };

        const value = assignCircuitSourceInstantaneousVoltage(comp, 0.001);

        expect(comp.instantaneousVoltage).toBe(value);
        expect(Number.isFinite(value)).toBe(true);
    });
});
