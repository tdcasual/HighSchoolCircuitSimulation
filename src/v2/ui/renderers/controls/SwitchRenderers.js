import { createGroup, createLine, createRect, createText } from '../base/SvgPrimitives.js';

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

export function renderSpdtSwitchV2(component = {}) {
    const toB = component.position === 'b';
    return createGroup({
        id: component.id,
        type: component.type,
        children: [
            createLine(-30, 0, -12, 0),
            createLine(12, -12, 30, -12),
            createLine(12, 12, 30, 12),
            toB ? createLine(-12, 0, 12, 12, 2.2) : createLine(-12, 0, 12, -12, 2.2),
            createText(0, 28, component.label || 'SPDT', 9)
        ]
    });
}

export function renderFuseV2(component = {}) {
    const blown = !!component.blown;
    return createGroup({
        id: component.id,
        type: component.type,
        children: [
            createLine(-30, 0, -16, 0),
            createLine(16, 0, 30, 0),
            createRect(-16, -8, 32, 16),
            blown ? createLine(-12, -6, 12, 6, 2) : createLine(-10, 0, 10, 0, 2),
            createText(0, 24, component.label || 'Fuse', 9)
        ]
    });
}

export function renderRheostatV2(component = {}) {
    const position = Math.max(0, Math.min(1, Number(component.position ?? 0.5)));
    const sliderX = -20 + position * 40;
    return createGroup({
        id: component.id,
        type: component.type,
        children: [
            createLine(-30, 0, -20, 0),
            createLine(20, 0, 30, 0),
            createRect(-20, -8, 40, 16),
            createLine(sliderX, -24, sliderX, -6, 2),
            createText(0, 28, component.label || 'Rheostat', 9)
        ]
    });
}

export function renderRelayV2(component = {}) {
    const energized = !!component.energized;
    return createGroup({
        id: component.id,
        type: component.type,
        children: [
            createLine(-30, -10, -18, -10),
            createRect(-18, -18, 36, 16),
            createLine(18, -10, 30, -10),
            createLine(-30, 12, -8, 12),
            createLine(8, 12, 30, 12),
            energized ? createLine(-8, 12, 8, 12, 2.2) : createLine(-8, 12, 8, 2, 2.2),
            createText(0, 32, component.label || 'Relay', 9)
        ]
    });
}
