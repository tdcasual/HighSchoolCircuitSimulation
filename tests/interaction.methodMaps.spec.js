import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { interactionMethodMaps } from '../src/ui/interaction/interactionMethodMaps.js';
import { interactionCoreCircuitWireSearchMethods } from '../src/ui/interaction/InteractionCoreCircuitWireSearchDelegates.js';
import { interactionCoreInputPlacementMethods } from '../src/ui/interaction/InteractionCoreInputPlacementDelegates.js';
import * as WireInteractions from '../src/ui/interaction/WireInteractions.js';

function listInteractionJs(directory) {
    const files = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const abs = join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...listInteractionJs(abs));
            continue;
        }
        if (entry.isFile() && entry.name.endsWith('.js')) files.push(abs);
    }
    return files;
}

describe('InteractionManager composed method maps', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('ships findNearbyWireEndpoint from the composed map onto InteractionManager instances', () => {
        expect(interactionMethodMaps.findNearbyWireEndpoint)
            .toBe(interactionCoreCircuitWireSearchMethods.findNearbyWireEndpoint);

        const spy = vi.spyOn(WireInteractions, 'findNearbyWireEndpoint').mockReturnValue(null);
        const instance = {};
        instance.findNearbyWireEndpoint = interactionMethodMaps.findNearbyWireEndpoint;
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

    it('ships getInteractionModeSnapshot from the composed placement map', () => {
        expect(interactionMethodMaps.getInteractionModeSnapshot)
            .toBe(interactionCoreInputPlacementMethods.getInteractionModeSnapshot);
        expect(typeof interactionMethodMaps.getInteractionModeSnapshot).toBe('function');
    });

    it('installs method maps from one production site', () => {
        const root = resolve(process.cwd(), 'src/ui/interaction');
        const callers = listInteractionJs(root).filter((file) => {
            if (file.endsWith('/assignInteractionMethods.js')) return false;
            return readFileSync(file, 'utf8').includes("from './assignInteractionMethods.js'");
        });
        expect(callers.map((file) => file.slice(root.length + 1))).toEqual([
            'interactionMethodMaps.js'
        ]);
    });
});
