/**
 * ComponentSvgPrimitives.js - SVG 基础绘制原语
 */

export function addLine(g, x1, y1, x2, y2, strokeWidth = 2) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.setAttribute('stroke', '#333');
    line.setAttribute('stroke-width', strokeWidth);
    g.appendChild(line);
    return line;
}

export function addTerminal(g, x, y, index, comp = null, terminalHitRadius = 22) {
    let extX = 0;
    let extY = 0;
    if (comp && comp.terminalExtensions && comp.terminalExtensions[index]) {
        extX = comp.terminalExtensions[index].x || 0;
        extY = comp.terminalExtensions[index].y || 0;
    }

    if (extX !== 0 || extY !== 0) {
        const extLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        extLine.setAttribute('x1', x);
        extLine.setAttribute('y1', y);
        extLine.setAttribute('x2', x + extX);
        extLine.setAttribute('y2', y + extY);
        extLine.setAttribute('stroke', '#333');
        extLine.setAttribute('stroke-width', 2);
        extLine.setAttribute('class', 'terminal-extension');
        g.appendChild(extLine);
    }

    const hitCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    hitCircle.setAttribute('cx', x + extX);
    hitCircle.setAttribute('cy', y + extY);
    hitCircle.setAttribute('r', terminalHitRadius);
    hitCircle.setAttribute('class', 'terminal-hit-area');
    hitCircle.setAttribute('data-terminal', index);
    hitCircle.style.pointerEvents = 'all';
    hitCircle.setAttribute('draggable', 'false');
    g.appendChild(hitCircle);

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x + extX);
    circle.setAttribute('cy', y + extY);
    circle.setAttribute('r', 5);
    circle.setAttribute('class', 'terminal');
    circle.setAttribute('data-terminal', index);
    circle.style.pointerEvents = 'all';
    circle.setAttribute('draggable', 'false');
    g.appendChild(circle);
    return circle;
}

export function addText(g, x, y, text, fontSize = 10, className = '') {
    const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textEl.setAttribute('x', x);
    textEl.setAttribute('y', y);
    textEl.setAttribute('text-anchor', 'middle');
    textEl.setAttribute('font-size', fontSize);
    textEl.setAttribute('class', className);
    textEl.textContent = text;
    g.appendChild(textEl);
    return textEl;
}
