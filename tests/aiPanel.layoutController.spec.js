import { describe, expect, it } from 'vitest';
import { PanelLayoutController } from '../src/ui/ai/PanelLayoutController.js';

describe('PanelLayoutController', () => {
    it('stores dependency bag', () => {
        const deps = { panel: {}, app: {}, circuit: {} };
        const controller = new PanelLayoutController(deps);
        expect(controller.deps).toBe(deps);
    });
});
