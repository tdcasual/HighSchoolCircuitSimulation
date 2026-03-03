/**
 * ComponentWireRenderer.js - 导线绘制与端点交互更新
 */

import { TOUCH_TARGET_RADIUS_PX } from '../geometry/ComponentGeometry.js';

function safeHasClass(node, className) {
    if (!node || !node.classList || typeof node.classList.contains !== 'function') return false;
    try {
        return node.classList.contains(className);
    } catch (_) {
        return false;
    }
}

function resolveShouldShowEndpointHints(safeHasClassFn = safeHasClass) {
    const body = typeof document !== 'undefined' ? document.body : null;
    if (safeHasClassFn(body, 'layout-mode-phone') || safeHasClassFn(body, 'layout-mode-compact')) {
        return true;
    }
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        try {
            return window.matchMedia('(pointer: coarse)').matches;
        } catch (_) {
            return false;
        }
    }
    return false;
}

export function createWire(wire, options = {}) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'wire-group');
    g.setAttribute('data-id', wire.id);

    const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hitArea.setAttribute('class', 'wire-hit-area');
    hitArea.setAttribute('data-id', wire.id);
    g.appendChild(hitArea);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'wire');
    path.setAttribute('data-id', wire.id);
    g.appendChild(path);

    updateWirePathWithGroup(g, wire, options);
    return g;
}

export function updateWirePath(pathOrGroup, wire, options = {}) {
    updateWirePathWithGroup(pathOrGroup, wire, options);
}

export function updateWirePathWithGroup(g, wire, options = {}) {
    const {
        getWireEndpointPosition = null,
        safeHasClassFn = safeHasClass,
        wireEndpointHitRadius = TOUCH_TARGET_RADIUS_PX
    } = options;

    const path = g.querySelector('path.wire');
    const hitArea = g.querySelector('path.wire-hit-area');
    if (!path) return;

    const getEnd = (which) => {
        if (typeof getWireEndpointPosition === 'function') {
            return getWireEndpointPosition(wire, which);
        }
        return which === 'a' ? wire?.a : wire?.b;
    };

    const a = getEnd('a');
    const b = getEnd('b');
    if (!a || !b) return;

    const d = `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
    path.setAttribute('d', d);
    if (hitArea) {
        hitArea.setAttribute('d', d);
    }

    if (typeof g.querySelectorAll === 'function') {
        g.querySelectorAll('.wire-endpoint, .wire-endpoint-hit, .wire-endpoint-hint').forEach((el) => el.remove());
    }

    const shouldShowEndpointHints = resolveShouldShowEndpointHints(safeHasClassFn);

    if (safeHasClassFn(g, 'selected')) {
        const makeEndpoint = (pt, which) => {
            const hitCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            hitCircle.setAttribute('cx', pt.x);
            hitCircle.setAttribute('cy', pt.y);
            hitCircle.setAttribute('r', wireEndpointHitRadius);
            hitCircle.setAttribute('class', 'wire-endpoint-hit');
            hitCircle.setAttribute('data-end', which);
            hitCircle.style.cursor = 'move';
            g.appendChild(hitCircle);

            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', pt.x);
            circle.setAttribute('cy', pt.y);
            circle.setAttribute('r', 7);
            circle.setAttribute('class', 'wire-endpoint');
            circle.setAttribute('data-end', which);
            circle.style.cursor = 'move';
            g.appendChild(circle);
        };
        makeEndpoint(a, 'a');
        makeEndpoint(b, 'b');
    } else if (shouldShowEndpointHints) {
        const makeHint = (pt) => {
            const hint = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            hint.setAttribute('cx', pt.x);
            hint.setAttribute('cy', pt.y);
            hint.setAttribute('r', 3.5);
            hint.setAttribute('class', 'wire-endpoint-hint');
            g.appendChild(hint);
        };
        makeHint(a);
        makeHint(b);
    }
}
