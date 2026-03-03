import { formatNumberCompact } from './ObservationMath.js';
import { DEFAULT_SAMPLE_INTERVAL_MS, normalizeSampleIntervalMs } from './ObservationState.js';

function safeAppendToBody(node) {
    if (typeof document === 'undefined') return false;
    const body = document.body;
    if (!body || typeof body.appendChild !== 'function') return false;
    try {
        body.appendChild(node);
        return true;
    } catch (_) {
        return false;
    }
}

function safeInvokeMethod(target, methodName, ...args) {
    const method = target?.[methodName];
    if (typeof method !== 'function') return undefined;
    try {
        return method.apply(target, args);
    } catch (_) {
        return undefined;
    }
}

export function buildObservationExportMetadata(panel, options = {}) {
    const exportedAt = options.exportedAt instanceof Date && Number.isFinite(options.exportedAt.getTime())
        ? options.exportedAt
        : new Date();
    const timestamp = exportedAt.toISOString().replace('T', ' ').replace('Z', ' UTC');
    const lines = [
        `导出时间: ${timestamp}`,
        `采样间隔: ${normalizeSampleIntervalMs(panel.sampleIntervalMs, DEFAULT_SAMPLE_INTERVAL_MS)} ms`
    ];

    const plots = Array.isArray(panel.plots) ? panel.plots : [];
    lines.push(`图像数量: ${plots.length}`);
    const resolveSourceLabel = typeof panel.resolveSourceLabel === 'function'
        ? panel.resolveSourceLabel.bind(panel)
        : (sourceId) => String(sourceId || '');
    const resolveQuantityLabel = typeof panel.resolveQuantityLabel === 'function'
        ? panel.resolveQuantityLabel.bind(panel)
        : (_sourceId, quantityId) => String(quantityId || '未知量');

    plots.forEach((plot, index) => {
        const title = typeof plot?.name === 'string' && plot.name.trim()
            ? plot.name.trim()
            : `图像 ${index + 1}`;
        lines.push(`[图 ${index + 1}] ${title}`);
        lines.push(`X: ${resolveSourceLabel(plot?.x?.sourceId)} · ${resolveQuantityLabel(plot?.x?.sourceId, plot?.x?.quantityId)}`);
        lines.push(`Y: ${resolveSourceLabel(plot?.y?.sourceId)} · ${resolveQuantityLabel(plot?.y?.sourceId, plot?.y?.quantityId)}`);
        if (typeof plot?._latestText === 'string' && plot._latestText.trim()) {
            lines.push(plot._latestText.trim());
        }
    });

    const meterComponents = [];
    for (const comp of panel.circuit?.components?.values?.() || []) {
        if ((comp.type === 'Ammeter' || comp.type === 'Voltmeter') && comp.selfReading) {
            meterComponents.push(comp);
        }
    }
    if (meterComponents.length <= 0) {
        lines.push('[表盘] 无自主读数');
    } else {
        for (const comp of meterComponents) {
            const unit = comp.type === 'Ammeter' ? 'A' : 'V';
            const reading = comp.type === 'Ammeter'
                ? Math.abs(Number(comp.currentValue) || 0)
                : Math.abs(Number(comp.voltageValue) || 0);
            const range = Number.isFinite(comp.range) && Number(comp.range) > 0
                ? Number(comp.range)
                : (comp.type === 'Ammeter' ? 3 : 15);
            const label = typeof comp.label === 'string' && comp.label.trim()
                ? comp.label.trim()
                : comp.id;
            lines.push(`[表盘] ${label}: ${formatNumberCompact(reading, 4)} ${unit} / 量程 ${range}${unit}`);
        }
    }

    return lines;
}

