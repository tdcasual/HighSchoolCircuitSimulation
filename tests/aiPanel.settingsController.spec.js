import { describe, expect, it } from 'vitest';
import { SettingsController } from '../src/ui/ai/SettingsController.js';

describe('SettingsController', () => {
    it('stores dependency bag', () => {
        const deps = { panel: {}, app: {}, circuit: {} };
        const controller = new SettingsController(deps);
        expect(controller.deps).toBe(deps);
    });
});
