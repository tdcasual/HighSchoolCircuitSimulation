import { getTerminalLocalPosition } from '../../utils/TerminalGeometry.js';

export const TOUCH_TARGET_SIZE_PX = 44;
export const TOUCH_TARGET_RADIUS_PX = TOUCH_TARGET_SIZE_PX / 2;

function normalizeRotation(rotation = 0) {
    const raw = Number.isFinite(Number(rotation)) ? Number(rotation) : 0;
    const normalized = ((raw % 360) + 360) % 360;
    const snapped = Math.round(normalized / 90) * 90;
    return ((snapped % 360) + 360) % 360;
}

function rotateLocalPoint(point, rotation = 0) {
    const x = Number(point?.x) || 0;
    const y = Number(point?.y) || 0;
    const rot = normalizeRotation(rotation);
    switch (rot) {
        case 0:
            return { x, y };
        case 90:
            return { x: -y, y: x };
        case 180:
            return { x: -x, y: -y };
        case 270:
            return { x: y, y: -x };
        default: {
            const radians = rot * Math.PI / 180;
            const cos = Math.cos(radians);
            const sin = Math.sin(radians);
            return {
                x: Math.round(x * cos - y * sin),
                y: Math.round(x * sin + y * cos)
            };
        }
    }
}

function normalizeZero(value) {
    const numeric = Number(value) || 0;
    return Object.is(numeric, -0) ? 0 : numeric;
}

function buildComponentLike(type, component = {}) {
    return {
        ...component,
        type
    };
}

export function getTerminalLocalOffset(type, terminalIndex, rotation = 0, component = {}) {
    const comp = buildComponentLike(type, component);
    const local = getTerminalLocalPosition(comp, terminalIndex);
    if (!local) {
        return { x: 0, y: 0 };
    }
    const rotated = rotateLocalPoint(local, rotation);
    return {
        x: normalizeZero(Math.round(rotated.x)),
        y: normalizeZero(Math.round(rotated.y))
    };
}

export function getComponentHitBox(component = {}) {
    const type = String(component.type || '');
    if (type === 'BlackBox') {
        const width = Math.max(80, Number(component.boxWidth) || 180);
        const height = Math.max(60, Number(component.boxHeight) || 110);
        return {
            x: -width / 2,
            y: -height / 2,
            width,
            height
        };
    }

    if (type === 'Rheostat') {
        const width = Math.max(70, TOUCH_TARGET_SIZE_PX);
        const height = Math.max(56, TOUCH_TARGET_SIZE_PX);
        return {
            x: -width / 2,
            y: -height / 2,
            width,
            height
        };
    }

    if (type === 'SPDTSwitch' || type === 'Switch') {
        return {
            x: -TOUCH_TARGET_RADIUS_PX,
            y: -TOUCH_TARGET_RADIUS_PX,
            width: TOUCH_TARGET_SIZE_PX,
            height: TOUCH_TARGET_SIZE_PX
        };
    }

    const width = Math.max(60, TOUCH_TARGET_SIZE_PX);
    const height = Math.max(30, TOUCH_TARGET_SIZE_PX);
    return {
        x: -width / 2,
        y: -height / 2,
        width,
        height
    };
}
