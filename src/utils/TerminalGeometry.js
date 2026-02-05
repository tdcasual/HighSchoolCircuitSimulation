/**
 * TerminalGeometry.js - shared terminal position helpers
 * Keep terminal math consistent between UI renderer and engine topology rebuild.
 */

/**
 * Get a terminal's local (component-space) position before rotation/translation.
 *
 * @param {Object} comp
 * @param {number} terminalIndex
 * @returns {{x:number,y:number}|null}
 */
export function getTerminalLocalPosition(comp, terminalIndex) {
    if (!comp || terminalIndex == null) return null;

    let relX = 0;
    let relY = 0;

    switch (comp.type) {
        case 'PowerSource':
        case 'Bulb':
        case 'Motor':
        case 'Resistor':
        case 'Capacitor':
        case 'ParallelPlateCapacitor':
        case 'Switch':
        case 'Ammeter':
        case 'Voltmeter':
            relX = terminalIndex === 0 ? -30 : 30;
            relY = 0;
            break;
        case 'Rheostat':
            // 0=left, 1=right, 2=slider
            if (terminalIndex === 0) {
                relX = -35;
                relY = 0;
            } else if (terminalIndex === 1) {
                relX = 35;
                relY = 0;
            } else if (terminalIndex === 2) {
                // position may be 0; do not use || 0.5
                const pos = comp.position !== undefined ? comp.position : 0.5;
                relX = -20 + 40 * pos;
                relY = -28;
            } else {
                relX = 0;
                relY = 0;
            }
            break;
        case 'BlackBox': {
            const w = Math.max(80, comp.boxWidth || 180);
            relX = terminalIndex === 0 ? -w / 2 : w / 2;
            relY = 0;
            break;
        }
        default:
            relX = terminalIndex === 0 ? -30 : 30;
            relY = 0;
    }

    // Apply terminal extension offsets (component-local).
    if (comp.terminalExtensions && comp.terminalExtensions[terminalIndex]) {
        relX += comp.terminalExtensions[terminalIndex].x || 0;
        relY += comp.terminalExtensions[terminalIndex].y || 0;
    }

    return { x: relX, y: relY };
}

/**
 * Get a terminal's world position (canvas-space).
 *
 * @param {Object} comp
 * @param {number} terminalIndex
 * @returns {{x:number,y:number}|null}
 */
export function getTerminalWorldPosition(comp, terminalIndex) {
    const local = getTerminalLocalPosition(comp, terminalIndex);
    if (!local) return null;

    const rotation = (comp.rotation || 0) * Math.PI / 180;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    return {
        x: (comp.x || 0) + local.x * cos - local.y * sin,
        y: (comp.y || 0) + local.x * sin + local.y * cos
    };
}
