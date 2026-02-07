import { describe, expect, it, vi } from 'vitest';
import { AIPanel } from '../src/ui/AIPanel.js';
import { SettingsController } from '../src/ui/ai/SettingsController.js';

describe('SettingsController', () => {
    it('stores dependency bag', () => {
        const deps = { panel: {}, app: {}, circuit: {} };
        const controller = new SettingsController(deps);
        expect(controller.deps).toBe(deps);
    });

    it('delegates saveSettings to SettingsController', () => {
        const panel = {
            settingsController: {
                saveSettings: vi.fn()
            }
        };

        AIPanel.prototype.saveSettings.call(panel);

        expect(panel.settingsController.saveSettings).toHaveBeenCalledTimes(1);
    });
});
