import { describe, expect, it, vi } from 'vitest';
import { AppRuntimeV2 } from '../src/app/AppRuntimeV2.js';

describe('AppRuntimeV2 mobile restore action executor', () => {
    it('routes open-side-panel-tab action through runtime executor', () => {
        const app = {
            responsiveLayout: { openDrawer: vi.fn() },
            interaction: { activateSidePanelTab: vi.fn() }
        };

        const result = AppRuntimeV2.prototype.runMobileRestoreAction.call(app, {
            type: 'open-side-panel-tab',
            panel: 'observation'
        });

        expect(app.responsiveLayout.openDrawer).toHaveBeenCalledWith('side-panel');
        expect(app.interaction.activateSidePanelTab).toHaveBeenCalledWith('observation');
        expect(result).toBe(true);
    });

    it('collapses ai panel while focusing canvas for edit resume', () => {
        const app = {
            responsiveLayout: { focusCanvas: vi.fn(() => true) },
            aiPanel: { setPanelCollapsed: vi.fn() }
        };

        const result = AppRuntimeV2.prototype.runMobileRestoreAction.call(app, {
            type: 'focus-canvas'
        });

        expect(app.aiPanel.setPanelCollapsed).toHaveBeenCalledWith(true);
        expect(app.responsiveLayout.focusCanvas).toHaveBeenCalled();
        expect(result).toBe(true);
    });
});
