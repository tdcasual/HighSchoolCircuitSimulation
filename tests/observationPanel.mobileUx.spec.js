import { describe, expect, it, vi } from 'vitest';
import { ObservationPanel } from '../src/ui/ObservationPanel.js';
import { ObservationUIModes } from '../src/ui/observation/ObservationPreferences.js';

function createClassList(initial = []) {
    const tokens = new Set(initial);
    return {
        add(token) {
            tokens.add(token);
        },
        remove(token) {
            tokens.delete(token);
        },
        toggle(token, force) {
            if (typeof force === 'boolean') {
                if (force) tokens.add(token);
                else tokens.delete(token);
                return force;
            }
            if (tokens.has(token)) {
                tokens.delete(token);
                return false;
            }
            tokens.add(token);
            return true;
        },
        contains(token) {
            return tokens.has(token);
        }
    };
}

function createPlot() {
    return {
        elements: {
            card: {
                classList: createClassList()
            }
        }
    };
}

describe('ObservationPanel mobile UX behavior', () => {
    it('collapses plot controls in basic mode on phone layout', () => {
        const plot = createPlot();
        const ctx = {
            ui: { mode: ObservationUIModes.Basic },
            isPhoneLayout: () => true
        };

        ObservationPanel.prototype.applyMobileModeForPlotCard.call(ctx, plot);

        expect(plot.elements.card.classList.contains('observation-card-collapsed')).toBe(true);
    });

    it('keeps plot controls expanded in advanced mode on phone layout', () => {
        const plot = createPlot();
        const ctx = {
            ui: { mode: ObservationUIModes.Advanced },
            isPhoneLayout: () => true
        };

        ObservationPanel.prototype.applyMobileModeForPlotCard.call(ctx, plot);

        expect(plot.elements.card.classList.contains('observation-card-collapsed')).toBe(false);
    });

    it('re-applies card layout state when responsive mode changes', () => {
        const plotA = createPlot();
        const plotB = createPlot();
        const applySpy = vi.fn();
        const ctx = {
            plots: [plotA, plotB],
            applyMobileModeForPlotCard: applySpy,
            requestRender: vi.fn()
        };

        ObservationPanel.prototype.onLayoutModeChanged.call(ctx, 'phone');

        expect(applySpy).toHaveBeenCalledTimes(2);
        expect(ctx.requestRender).toHaveBeenCalledWith({ onlyIfActive: true });
    });
});
