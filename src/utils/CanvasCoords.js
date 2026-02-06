/**
 * Canvas coordinate helpers.
 * Keep point normalization consistent between UI, renderer, and engine.
 */

export const GRID_SIZE = 20;

/**
 * Normalize a canvas scalar to an integer pixel.
 * @param {number} value
 * @returns {number}
 */
export function toCanvasInt(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n);
}

/**
 * Snap a scalar to the configured grid.
 * @param {number} value
 * @param {number} gridSize
 * @returns {number}
 */
export function snapToGrid(value, gridSize = GRID_SIZE) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    const safeGrid = Number.isFinite(gridSize) && gridSize > 0 ? gridSize : GRID_SIZE;
    return Math.round(n / safeGrid) * safeGrid;
}

/**
 * Normalize a canvas point to integer pixels.
 * @param {{x:number,y:number}} point
 * @returns {{x:number,y:number}|null}
 */
export function normalizeCanvasPoint(point) {
    if (!point || typeof point !== 'object') return null;
    const x = Number(point.x);
    const y = Number(point.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x: toCanvasInt(x), y: toCanvasInt(y) };
}

/**
 * Build a stable key for coordinate-based maps.
 * @param {{x:number,y:number}} point
 * @returns {string|null}
 */
export function pointKey(point) {
    if (!point || typeof point !== 'object') return null;
    const x = Number(point.x);
    const y = Number(point.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
    return `${x},${y}`;
}