export function buildObservationExportFileName(_panel, rawDate = new Date()) {
    const date = rawDate instanceof Date && Number.isFinite(rawDate.getTime()) ? rawDate : new Date();
    const y = String(date.getFullYear()).padStart(4, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `observation_${y}-${m}-${d}_${hh}-${mm}-${ss}.png`;
}

export function downloadCanvasImage(_panel, canvas, fileName = 'observation_export.png') {
    if (!canvas || typeof canvas.toDataURL !== 'function' || typeof document === 'undefined') {
        return false;
    }
    const dataUrl = canvas.toDataURL('image/png');
    if (!dataUrl || typeof dataUrl !== 'string') return false;

    const anchor = document.createElement('a');
    anchor.href = dataUrl;
    anchor.download = fileName;
    safeAppendToBody(anchor);
    safeInvokeMethod(anchor, 'click');
    safeInvokeMethod(anchor, 'remove');
    return true;
}

export function exportObservationSnapshot(panel, options = {}) {
    if (typeof document === 'undefined') return false;
    const plots = Array.isArray(panel.plots) ? panel.plots : [];
    if (typeof panel.renderAll === 'function') {
        panel.renderAll();
    }

    const plotSnapshots = [];
    for (const plot of plots) {
        const canvas = plot?.elements?.canvas;
        if (!canvas || !Number.isFinite(canvas.width) || !Number.isFinite(canvas.height)) continue;
        if (canvas.width <= 0 || canvas.height <= 0) continue;
        plotSnapshots.push({
            name: typeof plot?.name === 'string' ? plot.name : '',
            canvas
        });
    }

    if (plotSnapshots.length <= 0) {
        panel.showTransientStatus?.('暂无可导出的图像');
        return false;
    }

    const exportedAt = options.exportedAt instanceof Date ? options.exportedAt : new Date();
    const metadataLines = buildObservationExportMetadata(panel, { exportedAt });

    const padX = 20;
    const padY = 16;
    const rowGap = 12;
    const titleHeight = 20;
    const metadataHeaderHeight = 22;
    const metadataLineHeight = 18;
    const headerHeight = 34;
    const plotMaxWidth = Math.max(...plotSnapshots.map((item) => item.canvas.width));
    const renderWidth = Math.max(480, plotMaxWidth);

    const plotHeights = plotSnapshots.map((item) => Math.max(1, Math.round(item.canvas.height * (renderWidth / item.canvas.width))));
    const plotBlockHeight = plotHeights.reduce((sum, value) => sum + value + titleHeight + rowGap, 0);
    const metadataHeight = metadataHeaderHeight + metadataLines.length * metadataLineHeight;
    const exportWidth = renderWidth + padX * 2;
    const exportHeight = padY * 2 + headerHeight + plotBlockHeight + metadataHeight + rowGap;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = exportWidth;
    exportCanvas.height = exportHeight;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) {
        panel.showTransientStatus?.('导出失败：无法创建画布');
        return false;
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, exportWidth, exportHeight);

    let cursorY = padY;
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('观察图像导出', padX, cursorY + 18);
    cursorY += headerHeight;

    ctx.font = '600 13px sans-serif';
    for (let i = 0; i < plotSnapshots.length; i += 1) {
        const item = plotSnapshots[i];
        const plotTitle = typeof item.name === 'string' && item.name.trim()
            ? item.name.trim()
            : `图像 ${i + 1}`;
        ctx.fillStyle = '#0f172a';
        ctx.fillText(`[图 ${i + 1}] ${plotTitle}`, padX, cursorY + 14);
        cursorY += titleHeight;

        const drawHeight = plotHeights[i];
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.8)';
        ctx.strokeRect(padX, cursorY, renderWidth, drawHeight);
        ctx.drawImage(item.canvas, padX, cursorY, renderWidth, drawHeight);
        cursorY += drawHeight + rowGap;
    }

    ctx.fillStyle = '#111827';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('读数元数据', padX, cursorY + 14);
    cursorY += metadataHeaderHeight;

    ctx.font = '12px monospace';
    for (const line of metadataLines) {
        ctx.fillStyle = '#334155';
        ctx.fillText(line, padX, cursorY + 12);
        cursorY += metadataLineHeight;
    }

    const fileName = buildObservationExportFileName(panel, exportedAt);
    const ok = downloadCanvasImage(panel, exportCanvas, fileName);
    panel.showTransientStatus?.(ok ? `已导出观察图像：${fileName}` : '导出失败：下载不可用');
    return ok;
}
