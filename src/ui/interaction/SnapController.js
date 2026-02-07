import { GRID_SIZE, normalizeCanvasPoint, snapToGrid } from '../../utils/CanvasCoords.js';
import { getComponentTerminalCount } from '../../components/Component.js';

export function getAdaptiveSnapThreshold(options = {}) {
    const baseThreshold = Number.isFinite(options.threshold) ? options.threshold : 15;
    const pointerType = options.pointerType || this.lastPrimaryPointerType || 'mouse';
    if (pointerType === 'touch') return Math.max(baseThreshold, 24);
    if (pointerType === 'pen') return Math.max(baseThreshold, 18);
    return baseThreshold;
}

/**
 * 吸附点：优先吸附到端子/导线端点，可选吸附到导线中段，否则吸附到网格
 */
export function snapPoint(x, y, options = {}) {
    const threshold = this.getAdaptiveSnapThreshold(options);

    const nearbyTerminal = this.findNearbyTerminal(x, y, threshold);
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
        options.excludeWireEndpoints
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
export function findNearbyTerminal(x, y, threshold) {
    for (const [id, comp] of this.circuit.components) {
        // 检查每个端点
        const terminalCount = getComponentTerminalCount(comp.type);
        for (let ti = 0; ti < terminalCount; ti += 1) {
            const pos = this.renderer.getTerminalPosition(id, ti);
            if (pos) {
                const dist = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
                if (dist < threshold) {
                    return { componentId: id, terminalIndex: ti };
                }
            }
        }
    }
    return null;
}
