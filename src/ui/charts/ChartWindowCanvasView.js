import { formatNumberCompact } from '../observation/ObservationMath.js';

export class ChartWindowCanvasView {
    constructor(controller) {
        this.controller = controller;
    }

    clearData() {
        const controller = this.controller;
        const seriesBuffers = controller.workspace.getChartSeriesBuffers(controller.state.id);
        if (!(seriesBuffers instanceof Map)) return;
        for (const buffer of seriesBuffers.values()) {
            buffer?.clear?.();
        }
        controller._autoRangeWindow = { x: null, y: null };
        controller._latestText = '最新: —';
        if (controller.elements.latest) {
            controller.elements.latest.textContent = controller._latestText;
        }
        controller._needsRedraw = true;
    }

    markDirty() {
        this.controller._needsRedraw = true;
    }

    resizeCanvasToDisplaySize() {
        const controller = this.controller;
        const canvas = controller.elements.canvas;
        if (!canvas) return;
        const dpr = typeof window !== 'undefined' && Number.isFinite(window.devicePixelRatio)
            ? window.devicePixelRatio
            : 1;
        const rect = canvas.getBoundingClientRect?.();
        const cssWidth = Math.max(1, Math.round(rect?.width || canvas.clientWidth || controller.state.frame?.width || 320));
        const cssHeight = Math.max(1, Math.round(rect?.height || canvas.clientHeight || 180));
        const targetW = Math.max(1, Math.round(cssWidth * dpr));
        const targetH = Math.max(1, Math.round(cssHeight * dpr));
        if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width = targetW;
            canvas.height = targetH;
            controller._needsRedraw = true;
        }
    }

    render() {
        const controller = this.controller;
        if (!controller._needsRedraw) return;
        const canvas = controller.elements.canvas;
        if (!canvas) return;
        this.resizeCanvasToDisplaySize();

        const ctx = canvas.getContext?.('2d');
        if (!ctx) return;

        const dpr = typeof window !== 'undefined' && Number.isFinite(window.devicePixelRatio)
            ? window.devicePixelRatio
            : 1;

        const seriesBuffers = controller.workspace.getChartSeriesBuffers(controller.state.id);
        const frame = controller.workspace.projectionService.computeFrame({
            chart: controller.state,
            seriesBuffers,
            autoRangeWindow: controller._autoRangeWindow,
            width: canvas.width,
            height: canvas.height,
            dpr
        });

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (!frame) {
            ctx.fillStyle = '#64748b';
            ctx.font = `${12 * dpr}px sans-serif`;
            ctx.fillText('暂无数据，运行模拟后开始采样', 20 * dpr, 24 * dpr);
            controller._latestText = '最新: —';
            if (controller.elements.latest) {
                controller.elements.latest.textContent = controller._latestText;
            }
            controller._needsRedraw = false;
            return;
        }

        controller._autoRangeWindow = frame.nextAutoRangeWindow || controller._autoRangeWindow;

        ctx.strokeStyle = 'rgba(15, 23, 42, 0.1)';
        ctx.lineWidth = Math.max(1, dpr);
        frame.xTicks.forEach((tick) => {
            const x = frame.xToPx(tick);
            ctx.beginPath();
            ctx.moveTo(x, frame.padT);
            ctx.lineTo(x, frame.padT + frame.innerH);
            ctx.stroke();
        });
        frame.yTicks.forEach((tick) => {
            const y = frame.yToPx(tick);
            ctx.beginPath();
            ctx.moveTo(frame.padL, y);
            ctx.lineTo(frame.padL + frame.innerW, y);
            ctx.stroke();
        });

        ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)';
        ctx.beginPath();
        ctx.moveTo(frame.padL, frame.padT);
        ctx.lineTo(frame.padL, frame.padT + frame.innerH);
        ctx.lineTo(frame.padL + frame.innerW, frame.padT + frame.innerH);
        ctx.stroke();

        ctx.fillStyle = '#334155';
        ctx.font = `${11 * dpr}px sans-serif`;
        frame.xTicks.forEach((tick) => {
            const px = frame.xToPx(tick);
            ctx.fillText(formatNumberCompact(tick, 3), px - 10 * dpr, frame.padT + frame.innerH + 18 * dpr);
        });
        frame.yTicks.forEach((tick) => {
            const py = frame.yToPx(tick);
            ctx.fillText(formatNumberCompact(tick, 3), 4 * dpr, py + 4 * dpr);
        });

        const axisMeaning = controller.resolveAxisMeaningLabels();
        ctx.fillStyle = '#1f2937';
        ctx.font = `${11 * dpr}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(`X: ${axisMeaning.xLabel}`, frame.padL + frame.innerW / 2, canvas.height - 6 * dpr);

        ctx.save();
        ctx.translate(12 * dpr, frame.padT + frame.innerH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`Y: ${axisMeaning.yLabel}`, 0, 0);
        ctx.restore();

        const visibleSeries = (controller.state.series || []).filter((series) => series.visible !== false);
        const drawSeries = visibleSeries.length > 0 ? visibleSeries : (controller.state.series || []);

        let latestPoint = null;
        drawSeries.forEach((series) => {
            const buffer = seriesBuffers?.get?.(series.id);
            if (!buffer || buffer.length <= 0) return;

            const maxDrawPoints = Math.max(220, Math.floor(frame.innerW / Math.max(dpr, 1)) * 2);
            const pointCount = buffer.length;
            const step = pointCount > maxDrawPoints ? Math.ceil(pointCount / maxDrawPoints) : 1;

            ctx.strokeStyle = series.color || '#1d4ed8';
            ctx.lineWidth = 2 * dpr;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.beginPath();

            let started = false;
            buffer.forEachSampled(step, (x, y) => {
                const px = frame.xToPx(x);
                const py = frame.yToPx(y);
                if (!Number.isFinite(px) || !Number.isFinite(py)) return;
                if (!started) {
                    started = true;
                    ctx.moveTo(px, py);
                } else {
                    ctx.lineTo(px, py);
                }
            });

            if (started) {
                ctx.stroke();
            }

            const last = buffer.getPoint?.(buffer.length - 1);
            if (last && Number.isFinite(last.x) && Number.isFinite(last.y)) {
                latestPoint = {
                    seriesName: series.name,
                    x: last.x,
                    y: last.y
                };
            }
        });

        controller._latestText = latestPoint
            ? `最新(${latestPoint.seriesName}): x=${formatNumberCompact(latestPoint.x)}, y=${formatNumberCompact(latestPoint.y)}`
            : '最新: —';
        if (controller.elements.latest) {
            controller.elements.latest.textContent = controller._latestText;
        }

        controller._needsRedraw = false;
    }
}
