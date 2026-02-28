import { afterEach, describe, expect, it, vi } from 'vitest';
import * as WireInteractions from '../src/ui/interaction/WireInteractions.js';
import { installInteractionCoreCircuitWireSearchDelegates } from '../src/ui/interaction/InteractionCoreCircuitWireSearchDelegates.js';

class InteractionHarness {}
installInteractionCoreCircuitWireSearchDelegates(InteractionHarness);

describe('InteractionCoreCircuitWireSearchDelegates', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('forwards excludeWireIds when searching nearby wire endpoints', () => {
        const spy = vi.spyOn(WireInteractions, 'findNearbyWireEndpoint').mockReturnValue(null);
        const instance = new InteractionHarness();
        const excludeWireEndpoints = new Set(['W1:a']);
        const excludeWireIds = new Set(['W1', 'W2']);

        instance.findNearbyWireEndpoint(
            12,
            34,
            18,
            'W1',
            'a',
            excludeWireEndpoints,
            excludeWireIds
        );

        expect(spy).toHaveBeenCalledWith(
            12,
            34,
            18,
            'W1',
            'a',
            excludeWireEndpoints,
            excludeWireIds
        );
        expect(spy.mock.contexts[0]).toBe(instance);
    });
});
