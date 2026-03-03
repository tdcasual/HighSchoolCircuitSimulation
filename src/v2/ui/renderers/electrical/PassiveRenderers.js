import { createCircle, createGroup, createLine, createRect, createText } from '../base/SvgPrimitives.js';

export function renderResistorV2(component = {}) {
    return createGroup({
        id: component.id,
        type: component.type,
        children: [
            createLine(-30, 0, -20, 0),
            createLine(20, 0, 30, 0),
            createRect(-20, -8, 40, 16),
            createText(0, 25, component.label || `${component.resistance ?? 100}Ω`)
        ]
    });
}

export function renderCapacitorV2(component = {}) {
    return createGroup({
        id: component.id,
        type: component.type,
        children: [
            createLine(-30, 0, -8, 0),
            createLine(-8, -12, -8, 12),
            createLine(8, -12, 8, 12),
            createLine(8, 0, 30, 0),
            createText(0, 25, component.label || 'C')
        ]
    });
}

export function renderInductorV2(component = {}) {
    return createGroup({
        id: component.id,
        type: component.type,
        children: [
            createLine(-30, 0, -18, 0),
            createCircle(-12, 0, 6),
            createCircle(0, 0, 6),
            createCircle(12, 0, 6),
            createLine(18, 0, 30, 0),
            createText(0, 25, component.label || 'L')
        ]
    });
}

export function renderVoltmeterV2(component = {}) {
    return createGroup({
        id: component.id,
        type: component.type,
        children: [
            createLine(-30, 0, -16, 0),
            createLine(16, 0, 30, 0),
            createCircle(0, 0, 16),
            createText(0, 5, 'V', 14),
            createText(0, 30, component.label || 'Voltmeter', 9)
        ]
    });
}
