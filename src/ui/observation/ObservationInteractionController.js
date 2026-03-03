import { createElement } from '../../utils/SafeDOM.js';
import { computeRangeFromBuffer } from './ObservationMath.js';
import { safeAddEventListener, safeInvoke } from '../../utils/RuntimeSafety.js';

function parseOptionalNumber(inputValue) {
    if (inputValue == null) return null;
    const trimmed = String(inputValue).trim();
    if (!trimmed) return null;
    const v = Number(trimmed);
    return Number.isFinite(v) ? v : null;
}

export class ObservationInteractionController {
    constructor(panel) {
        this.panel = panel;
    }

    bindTabRefresh() {
        const panel = this.panel;
        const tabBtn = document.querySelector('.panel-tab-btn[data-panel="observation"]');
        if (!tabBtn) return;
        safeAddEventListener(tabBtn, 'click', () => {
            panel?.refreshComponentOptions?.();
            panel?.refreshDialGauges?.();
            panel?.updatePresetButtonHints?.();
            panel?.requestRender?.({ onlyIfActive: false });
        });
    }

    bindPlotCanvasInteraction(plot) {
        const panel = this.panel;
        const canvas = plot?.elements?.canvas;
        if (!canvas) return;
        const getPoint = (event) => {
            const rect = safeInvoke(canvas, 'getBoundingClientRect');
            if (!rect) return null;
            const x = Number(event?.clientX) - Number(rect.left || 0);
            const y = Number(event?.clientY) - Number(rect.top || 0);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
            return {
                x,
                y,
                pointerType: event?.pointerType || 'mouse',
                time: typeof event?.timeStamp === 'number' ? event.timeStamp : Date.now()
            };
        };

        safeAddEventListener(canvas, 'pointerdown', (event) => {
            const point = getPoint(event);
            if (!point) return;
            plot.chartInteraction?.onPointerDown(point);
            panel?.syncLinkedCursorSnapshot?.(plot);
            plot._needsRedraw = true;
            panel?.requestRender?.({ onlyIfActive: true });
        });
        safeAddEventListener(canvas, 'pointermove', (event) => {
            const point = getPoint(event);
            if (!point) return;
            plot.chartInteraction?.onPointerMove(point);
            panel?.syncLinkedCursorSnapshot?.(plot);
            plot._needsRedraw = true;
            panel?.requestRender?.({ onlyIfActive: true });
        });
        safeAddEventListener(canvas, 'pointerup', () => {
            plot.chartInteraction?.onPointerUp();
            panel?.syncLinkedCursorSnapshot?.(plot);
            plot._needsRedraw = true;
            panel?.requestRender?.({ onlyIfActive: true });
        });
        safeAddEventListener(canvas, 'pointerleave', () => {
            plot.chartInteraction?.onPointerLeave();
            panel?.syncLinkedCursorSnapshot?.(plot);
            plot._needsRedraw = true;
            panel?.requestRender?.({ onlyIfActive: true });
        });
    }

    syncLinkedCursorSnapshot(plot) {
        const panel = this.panel;
        if (!plot?.chartInteraction || !plot.id) return;

        const dpr = window.devicePixelRatio || 1;
        const readout = plot.chartInteraction.getReadout?.();
        if (!readout) {
            if (panel?.linkedCursorSnapshot?.sourcePlotId === plot.id && !plot.chartInteraction.isFrozen?.()) {
                panel.linkedCursorSnapshot = null;
            }
            return;
        }

        const frame = plot._lastFrame;
        const canvasRect = safeInvoke(plot.elements?.canvas, 'getBoundingClientRect') || {};
        const canvasWidth = Math.max(1, Number(canvasRect.width) || 1);
        const canvasHeight = Math.max(1, Number(canvasRect.height) || 1);
        const width = Number.isFinite(frame?.innerW) && frame.innerW > 0
            ? frame.innerW / dpr
            : canvasWidth;
        const height = Number.isFinite(frame?.innerH) && frame.innerH > 0
            ? frame.innerH / dpr
            : canvasHeight;
        const padLeft = Number.isFinite(frame?.padL) ? frame.padL / dpr : 0;
        const padTop = Number.isFinite(frame?.padT) ? frame.padT / dpr : 0;
        const xRatio = Math.max(0, Math.min(1, (Number(readout.x || 0) - padLeft) / Math.max(width, 1e-9)));
        const yRatio = Math.max(0, Math.min(1, (Number(readout.y || 0) - padTop) / Math.max(height, 1e-9)));

        const snapshot = plot.chartInteraction.toLinkedSnapshot?.({
            width: canvasWidth,
            height: canvasHeight
        }) || {};
        panel.linkedCursorSnapshot = {
            sourcePlotId: plot.id,
            xRatio: Number.isFinite(xRatio) ? xRatio : snapshot.xRatio,
            yRatio: Number.isFinite(yRatio) ? yRatio : snapshot.yRatio,
            frozen: !!snapshot.frozen
        };
    }

