import { describe, expect, it, vi } from 'vitest';
import { FirstRunGuideController } from '../src/ui/FirstRunGuideController.js';

describe('FirstRunGuideController mobile restore flow', () => {
    it('registers a restore candidate when user taps 稍后 without remember', () => {
        const ctx = {
            app: {
                mobileRestoreBroker: { register: vi.fn() }
            },
            rememberCheckboxEl: { checked: false },
            dismiss: vi.fn()
        };

        FirstRunGuideController.prototype.handleOverlayClick.call(ctx, {
            target: { dataset: { guideAction: 'skip' } }
        });

        expect(ctx.app.mobileRestoreBroker.register).toHaveBeenCalledWith(expect.objectContaining({
            id: 'guide-resume',
            source: 'guide',
            label: '继续上手',
            action: { type: 'show-guide' }
        }));
        expect(ctx.dismiss).toHaveBeenCalledWith({ remember: false, announce: false });
    });

    it('routes 开始使用 to a real phone entry instead of status-only feedback', () => {
        const ctx = {
            app: {
                mobileRestoreBroker: {
                    clear: vi.fn(),
                    register: vi.fn()
                },
                runMobileRestoreAction: vi.fn()
            },
            rememberCheckboxEl: { checked: false },
            dismiss: vi.fn()
        };

        FirstRunGuideController.prototype.handleOverlayClick.call(ctx, {
            target: { dataset: { guideAction: 'start' } }
        });

        expect(ctx.dismiss).toHaveBeenCalledWith({ remember: false, announce: false });
        expect(ctx.app.mobileRestoreBroker.clear).toHaveBeenCalledWith('guide');
        expect(ctx.app.runMobileRestoreAction).toHaveBeenCalledWith({ type: 'open-toolbox' });
    });
});
