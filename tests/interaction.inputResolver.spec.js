import { describe, expect, it } from 'vitest';
import * as InputResolver from '../src/ui/interaction/InputResolver.js';

function makeTarget(classes = []) {
    return {
        classList: {
            contains: (name) => classes.includes(name)
        }
    };
}

describe('InputResolver.resolveTerminalTarget', () => {
    it('returns terminal target when class matches', () => {
        const target = makeTarget(['terminal']);
        expect(InputResolver.resolveTerminalTarget(target)).toBe(target);
    });

    it('returns null when class does not match', () => {
        const target = makeTarget(['component']);
        expect(InputResolver.resolveTerminalTarget(target)).toBe(null);
    });

    it('returns null when classList has no contains method', () => {
        const target = { classList: {} };
        expect(InputResolver.resolveTerminalTarget(target)).toBe(null);
    });

    it('returns null when classList.contains throws', () => {
        const target = {
            classList: {
                contains: () => {
                    throw new TypeError('boom');
                }
            }
        };
        expect(InputResolver.resolveTerminalTarget(target)).toBe(null);
    });
});

describe('InputResolver.resolveProbeMarkerTarget', () => {
    it('returns closest wire probe marker', () => {
        const marker = { id: 'probe-marker' };
        const target = {
            closest: (selector) => selector === '.wire-probe-marker' ? marker : null
        };
        expect(InputResolver.resolveProbeMarkerTarget(target)).toBe(marker);
    });

    it('returns null when closest is unavailable', () => {
        expect(InputResolver.resolveProbeMarkerTarget({})).toBe(null);
    });
});

describe('InputResolver.resolvePointerType', () => {
    it('returns valid pointer type from event', () => {
        const ctx = { lastPrimaryPointerType: 'mouse' };
        expect(InputResolver.resolvePointerType.call(ctx, { pointerType: 'touch' })).toBe('touch');
    });

    it('falls back to last primary pointer type', () => {
        const ctx = { lastPrimaryPointerType: 'pen' };
        expect(InputResolver.resolvePointerType.call(ctx, { pointerType: 'unknown' })).toBe('pen');
    });
});

describe('InputResolver.isWireEndpointTarget', () => {
    it('returns true for endpoint classes', () => {
        expect(InputResolver.isWireEndpointTarget(makeTarget(['wire-endpoint']))).toBe(true);
        expect(InputResolver.isWireEndpointTarget(makeTarget(['wire-endpoint-hit']))).toBe(true);
    });

    it('returns false for non-endpoint classes', () => {
        expect(InputResolver.isWireEndpointTarget(makeTarget(['wire']))).toBe(false);
    });

    it('returns false when classList has no contains method', () => {
        expect(InputResolver.isWireEndpointTarget({ classList: {} })).toBe(false);
    });

    it('returns false when classList.contains throws', () => {
        const target = {
            classList: {
                contains: () => {
                    throw new TypeError('boom');
                }
            }
        };
        expect(InputResolver.isWireEndpointTarget(target)).toBe(false);
    });
});
