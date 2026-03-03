import { createCircle, createGroup, createLine, createRect, createText } from '../base/SvgPrimitives.js';

export function renderGroundV2(component = {}) {
    return createGroup({
        id: component.id,
        type: component.type,
        children: [
            createLine(0, -20, 0, -8, 2),
            createLine(-12, -8, 12, -8, 2),
            createLine(-8, -3, 8, -3, 2),
            createLine(-4, 2, 4, 2, 2),
            createText(0, 18, component.label || 'GND', 10)
        ]
    });
}

export function renderPowerSourceV2(component = {}) {
    return createGroup({
        id: component.id,
        type: component.type,
        children: [
            createLine(-30, 0, -10, 0),
            createLine(-10, -15, -10, 15, 3),
            createLine(10, -8, 10, 8, 2),
            createLine(10, 0, 30, 0),
            createText(-18, -8, '+', 12),
            createText(14, -8, '-', 12),
            createText(0, 28, component.label || `${component.voltage ?? 0}V`)
        ]
    });
}

export function renderACVoltageSourceV2(component = {}) {
    return createGroup({
        id: component.id,
        type: component.type,
        children: [
            createLine(-35, 0, -16, 0),
            createLine(16, 0, 35, 0),
            createCircle(0, 0, 16),
            createText(0, 5, '~', 16),
            createText(-24, 5, '+', 10),
            createText(24, 5, '-', 10),
            createText(0, 30, component.label || `${component.rmsVoltage ?? 0}V~`, 9)
        ]
    });
}

export function renderMotorV2(component = {}) {
    return createGroup({
        id: component.id,
        type: component.type,
        children: [
            createLine(-32, 0, -18, 0),
            createLine(18, 0, 32, 0),
            createCircle(0, 0, 18),
            createText(0, 6, 'M', 14),
            createText(0, 30, component.label || 'Motor', 9)
        ]
    });
}

export function renderBlackBoxV2(component = {}) {
    const width = Math.max(100, Number(component.boxWidth || 180));
    const height = Math.max(60, Number(component.boxHeight || 110));
    const halfW = width / 2;
    const halfH = height / 2;
    return createGroup({
        id: component.id,
        type: component.type,
        children: [
            createLine(-halfW - 16, 0, -halfW, 0),
            createLine(halfW, 0, halfW + 16, 0),
            createRect(-halfW, -halfH, width, height),
            createText(0, 4, component.label || 'BlackBox', 11)
        ]
    });
}
