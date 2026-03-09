import { getComponentHitBox, getTerminalLocalOffset } from '../geometry/ComponentGeometry.js';

function createSvgNode(tagName, attributes = {}) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tagName);
    for (const [name, value] of Object.entries(attributes)) {
        node.setAttribute(name, value);
    }
    return node;
}

function appendContactDot(g, cx, cy) {
    const dot = createSvgNode('circle', { cx, cy, r: 3, fill: '#333' });
    g.appendChild(dot);
    return dot;
}

function appendSwitchTouchArea(g, comp) {
    const switchHitBox = getComponentHitBox({ type: 'Switch', ...comp });
    const touchArea = createSvgNode('rect', {
        x: switchHitBox.x,
        y: switchHitBox.y,
        width: switchHitBox.width,
        height: switchHitBox.height,
        fill: 'transparent',
        class: 'switch-touch'
    });
    touchArea.style.cursor = 'pointer';
    g.appendChild(touchArea);
    return touchArea;
}

export const CONTROL_COMPONENT_RENDERERS = {
    renderRelay(g, comp) {
        this.addLine(g, -30, -12, -18, -12);
        this.addLine(g, 18, -12, 30, -12);
        const loops = 4;
        const radius = 4;
        const startX = -14;
        for (let i = 0; i < loops; i++) {
            const cx = startX + i * (radius * 2) + radius;
            const arc = createSvgNode('path', {
                d: `M ${cx - radius} -12 A ${radius} ${radius} 0 0 1 ${cx + radius} -12`,
                fill: 'none',
                stroke: '#333',
                'stroke-width': '2'
            });
            g.appendChild(arc);
        }

        this.addLine(g, -30, 12, -10, 12);
        this.addLine(g, 10, 12, 30, 12);
        const contact = createSvgNode('line', {
            x1: '-10',
            y1: '12',
            x2: comp.energized ? '10' : '6',
            y2: comp.energized ? '12' : '4',
            stroke: '#333',
            'stroke-width': '2'
        });
        g.appendChild(contact);

        this.addLine(g, 0, -4, 0, 4, 1.2);
        this.addTerminal(g, -30, -12, 0, comp);
        this.addTerminal(g, 30, -12, 1, comp);
        this.addTerminal(g, -30, 12, 2, comp);
        this.addTerminal(g, 30, 12, 3, comp);

        const labelText = comp.label || `Relay ${comp.energized ? '吸合' : '释放'}`;
        this.addText(g, 0, 30, labelText, 9, 'label');
    },

    renderRheostat(g, comp) {
        this.addLine(g, -35, 0, -25, 0);
        this.addLine(g, 25, 0, 35, 0);

        const rect = createSvgNode('rect', {
            x: -25,
            y: -8,
            width: 50,
            height: 16,
            class: 'body'
        });
        g.appendChild(rect);

        const sliderLocal = getTerminalLocalOffset('Rheostat', 2, 0, comp);
        const sliderX = sliderLocal.x;
        const posRaw = comp.position !== undefined ? comp.position : 0.5;
        const pos = Math.min(Math.max(posRaw, 0), 1);

        this.addLine(g, -25, -12, 25, -12, 1.5);
        this.addLine(g, sliderX, -12, sliderX, -25, 2);

        const triangle = createSvgNode('polygon', {
            points: `${sliderX - 6},-16 ${sliderX + 6},-16 ${sliderX},-9`,
            class: 'rheostat-slider',
            fill: '#2196F3'
        });
        triangle.style.pointerEvents = 'auto';
        triangle.style.cursor = 'ew-resize';
        g.appendChild(triangle);

        const leftTerminal = this.addTerminal(g, -35, 0, 0, comp);
        leftTerminal.style.pointerEvents = 'all';
        const rightTerminal = this.addTerminal(g, 35, 0, 1, comp);
        rightTerminal.style.pointerEvents = 'all';
        const sliderTerminal = this.addTerminal(g, sliderX, -28, 2, comp);
        sliderTerminal.style.pointerEvents = 'all';
        sliderTerminal.setAttribute('fill', '#FF5722');

        if (comp.label) {
            this.addText(g, 0, 28, comp.label, 10, 'label');
            return;
        }

        const displayR = comp.activeResistance !== undefined
            ? comp.activeResistance
            : (comp.minResistance + (comp.maxResistance - comp.minResistance) * pos);
        const directionMark = comp.resistanceDirection === 'slider-right-increase'
            ? '→↑'
            : (comp.resistanceDirection === 'slider-right-decrease' ? '→↓' : '');
        this.addText(g, 0, 28, `${displayR.toFixed(1)}Ω ${directionMark}`, 10, 'label');
    },

    renderSwitch(g, comp) {
        this.addLine(g, -30, 0, -12, 0);
        this.addLine(g, 12, 0, 30, 0);
        appendContactDot(g, -10, 0);
        appendContactDot(g, 10, 0);

        appendSwitchTouchArea(g, comp);

        const blade = createSvgNode('line', {
            x1: -10,
            y1: 0,
            class: 'switch-blade',
            stroke: '#333',
            'stroke-width': 2.5,
            'stroke-linecap': 'round'
        });
        if (comp.closed) {
            blade.setAttribute('x2', 10);
            blade.setAttribute('y2', 0);
        } else {
            blade.setAttribute('x2', 5);
            blade.setAttribute('y2', -12);
        }
        blade.style.cursor = 'pointer';
        g.appendChild(blade);

        this.addTerminal(g, -30, 0, 0, comp);
        this.addTerminal(g, 30, 0, 1, comp);

        const labelText = comp.label || (comp.closed ? '闭合' : '断开');
        this.addText(g, 0, 22, labelText, 9, 'label');
    },

    renderSPDTSwitch(g, comp) {
        const route = comp.position === 'b' ? 'b' : 'a';

        this.addLine(g, -30, 0, -12, 0);
        this.addLine(g, 12, -10, 30, -10);
        this.addLine(g, 12, 10, 30, 10);
        appendContactDot(g, -10, 0);
        appendContactDot(g, 10, -10);
        appendContactDot(g, 10, 10);

        appendSwitchTouchArea(g, comp);

        const blade = createSvgNode('line', {
            x1: -10,
            y1: 0,
            x2: 10,
            y2: route === 'a' ? -10 : 10,
            stroke: '#333',
            'stroke-width': 2.5,
            'stroke-linecap': 'round',
            class: 'switch-blade'
        });
        blade.style.cursor = 'pointer';
        g.appendChild(blade);

        this.addTerminal(g, -30, 0, 0, comp);
        this.addTerminal(g, 30, -10, 1, comp);
        this.addTerminal(g, 30, 10, 2, comp);

        const labelText = comp.label || (route === 'a' ? '上掷' : '下掷');
        this.addText(g, 0, 26, labelText, 9, 'label');
    },

    renderFuse(g, comp) {
        const blown = !!comp.blown;

        this.addLine(g, -30, 0, -12, 0);
        this.addLine(g, 12, 0, 30, 0);

        const body = createSvgNode('rect', {
            x: -12,
            y: -7,
            width: 24,
            height: 14,
            rx: 6,
            ry: 6,
            fill: blown ? '#ffebee' : '#fffde7',
            stroke: blown ? '#d32f2f' : '#8d6e63',
            'stroke-width': 2
        });
        g.appendChild(body);

        const filament = createSvgNode('line', {
            x1: -7,
            y1: 0,
            x2: 7,
            y2: 0,
            stroke: blown ? '#d32f2f' : '#6d4c41',
            'stroke-width': 2,
            'stroke-linecap': 'round'
        });
        g.appendChild(filament);

        if (blown) {
            const crack = createSvgNode('line', {
                x1: -1,
                y1: -4,
                x2: 1,
                y2: 4,
                stroke: '#d32f2f',
                'stroke-width': 2.2,
                'stroke-linecap': 'round'
            });
            g.appendChild(crack);
        }

        this.addTerminal(g, -30, 0, 0, comp);
        this.addTerminal(g, 30, 0, 1, comp);

        const labelText = comp.label || (blown ? '已熔断' : `${comp.ratedCurrent}A`);
        this.addText(g, 0, 24, labelText, 9, 'label');
    },

    renderBlackBox(g, comp) {
        const w = Math.max(80, comp.boxWidth || 180);
        const h = Math.max(60, comp.boxHeight || 110);
        const mode = comp.viewMode === 'opaque' ? 'opaque' : 'transparent';

        const rect = createSvgNode('rect', {
            x: String(-w / 2),
            y: String(-h / 2),
            width: String(w),
            height: String(h),
            rx: '14',
            ry: '14',
            class: `blackbox-body ${mode}`
        });
        g.appendChild(rect);

        const labelText = comp.label || 'BlackBox';
        this.addText(g, 0, 6, labelText, 13, 'blackbox-title');
        this.addText(g, -w / 2 + 14, -h / 2 + 18, '端口1', 10, 'blackbox-port');
        this.addText(g, w / 2 - 14, -h / 2 + 18, '端口2', 10, 'blackbox-port');
        this.addTerminal(g, -w / 2, 0, 0, comp);
        this.addTerminal(g, w / 2, 0, 1, comp);
    }
};
