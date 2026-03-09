import { describe, expect, it, vi } from 'vitest';

function createProjectionContext({ connectedIds = [] } = {}) {
    const connected = new Set(connectedIds);
    return {
        components: new Map(),
        isComponentConnected(id) {
            return connected.has(id);
        },
        isIdealVoltmeter(comp) {
            return comp.type === 'Voltmeter' && comp.resistance === Infinity;
        },
        markSolverCircuitDirty: vi.fn()
    };
}

describe('CircuitResultProjectionService', () => {
    it('zeros disconnected component display state', async () => {
        const { CircuitResultProjectionService } = await import('../src/core/services/CircuitResultProjectionService.js');
        const service = new CircuitResultProjectionService();
        const led = {
            id: 'LED1',
            type: 'LED',
            nodes: [0, 1],
            currentValue: 1,
            voltageValue: 2,
            powerValue: 3,
            brightness: 1,
            conducting: true,
            _isShorted: true
        };
        const context = createProjectionContext();
        context.components.set(led.id, led);

        service.applyStepResults(context, {
            valid: true,
            currents: new Map([[led.id, 0.02]]),
            voltages: [5, 0]
        }, 0.01);

        expect(led.currentValue).toBe(0);
        expect(led.voltageValue).toBe(0);
        expect(led.powerValue).toBe(0);
        expect(led.brightness).toBe(0);
        expect(led.conducting).toBe(false);
        expect(led._isShorted).toBe(false);
    });

    it('blows connected fuse and marks solver dirty when i2t threshold is exceeded', async () => {
        const { CircuitResultProjectionService } = await import('../src/core/services/CircuitResultProjectionService.js');
        const service = new CircuitResultProjectionService();
        const fuse = {
            id: 'F1',
            type: 'Fuse',
            nodes: [0, 1],
            blown: false,
            i2tAccum: 0,
            ratedCurrent: 2,
            i2tThreshold: 1
        };
        const context = createProjectionContext({ connectedIds: [fuse.id] });
        context.components.set(fuse.id, fuse);

        service.applyStepResults(context, {
            valid: true,
            currents: new Map([[fuse.id, 2]]),
            voltages: [3, 0]
        }, 0.5);

        expect(fuse.blown).toBe(true);
        expect(fuse.i2tAccum).toBeGreaterThanOrEqual(1);
        expect(context.markSolverCircuitDirty).toHaveBeenCalledTimes(1);
    });
});