    resolveLinkedOverlayPoint(plot, frame, dpr) {
        const panel = this.panel;
        const interaction = plot?.chartInteraction;
        if (!interaction || !frame) return null;

        const localPoint = interaction.getReadout?.();
        if (localPoint) {
            const x = Math.max(frame.padL, Math.min(frame.padL + frame.innerW, Number(localPoint.x || 0) * dpr));
            const y = Math.max(frame.padT, Math.min(frame.padT + frame.innerH, Number(localPoint.y || 0) * dpr));
            const xRatio = frame.innerW > 0 ? (x - frame.padL) / frame.innerW : 0;
            const yRatio = frame.innerH > 0 ? (y - frame.padT) / frame.innerH : 0;
            const xValue = frame.xMin + xRatio * (frame.xMax - frame.xMin);
            const yValue = frame.yMax - yRatio * (frame.yMax - frame.yMin);
            return {
                x,
                y,
                xValue,
                yValue,
                linked: false,
                frozen: !!interaction.isFrozen?.()
            };
        }

        const snapshot = panel?.linkedCursorSnapshot;
        if (!snapshot || snapshot.sourcePlotId === plot.id) return null;

        const xRatioRaw = Number(snapshot.xRatio);
        const yRatioRaw = Number(snapshot.yRatio);
        const xRatio = Number.isFinite(xRatioRaw) ? Math.max(0, Math.min(1, xRatioRaw)) : 0;
        const yRatio = Number.isFinite(yRatioRaw) ? Math.max(0, Math.min(1, yRatioRaw)) : 0;
        const targetXValue = frame.xMin + xRatio * (frame.xMax - frame.xMin);
        const nearest = panel?.findNearestPlotSampleByX?.(plot, targetXValue);
        const x = frame.padL + xRatio * frame.innerW;
        let y = frame.padT + yRatio * frame.innerH;
        let yValue = frame.yMax - yRatio * (frame.yMax - frame.yMin);
        if (nearest) {
            yValue = nearest.y;
            const ySpan = frame.yMax - frame.yMin;
            const normalizedY = Math.abs(ySpan) < 1e-12 ? 0.5 : (nearest.y - frame.yMin) / ySpan;
            y = frame.padT + (1 - normalizedY) * frame.innerH;
        }
        y = Math.max(frame.padT, Math.min(frame.padT + frame.innerH, y));

        return {
            x,
            y,
            xValue: Number.isFinite(nearest?.x) ? nearest.x : targetXValue,
            yValue,
            linked: true,
            frozen: !!snapshot.frozen
        };
    }

    findNearestPlotSampleByX(plot, targetX) {
        if (!plot?.buffer || plot.buffer.length <= 0 || !Number.isFinite(targetX)) return null;
        const finder = plot.chartInteraction;
        if (finder && typeof finder.findNearestSampleByX === 'function') {
            const found = finder.findNearestSampleByX(plot.buffer, targetX);
            plot._lastNearestLookupStats = found?.stats || null;
            return found?.point || null;
        }

        let best = null;
        let bestDistance = Infinity;
        plot.buffer.forEach?.((x, y) => {
            const distance = Math.abs(x - targetX);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = { x, y };
            }
        });
        return best;
    }

    createRangeControls(plot, axisKey, labelText) {
        const panel = this.panel;
        const axis = axisKey === 'x' ? plot.x : plot.y;
        const group = createElement('div', { className: 'form-group', attrs: { 'data-range-for': `${plot.id}-${axisKey}` } });
        group.appendChild(createElement('label', { textContent: labelText }));

        const toggleRow = createElement('div', { className: 'obs-range-toggle' });
        const autoToggle = createElement('input', { attrs: { type: 'checkbox' } });
        autoToggle.checked = !!axis.autoRange;
        toggleRow.appendChild(autoToggle);
        toggleRow.appendChild(createElement('span', { textContent: '自动范围' }));
        group.appendChild(toggleRow);

        const inputs = createElement('div', { className: 'obs-range-inputs' });
        const minInput = createElement('input', { attrs: { type: 'number', placeholder: 'min' } });
        const maxInput = createElement('input', { attrs: { type: 'number', placeholder: 'max' } });
        inputs.appendChild(minInput);
        inputs.appendChild(maxInput);
        group.appendChild(inputs);

        const syncVisibility = () => {
            inputs.style.display = autoToggle.checked ? 'none' : 'flex';
        };
        syncVisibility();

        safeAddEventListener(autoToggle, 'change', () => {
            axis.autoRange = !!autoToggle.checked;
            if (axis.autoRange) {
                axis.min = null;
                axis.max = null;
                minInput.value = '';
                maxInput.value = '';
            } else {
                const range = computeRangeFromBuffer(plot.buffer);
                if (range) {
                    const nextMin = axisKey === 'x' ? range.minX : range.minY;
                    const nextMax = axisKey === 'x' ? range.maxX : range.maxY;
                    axis.min = nextMin;
                    axis.max = nextMax;
                    minInput.value = String(nextMin);
                    maxInput.value = String(nextMax);
                }
            }
            syncVisibility();
            plot._needsRedraw = true;
            panel?.requestRender?.({ onlyIfActive: true });
            panel?.schedulePersist?.(0);
        });

        safeAddEventListener(minInput, 'change', () => {
            axis.min = parseOptionalNumber(minInput.value);
            plot._needsRedraw = true;
            panel?.requestRender?.({ onlyIfActive: true });
            panel?.schedulePersist?.(0);
        });
        safeAddEventListener(maxInput, 'change', () => {
            axis.max = parseOptionalNumber(maxInput.value);
            plot._needsRedraw = true;
            panel?.requestRender?.({ onlyIfActive: true });
            panel?.schedulePersist?.(0);
        });

        return group;
    }
}
