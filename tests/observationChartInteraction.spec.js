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

    it('builds linked snapshot and resolves point for another plot size', () => {
        const source = new ObservationChartInteraction();
        source.onPointerDown({ x: 50, y: 25, pointerType: 'mouse', time: 0 });

        const snapshot = source.toLinkedSnapshot({ width: 100, height: 50 });
        expect(snapshot).toEqual({
            xRatio: 0.5,
            yRatio: 0.5,
            frozen: false
        });

        const target = new ObservationChartInteraction();
        const linkedPoint = target.resolvePointFromLinkedSnapshot(snapshot, { width: 200, height: 80 });
        expect(linkedPoint).toEqual({
            x: 100,
            y: 40,
            frozen: false
        });
    });

    it('clamps linked snapshot ratios into valid range', () => {
        const interaction = new ObservationChartInteraction();
        const point = interaction.resolvePointFromLinkedSnapshot({
            xRatio: 1.8,
            yRatio: -0.2,
            frozen: true
        }, {
            width: 120,
            height: 60
        });

        expect(point).toEqual({
            x: 120,
            y: 0,
            frozen: true
        });
    });

    it('clears transient touch readout on release unless the cursor was explicitly frozen', () => {
        const interaction = new ObservationChartInteraction({ holdMs: 350 });

        interaction.onPointerDown({ x: 40, y: 18, pointerType: 'touch', time: 0 });
        interaction.onPointerMove({ x: 52, y: 24, pointerType: 'touch', time: 120 });
        expect(interaction.getReadout()).toEqual({ x: 52, y: 24 });

        interaction.onPointerUp();

        expect(interaction.isFrozen()).toBe(false);
        expect(interaction.getReadout()).toBe(null);
    });

    it('keeps frozen readout anchored across follow-up pointer moves', () => {
        const interaction = new ObservationChartInteraction({ holdMs: 300 });

        interaction.onPointerDown({ x: 80, y: 30, pointerType: 'touch', time: 0 });
        interaction.onPointerMove({ x: 88, y: 36, pointerType: 'touch', time: 360 });
        expect(interaction.isFrozen()).toBe(true);

        interaction.onPointerMove({ x: 120, y: 90, pointerType: 'touch', time: 420 });

        expect(interaction.getReadout()).toEqual({ x: 88, y: 36 });
    });
});