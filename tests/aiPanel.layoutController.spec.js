import { describe, expect, it, vi } from 'vitest';
import { AIPanel } from '../src/ui/AIPanel.js';
import { PanelLayoutController } from '../src/ui/ai/PanelLayoutController.js';

describe('PanelLayoutController', () => {
    it('stores dependency bag', () => {
        const deps = { panel: {}, app: {}, circuit: {} };
        const controller = new PanelLayoutController(deps);
        expect(controller.deps).toBe(deps);
    });

    it('delegates setPanelCollapsed to PanelLayoutController', () => {
        const panel = {
            layoutController: {
                setPanelCollapsed: vi.fn()
            }
        };

        AIPanel.prototype.setPanelCollapsed.call(panel, true);

        expect(panel.layoutController.setPanelCollapsed).toHaveBeenCalledWith(true, undefined);
    });
});
