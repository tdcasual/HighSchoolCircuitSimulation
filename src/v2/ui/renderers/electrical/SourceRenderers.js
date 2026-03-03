import { createGroup, createLine, createText } from '../base/SvgPrimitives.js';

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
