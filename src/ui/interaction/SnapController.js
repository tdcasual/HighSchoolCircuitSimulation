import { GRID_SIZE, normalizeCanvasPoint, snapToGrid } from '../../utils/CanvasCoords.js';
import { getComponentTerminalCount, TERMINAL_HIT_RADIUS_PX } from '../../components/Component.js';

const TOUCH_ENDPOINT_SLOW_DRAG_SPEED_MAX = 0.45;
const PEN_ENDPOINT_SLOW_DRAG_SPEED_MAX = 0.35;
const TOUCH_ENDPOINT_SLOW_DRAG_ASSIST_MAX_PX = 10;
const PEN_ENDPOINT_SLOW_DRAG_ASSIST_MAX_PX = 6;

function resolveEndpointSlowDragAssistPx(pointerType, snapIntent, dragSpeedPxPerMs) {
    if (snapIntent !== 'wire-endpoint-drag') return 0;
    if (!Number.isFinite(dragSpeedPxPerMs) || dragSpeedPxPerMs < 0) return 0;

    if (pointerType === 'touch') {
        const speed = Math.min(Math.max(0, dragSpeedPxPerMs), TOUCH_ENDPOINT_SLOW_DRAG_SPEED_MAX);
        const ratio = 1 - (speed / TOUCH_ENDPOINT_SLOW_DRAG_SPEED_MAX);
        return TOUCH_ENDPOINT_SLOW_DRAG_ASSIST_MAX_PX * ratio;
    }

    if (pointerType === 'pen') {
        const speed = Math.min(Math.max(0, dragSpeedPxPerMs), PEN_ENDPOINT_SLOW_DRAG_SPEED_MAX);
        const ratio = 1 - (speed / PEN_ENDPOINT_SLOW_DRAG_SPEED_MAX);
        return PEN_ENDPOINT_SLOW_DRAG_ASSIST_MAX_PX * ratio;
    }

    return 0;
}

export function getAdaptiveSnapThreshold(options = {}) {
    const baseThreshold = Number.isFinite(options.threshold) ? options.threshold : 15;
    const pointerType = options.pointerType || this.lastPrimaryPointerType || 'mouse';
    const snapIntent = options.snapIntent || '';
    const minTouchThreshold = snapIntent === 'wire-endpoint-drag' ? 32 : 24;
    const screenThreshold = pointerType === 'touch'
        ? Math.max(baseThreshold, minTouchThreshold)
        : pointerType === 'pen'
            ? Math.max(baseThreshold, 18)
            : baseThreshold;
    const slowDragAssist = resolveEndpointSlowDragAssistPx(
        pointerType,
        snapIntent,
        options.dragSpeedPxPerMs
    );
    const scale = Number.isFinite(this.scale) && this.scale > 0 ? this.scale : 1;
    return (screenThreshold + slowDragAssist) / scale;
}

/**
 * 吸附点：优先吸附到端子/导线端点，可选吸附到导线中段，否则吸附到网格
 */
export function snapPoint(x, y, options = {}) {
    const threshold = this.getAdaptiveSnapThreshold(options);
    const terminalThreshold = Math.max(threshold, TERMINAL_HIT_RADIUS_PX);

    const nearbyTerminal = this.findNearbyTerminal(x, y, terminalThreshold, options.excludeTerminalKeys);
    if (nearbyTerminal) {
        const pos = this.renderer.getTerminalPosition(nearbyTerminal.componentId, nearbyTerminal.terminalIndex);
        const normalizedPos = normalizeCanvasPoint(pos);
        if (normalizedPos) {
            return {
                x: normalizedPos.x,
                y: normalizedPos.y,
                snap: {
                    type: 'terminal',
                    componentId: nearbyTerminal.componentId,
                    terminalIndex: nearbyTerminal.terminalIndex
                }
            };
        }
    }

    const nearbyEndpoint = this.findNearbyWireEndpoint(
        x,
        y,
        threshold,
        options.excludeWireId,
        options.excludeEnd,
        options.excludeWireEndpoints,
        options.excludeWireIds
    );
    if (nearbyEndpoint) {
        const normalizedEndpoint = normalizeCanvasPoint(nearbyEndpoint);
        if (!normalizedEndpoint) {
            return {
                x: snapToGrid(x, GRID_SIZE),
                y: snapToGrid(y, GRID_SIZE),
                snap: { type: 'grid' }
            };
        }
        return {
            x: normalizedEndpoint.x,
            y: normalizedEndpoint.y,
            snap: { type: 'wire-endpoint', wireId: nearbyEndpoint.wireId, end: nearbyEndpoint.end }
        };
    }

    if (options.allowWireSegmentSnap) {
        const nearbySegment = this.findNearbyWireSegment(x, y, threshold, options.excludeWireId);
        if (nearbySegment) {
            return {
                x: nearbySegment.x,
                y: nearbySegment.y,
                snap: { type: 'wire-segment', wireId: nearbySegment.wireId }
            };
        }
    }

    return {
        x: snapToGrid(x, GRID_SIZE),
        y: snapToGrid(y, GRID_SIZE),
        snap: { type: 'grid' }
    };
}

/**
 * 查找附近的端点
 * @param {number} x - x坐标
 * @param {number} y - y坐标
 * @param {number} threshold - 距离阈值
 * @returns {Object|null} 端点信息 {componentId, terminalIndex} 或 null
 */
export function findNearbyTerminal(x, y, threshold, excludeTerminalKeys = null) {
    let best = null;
    let bestDist = Infinity;

    for (const [id, comp] of this.circuit.components) {
        // 检查每个端点
        const terminalCount = getComponentTerminalCount(comp.type);
        for (let ti = 0; ti < terminalCount; ti += 1) {
            if (excludeTerminalKeys && excludeTerminalKeys.has(`${id}:${ti}`)) continue;
            const pos = this.renderer.getTerminalPosition(id, ti);
            if (pos) {
                const dist = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
                if (dist < threshold && dist < bestDist) {
                    bestDist = dist;
                    best = { componentId: id, terminalIndex: ti };
                }
            }
        }
    }
    return best;
}
