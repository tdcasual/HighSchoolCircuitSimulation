import { createGroup, createLine, createText } from '../base/SvgPrimitives.js';

export function renderSwitchV2(component = {}) {
    const closed = !!component.closed;
    return createGroup({
        id: component.id,
        type: component.type,
        children: [
            createLine(-30, 0, -12, 0),
            createLine(12, 0, 30, 0),
            closed ? createLine(-12, 0, 12, 0, 2.4) : createLine(-12, 0, 8, -10, 2.4),
            createText(0, 24, component.label || 'Switch', 9)
        ]
    });
}
