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

export function renderBulbV2(component = {}) {
    return createGroup({
        id: component.id,
        type: component.type,
        children: [
            createLine(-30, 0, -14, 0),
            createLine(14, 0, 30, 0),
            createCircle(0, 0, 14),
            createLine(-8, -8, 8, 8, 2),
            createLine(-8, 8, 8, -8, 2),
            createText(0, 27, component.label || 'Bulb', 9)
        ]
    });
}

export function renderThermistorV2(component = {}) {
    return createGroup({
        id: component.id,
        type: component.type,
        children: [
            createLine(-30, 0, -20, 0),
            createLine(20, 0, 30, 0),
            createRect(-20, -8, 40, 16),
            createLine(-12, 10, 12, -10, 2),
            createText(0, 25, component.label || 'NTC', 9)
        ]
    });
}

export function renderPhotoresistorV2(component = {}) {
    return createGroup({
        id: component.id,
        type: component.type,
        children: [
            createLine(-30, 0, -20, 0),
            createLine(20, 0, 30, 0),
            createRect(-20, -8, 40, 16),
            createLine(-8, -18, -1, -10, 1.6),
            createLine(0, -18, 7, -10, 1.6),
            createText(0, 25, component.label || 'LDR', 9)
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

export function renderParallelPlateCapacitorV2(component = {}) {
    const offset = Number(component.plateOffsetYPx || 0);
    return createGroup({
        id: component.id,
        type: component.type,
        children: [
            createLine(-34, 0, -12, 0),
            createLine(-12, -14 + offset, -12, 14 + offset),
            createLine(12, -14 - offset, 12, 14 - offset),
            createLine(12, 0, 34, 0),
            createText(0, 28, component.label || 'C||', 9)
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

export function renderDiodeV2(component = {}) {
    return createGroup({
        id: component.id,
        type: component.type,
        children: [
            createLine(-30, 0, -14, 0),
            createLine(-14, 0, 8, 0, 2),
            createLine(8, -12, 8, 12, 2.2),
            createLine(8, 0, 30, 0),
            createText(0, 26, component.label || 'Diode', 9)
        ]
    });
}

export function renderLedV2(component = {}) {
    return createGroup({
        id: component.id,
        type: component.type,
        children: [
            createLine(-30, 0, -14, 0),
            createLine(-14, 0, 8, 0, 2),
            createLine(8, -12, 8, 12, 2.2),
            createLine(8, 0, 30, 0),
            createLine(10, -16, 16, -22, 1.6),
            createLine(14, -14, 20, -20, 1.6),
            createText(0, 26, component.label || 'LED', 9)
        ]
    });
}

export function renderAmmeterV2(component = {}) {
    return createGroup({
        id: component.id,
        type: component.type,
        children: [
            createLine(-30, 0, -16, 0),
            createLine(16, 0, 30, 0),
            createCircle(0, 0, 16),
            createText(0, 5, 'A', 14),
            createText(0, 30, component.label || 'Ammeter', 9)
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
