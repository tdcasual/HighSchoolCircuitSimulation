export function createGroup({ id = '', type = '', children = [] } = {}) {
    return {
        kind: 'group',
        id: String(id),
        type: String(type),
        children: Array.isArray(children) ? children : []
    };
}

export function createLine(x1, y1, x2, y2, strokeWidth = 2) {
    return {
        kind: 'line',
        x1: Number(x1),
        y1: Number(y1),
        x2: Number(x2),
        y2: Number(y2),
        strokeWidth: Number(strokeWidth)
    };
}

export function createRect(x, y, width, height) {
    return {
        kind: 'rect',
        x: Number(x),
        y: Number(y),
        width: Number(width),
        height: Number(height)
    };
}

export function createCircle(cx, cy, r) {
    return {
        kind: 'circle',
        cx: Number(cx),
        cy: Number(cy),
        r: Number(r)
    };
}

export function createText(x, y, text, fontSize = 10) {
    return {
        kind: 'text',
        x: Number(x),
        y: Number(y),
        text: String(text),
        fontSize: Number(fontSize)
    };
}
