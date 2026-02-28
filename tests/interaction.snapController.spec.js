import { describe, expect, it, vi } from 'vitest';
import * as SnapController from '../src/ui/interaction/SnapController.js';
import { TERMINAL_HIT_RADIUS_PX } from '../src/components/Component.js';

describe('SnapController', () => {
    it('uses larger adaptive threshold for touch pointers', () => {
        const context = { lastPrimaryPointerType: 'mouse' };
        expect(SnapController.getAdaptiveSnapThreshold.call(context, { pointerType: 'touch', threshold: 12 })).toBe(24);
        expect(SnapController.getAdaptiveSnapThreshold.call(context, { pointerType: 'pen', threshold: 12 })).toBe(18);
        expect(SnapController.getAdaptiveSnapThreshold.call(context, { pointerType: 'mouse', threshold: 12 })).toBe(12);
    });

    it('normalizes snap threshold by zoom scale', () => {
        const zoomIn = { lastPrimaryPointerType: 'mouse', scale: 2 };
        const zoomOut = { lastPrimaryPointerType: 'mouse', scale: 0.5 };
        const invalidScale = { lastPrimaryPointerType: 'mouse', scale: 0 };

        expect(SnapController.getAdaptiveSnapThreshold.call(zoomIn, { pointerType: 'mouse', threshold: 15 })).toBe(7.5);
        expect(SnapController.getAdaptiveSnapThreshold.call(zoomOut, { pointerType: 'mouse', threshold: 15 })).toBe(30);
        expect(SnapController.getAdaptiveSnapThreshold.call(invalidScale, { pointerType: 'mouse', threshold: 15 })).toBe(15);
    });

    it('boosts threshold for touch wire-endpoint drag intent', () => {
        const context = { lastPrimaryPointerType: 'mouse', scale: 1 };
        expect(
            SnapController.getAdaptiveSnapThreshold.call(context, {
                pointerType: 'touch',
                snapIntent: 'wire-endpoint-drag',
                threshold: 15
            })
        ).toBe(32);
    });

    it('adds extra endpoint snap assist for slow touch drag speed', () => {
        const context = { lastPrimaryPointerType: 'mouse', scale: 1 };
        const slow = SnapController.getAdaptiveSnapThreshold.call(context, {
            pointerType: 'touch',
            snapIntent: 'wire-endpoint-drag',
            threshold: 15,
            dragSpeedPxPerMs: 0.05
        });
        const fast = SnapController.getAdaptiveSnapThreshold.call(context, {
            pointerType: 'touch',
            snapIntent: 'wire-endpoint-drag',
            threshold: 15,
            dragSpeedPxPerMs: 0.8
        });

        expect(slow).toBeGreaterThan(32);
        expect(fast).toBe(32);
    });

    it('finds nearby terminal from renderer terminal positions', () => {
        const context = {
            circuit: {
                components: new Map([
                    ['R1', { type: 'Resistor' }]
                ])
            },
            renderer: {
                getTerminalPosition: vi.fn((id, ti) => {
                    if (id === 'R1' && ti === 0) return { x: 100, y: 100 };
                    if (id === 'R1' && ti === 1) return { x: 140, y: 100 };
                    return null;
                })
            }
        };

        const result = SnapController.findNearbyTerminal.call(context, 104, 103, 10);
        expect(result).toEqual({ componentId: 'R1', terminalIndex: 0 });
    });

    it('finds the nearest terminal when multiple are within threshold', () => {
        const context = {
            circuit: {
                components: new Map([
                    ['R1', { type: 'Resistor' }],
                    ['R2', { type: 'Resistor' }]
                ])
            },
            renderer: {
                getTerminalPosition: vi.fn((id, ti) => {
                    if (id === 'R1' && ti === 0) return { x: 100, y: 100 };
                    if (id === 'R1' && ti === 1) return { x: 140, y: 100 };
                    if (id === 'R2' && ti === 0) return { x: 110, y: 100 };
                    if (id === 'R2' && ti === 1) return { x: 150, y: 100 };
                    return null;
                })
            }
        };

        const result = SnapController.findNearbyTerminal.call(context, 109, 100, 15);
        expect(result).toEqual({ componentId: 'R2', terminalIndex: 0 });
    });

    it('uses terminal hit radius as the lower-bound for terminal snapping threshold', () => {
        const context = {
            getAdaptiveSnapThreshold: vi.fn(() => 7.5),
            findNearbyTerminal: vi.fn(() => null),
            findNearbyWireEndpoint: vi.fn(() => null),
            findNearbyWireSegment: vi.fn(() => null)
        };

        SnapController.snapPoint.call(context, 100, 100, { pointerType: 'mouse' });

        expect(context.findNearbyTerminal).toHaveBeenCalledWith(
            100,
            100,
            TERMINAL_HIT_RADIUS_PX,
            undefined
        );
    });

    it('prefers terminal over wire endpoint and grid', () => {
        const context = {
            getAdaptiveSnapThreshold: vi.fn(() => 15),
            findNearbyTerminal: vi.fn(() => ({ componentId: 'R1', terminalIndex: 1 })),
            findNearbyWireEndpoint: vi.fn(() => ({ x: 11, y: 22, wireId: 'W1', end: 'a' })),
            findNearbyWireSegment: vi.fn(() => ({ x: 44, y: 55, wireId: 'W2' })),
            renderer: {
                getTerminalPosition: vi.fn(() => ({ x: 120, y: 80 }))
            }
        };

        const out = SnapController.snapPoint.call(context, 117, 83, { allowWireSegmentSnap: true, pointerType: 'mouse' });
        expect(out).toEqual({
            x: 120,
            y: 80,
            snap: {
                type: 'terminal',
                componentId: 'R1',
                terminalIndex: 1
            }
        });
    });

    it('passes excludeWireIds to wire endpoint finder', () => {
        const context = {
            getAdaptiveSnapThreshold: vi.fn(() => 15),
            findNearbyTerminal: vi.fn(() => null),
            findNearbyWireEndpoint: vi.fn(() => null),
            findNearbyWireSegment: vi.fn(() => null)
        };
        const excludeWireIds = new Set(['W1', 'W2']);

        const out = SnapController.snapPoint.call(context, 10, 20, { excludeWireIds, pointerType: 'mouse' });

        expect(out.snap?.type).toBe('grid');
        expect(context.findNearbyWireEndpoint).toHaveBeenCalledWith(
            10,
            20,
            15,
            undefined,
            undefined,
            undefined,
            excludeWireIds
        );
    });

    it('passes excludeTerminalKeys to terminal finder', () => {
        const context = {
            getAdaptiveSnapThreshold: vi.fn(() => 15),
            findNearbyTerminal: vi.fn(() => null),
            findNearbyWireEndpoint: vi.fn(() => null),
            findNearbyWireSegment: vi.fn(() => null)
        };
        const excludeTerminalKeys = new Set(['R1:0']);

        const out = SnapController.snapPoint.call(context, 10, 20, { excludeTerminalKeys, pointerType: 'touch' });

        expect(out.snap?.type).toBe('grid');
        expect(context.findNearbyTerminal).toHaveBeenCalledWith(
            10,
            20,
            TERMINAL_HIT_RADIUS_PX,
            excludeTerminalKeys
        );
    });

    it('uses boosted threshold for touch endpoint drag snapping', () => {
        let capturedThreshold = 0;
        const context = {
            getAdaptiveSnapThreshold: SnapController.getAdaptiveSnapThreshold,
            findNearbyTerminal: vi.fn(() => null),
            findNearbyWireSegment: vi.fn(() => null),
            findNearbyWireEndpoint: vi.fn((_x, _y, threshold) => {
                capturedThreshold = threshold;
                return threshold >= 32 ? { wireId: 'W1', end: 'a', x: 64, y: 48 } : null;
            }),
            lastPrimaryPointerType: 'mouse'
        };

        const out = SnapController.snapPoint.call(context, 60, 50, {
            pointerType: 'touch',
            snapIntent: 'wire-endpoint-drag'
        });

        expect(capturedThreshold).toBeGreaterThanOrEqual(32);
        expect(out.snap).toEqual({ type: 'wire-endpoint', wireId: 'W1', end: 'a' });
    });
});
