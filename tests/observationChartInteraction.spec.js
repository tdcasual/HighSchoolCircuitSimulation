import { describe, expect, it } from 'vitest';
import { ObservationChartInteraction } from '../src/ui/observation/ObservationChartInteraction.js';

describe('ObservationChartInteraction', () => {
    it('freezes readout on long press and toggles off on second tap', () => {
        const interaction = new ObservationChartInteraction({ holdMs: 350 });

        interaction.onPointerDown({ x: 100, y: 60, pointerType: 'touch', time: 0 });
        interaction.onPointerMove({ x: 110, y: 62, time: 450 });

        expect(interaction.isFrozen()).toBe(true);
        expect(interaction.getReadout()).toEqual({ x: 110, y: 62 });

        interaction.onPointerDown({ x: 110, y: 62, pointerType: 'touch', time: 900 });
        expect(interaction.isFrozen()).toBe(false);
    });
});
