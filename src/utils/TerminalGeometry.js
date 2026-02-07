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
        case 'Ground':
            relX = 0;
            relY = -20;
            break;
        case 'PowerSource':
        case 'ACVoltageSource':
        case 'Bulb':
        case 'Motor':
        case 'Resistor':
        case 'Thermistor':
        case 'Photoresistor':
        case 'Diode':
        case 'LED':
        case 'Capacitor':
        case 'Inductor':
        case 'ParallelPlateCapacitor':
        case 'Switch':
        case 'Fuse':
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
                const posRaw = comp.position !== undefined ? comp.position : 0.5;
                const pos = Math.min(Math.max(posRaw, 0), 1);
                // keep terminal coordinates integer to avoid "hidden rounding" connectivity
                relX = Math.round(-20 + 40 * pos);
                relY = -28;
            } else {
                relX = 0;
                relY = 0;
            }
            break;
        case 'SPDTSwitch':
            // 0=common(left), 1=throw-a(upper right), 2=throw-b(lower right)
            if (terminalIndex === 0) {
                relX = -30;
                relY = 0;
            } else if (terminalIndex === 1) {
                relX = 30;
                relY = -10;
            } else if (terminalIndex === 2) {
                relX = 30;
                relY = 10;
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
        case 'Relay':
            // 0=coil left, 1=coil right, 2=contact left, 3=contact right
            if (terminalIndex === 0) {
                relX = -30;
                relY = -12;
            } else if (terminalIndex === 1) {
                relX = 30;
                relY = -12;
            } else if (terminalIndex === 2) {
                relX = -30;
                relY = 12;
            } else if (terminalIndex === 3) {
                relX = 30;
                relY = 12;
            } else {
                relX = 0;
                relY = 0;
            }
            break;
        default:
            relX = terminalIndex === 0 ? -30 : 30;
            relY = 0;
    }

    // Apply terminal extension offsets (component-local).
    if (comp.terminalExtensions && comp.terminalExtensions[terminalIndex]) {
        relX += comp.terminalExtensions[terminalIndex].x || 0;
        relY += comp.terminalExtensions[terminalIndex].y || 0;
    }

    // Normalize to integer pixels so "same coordinate" means exactly equal.
    return { x: Math.round(relX), y: Math.round(relY) };
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

    const rot = ((comp.rotation || 0) % 360 + 360) % 360;
    const cx = comp.x || 0;
    const cy = comp.y || 0;

    let x = cx;
    let y = cy;

    // Rotation is always in 90° steps in this project; avoid trig precision issues.
    switch (rot) {
        case 0:
            x = cx + local.x;
            y = cy + local.y;
            break;
        case 90:
            x = cx - local.y;
            y = cy + local.x;
            break;
        case 180:
            x = cx - local.x;
            y = cy - local.y;
            break;
        case 270:
            x = cx + local.y;
            y = cy - local.x;
            break;
        default: {
            const rotation = rot * Math.PI / 180;
            const cos = Math.cos(rotation);
            const sin = Math.sin(rotation);
            x = cx + local.x * cos - local.y * sin;
            y = cy + local.x * sin + local.y * cos;
            break;
        }
    }

    // Keep all world-space terminals aligned to integer pixels.
    return { x: Math.round(x), y: Math.round(y) };
}
