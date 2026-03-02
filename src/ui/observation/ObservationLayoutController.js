import { ObservationUIModes } from './ObservationPreferences.js';
import {
    safeClassListToggle,
    safeInvoke,
    safeSetAttribute
} from '../../utils/RuntimeSafety.js';

function hasLayoutModePhoneBodyClass() {
    if (typeof document === 'undefined') return false;
    return !!safeInvoke(document.body?.classList, 'contains', ['layout-mode-phone'], false);
}

export class ObservationLayoutController {
    constructor(panel) {
        this.panel = panel;
    }

    updateModeToggleUI() {
        const panel = this.panel;
        const mode = panel?.ui?.mode === ObservationUIModes.Advanced
            ? ObservationUIModes.Advanced
            : ObservationUIModes.Basic;
        Object.entries(panel?.modeButtons || {}).forEach(([key, button]) => {
            if (!button) return;
            safeClassListToggle(button, 'active', key === mode);
        });
    }

    isPhoneLayout() {
        if (hasLayoutModePhoneBodyClass()) {
            return true;
        }
        return this.panel?.app?.responsiveLayout?.mode === 'phone';
    }

    applyMobileModeForPlotCard(plot) {
        const panel = this.panel;
        const card = plot?.elements?.card;
        if (!card?.classList) return;

        const phoneLayout = typeof panel?.isPhoneLayout === 'function' && panel?.layoutController !== this
            ? !!panel.isPhoneLayout()
            : this.isPhoneLayout();
        const autoCollapse = panel?.ui?.mode !== ObservationUIModes.Advanced && phoneLayout;
        const forcedExpanded = plot?.controlsOverride === 'expanded';
        const forcedCollapsed = plot?.controlsOverride === 'collapsed';
        const shouldCollapse = forcedCollapsed || (!forcedExpanded && autoCollapse);

        safeClassListToggle(card, 'observation-card-collapsed', shouldCollapse);
        safeClassListToggle(plot?.elements?.controls, 'observation-controls-collapsed', shouldCollapse);

        const collapseBtn = plot?.elements?.collapseBtn;
        if (collapseBtn) {
            collapseBtn.textContent = shouldCollapse ? '展开设置' : '收起设置';
            safeSetAttribute(collapseBtn, 'aria-expanded', shouldCollapse ? 'false' : 'true');
            safeSetAttribute(collapseBtn, 'title', shouldCollapse ? '展开参数设置' : '收起参数设置');
        }
    }

    applyLayoutModeToAllPlotCards() {
        const panel = this.panel;
        for (const plot of panel?.plots || []) {
            if (typeof panel?.applyMobileModeForPlotCard === 'function' && panel?.layoutController !== this) {
                panel.applyMobileModeForPlotCard(plot);
            } else {
                this.applyMobileModeForPlotCard(plot);
            }
            plot._needsRedraw = true;
        }
    }

    onLayoutModeChanged() {
        const panel = this.panel;
        if (typeof panel?.applyLayoutModeToAllPlotCards === 'function' && panel?.layoutController !== this) {
            panel.applyLayoutModeToAllPlotCards();
        } else {
            this.applyLayoutModeToAllPlotCards();
        }
        panel?.updatePresetButtonHints?.();
        panel?.requestRender?.({ onlyIfActive: true });
    }

    resizeCanvasToDisplaySize(canvas) {
        if (!canvas) return;
        const rect = safeInvoke(canvas, 'getBoundingClientRect') || {};
        const dpr = window.devicePixelRatio || 1;
        const width = Number.isFinite(rect?.width) ? rect.width : 0;
        const height = Number.isFinite(rect?.height) ? rect.height : 180;
        const displayW = Math.max(1, Math.floor(width));
        const displayH = Math.max(1, Math.floor(height || 180));
        const internalW = Math.floor(displayW * dpr);
        const internalH = Math.floor(displayH * dpr);
        if (canvas.width !== internalW || canvas.height !== internalH) {
            canvas.width = internalW;
            canvas.height = internalH;
        }
    }
}
