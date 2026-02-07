import { describe, expect, it, vi } from 'vitest';
import * as SnapController from '../src/ui/interaction/SnapController.js';

describe('SnapController', () => {
    it('uses larger adaptive threshold for touch pointers', () => {
        const context = { lastPrimaryPointerType: 'mouse' };
        expect(SnapController.getAdaptiveSnapThreshold.call(context, { pointerType: 'touch', threshold: 12 })).toBe(24);
        expect(SnapController.getAdaptiveSnapThreshold.call(context, { pointerType: 'pen', threshold: 12 })).toBe(18);
        expect(SnapController.getAdaptiveSnapThreshold.call(context, { pointerType: 'mouse', threshold: 12 })).toBe(12);
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
});
