import {
    computeNiceTicks,
    computeRangeFromBuffer,
    stabilizeAutoRangeWindow
} from './ObservationMath.js';

export class ObservationRenderController {
    constructor(panel) {
        this.panel = panel;
    }

    requestRender(options = {}) {
        const panel = this.panel;
        if (options.onlyIfActive && !panel?.isObservationActive?.()) return;
        if (panel?._renderRaf) return;
        if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') return;

        panel._renderRaf = window.requestAnimationFrame(() => {
            panel._renderRaf = 0;
            panel?.renderAll?.();
        });
    }

    renderAll() {
        const panel = this.panel;
        for (const plot of panel?.plots || []) {
            if (!plot._needsRedraw) continue;
            panel?.renderPlot?.(plot);
            plot._needsRedraw = false;
        }

        const gauges = panel?.gauges;
        if (!(gauges instanceof Map)) return;
        for (const gauge of gauges.values()) {
            if (!gauge._needsRedraw) continue;
            panel?.renderGauge?.(gauge);
            gauge._needsRedraw = false;
        }
    }

    computePlotFrame(plot, canvas, dpr) {
        const w = canvas.width;
        const h = canvas.height;

        const padL = 46 * dpr;
        const padR = 10 * dpr;
        const padT = 10 * dpr;
        const padB = 28 * dpr;
        const innerW = Math.max(1, w - padL - padR);
        const innerH = Math.max(1, h - padT - padB);

        plot._autoRangeWindow = plot._autoRangeWindow && typeof plot._autoRangeWindow === 'object'
            ? plot._autoRangeWindow
            : { x: null, y: null };
        const autoRange = computeRangeFromBuffer(plot.buffer);
        let xAutoWindow = null;
        let yAutoWindow = null;
        if (plot.x.autoRange && autoRange) {
            xAutoWindow = stabilizeAutoRangeWindow({
                min: autoRange.minX,
                max: autoRange.maxX
            }, plot._autoRangeWindow.x, {
                paddingRatio: 0.03,
                expandRatio: 0.02,
                shrinkDeadbandRatio: 0.14,
                shrinkSmoothing: 0.2
            });
            plot._autoRangeWindow.x = xAutoWindow;
        } else {
            plot._autoRangeWindow.x = null;
        }
        if (plot.y.autoRange && autoRange) {
            yAutoWindow = stabilizeAutoRangeWindow({
                min: autoRange.minY,
                max: autoRange.maxY
            }, plot._autoRangeWindow.y, {
                paddingRatio: 0.05,
                expandRatio: 0.025,
                shrinkDeadbandRatio: 0.16,
                shrinkSmoothing: 0.2
            });
            plot._autoRangeWindow.y = yAutoWindow;
        } else {
            plot._autoRangeWindow.y = null;
        }

        let xMin = plot.x.autoRange ? xAutoWindow?.min : plot.x.min;
        let xMax = plot.x.autoRange ? xAutoWindow?.max : plot.x.max;
        let yMin = plot.y.autoRange ? yAutoWindow?.min : plot.y.min;
        let yMax = plot.y.autoRange ? yAutoWindow?.max : plot.y.max;

        if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || !Number.isFinite(yMin) || !Number.isFinite(yMax)) {
            return null;
        }

        if (xMin === xMax) {
            const pad = xMin === 0 ? 1 : Math.abs(xMin) * 0.1;
            xMin -= pad;
            xMax += pad;
        }
        if (yMin === yMax) {
            const pad = yMin === 0 ? 1 : Math.abs(yMin) * 0.1;
            yMin -= pad;
            yMax += pad;
        }
        if (xMin > xMax) [xMin, xMax] = [xMax, xMin];
        if (yMin > yMax) [yMin, yMax] = [yMax, yMin];

        if (!plot.x.autoRange) {
            const xPad = (xMax - xMin) * 0.03;
            xMin -= xPad;
            xMax += xPad;
        }
        if (!plot.y.autoRange) {
            const yPad = (yMax - yMin) * 0.05;
            yMin -= yPad;
            yMax += yPad;
        }

        const xTicks = computeNiceTicks(xMin, xMax, 5);
        const yTicks = computeNiceTicks(yMin, yMax, 5);

        return {
            w,
            h,
            dpr,
            padL,
            padR,
            padT,
            padB,
            innerW,
            innerH,
            xMin,
            xMax,
            yMin,
            yMax,
            xTicks,
            yTicks
        };
    }
}
