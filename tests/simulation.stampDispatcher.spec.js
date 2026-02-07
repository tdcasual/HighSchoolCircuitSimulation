import { describe, expect, it, vi } from 'vitest';
import { StampDispatcher } from '../src/core/simulation/StampDispatcher.js';

describe('StampDispatcher', () => {
    it('routes resistor to stampResistor handler', () => {
        const stampResistor = vi.fn();
        const fallback = vi.fn();
        const dispatcher = new StampDispatcher({
            stampResistor,
            default: fallback
        });

        dispatcher.stamp({ type: 'Resistor' }, { A: [], z: [] });

        expect(stampResistor).toHaveBeenCalledTimes(1);
        expect(fallback).not.toHaveBeenCalled();
    });
});
