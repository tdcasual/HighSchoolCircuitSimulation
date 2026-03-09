/**
 * Component.js - 元器件基类和工厂
 * 定义各种电路元器件的属性和SVG渲染
 */

import { clamp } from '../utils/Physics.js';
import {
    computeDisplayRowGap,
    updateAttributeIfChanged,
    updateTextAndStyle,
    updateTextIfChanged
} from './display/ComponentDisplayState.js';
import {
    TOUCH_TARGET_RADIUS_PX,
    TOUCH_TARGET_SIZE_PX
} from './geometry/ComponentGeometry.js';
import { createValueDisplayShape, readValueDisplayElements } from './render/ComponentShapeFactory.js';
import {
    addLine as addSvgLine,
    addTerminal as addSvgTerminal,
    addText as addSvgText
} from './render/ComponentSvgPrimitives.js';
import {
    createWire as createWireSvg,
    updateWirePath as updateWireSvgPath,
    updateWirePathWithGroup as updateWireSvgPathWithGroup
} from './render/ComponentWireRenderer.js';
import {
    addValueDisplay as addValueDisplayRenderer,
    formatValue as formatDisplayValue,
    layoutValueDisplay as layoutValueDisplayRenderer,
    updateValueDisplay as updateValueDisplayRenderer
} from './render/ComponentValueDisplayRenderer.js';
import { renderComponentByRegistry } from './render/RendererRegistry.js';
import { CONTROL_COMPONENT_RENDERERS } from './render/ControlComponentRenderers.js';
import {
    updateParallelPlateCapacitorVisualRuntime,
    updateValueDisplayRuntime
} from './render/ComponentVisualUpdater.js';
import {
    ComponentDefaults,
    ComponentNames,
    getComponentTerminalCount
} from './catalog/ComponentCatalog.js';
import {
    createComponent
} from './factory/ComponentFactory.js';

function safeHasClass(node, className) {
    if (!node || !node.classList || typeof node.classList.contains !== 'function') return false;
    try {
        return node.classList.contains(className);
    } catch (_) {
        return false;
    }
}

function safeToggleClass(node, className, force) {
    if (!node || !node.classList || typeof node.classList.toggle !== 'function') return false;
    try {
        return !!node.classList.toggle(className, force);
    } catch (_) {
        return false;
    }
}

export { ComponentDefaults, ComponentNames, getComponentTerminalCount };
export { createComponent };

const VALUE_DISPLAY_STACK_ORDER = ['power', 'voltage', 'current'];
const DEFAULT_VALUE_DISPLAY_ANCHOR = Object.freeze({ x: 0, y: -14 });
const VALUE_DISPLAY_ANCHOR_BY_TYPE = Object.freeze({
    Rheostat: Object.freeze({ x: 0, y: -22 }),
    Relay: Object.freeze({ x: 0, y: -24 }),
    Ammeter: Object.freeze({ x: 0, y: -18 }),
    Voltmeter: Object.freeze({ x: 0, y: -18 }),
    Motor: Object.freeze({ x: 0, y: -18 }),
    ParallelPlateCapacitor: Object.freeze({ x: 0, y: -16 })
});
export { TOUCH_TARGET_SIZE_PX, TOUCH_TARGET_RADIUS_PX };
export const TERMINAL_HIT_RADIUS_PX = TOUCH_TARGET_RADIUS_PX;
export const WIRE_ENDPOINT_HIT_RADIUS_PX = TOUCH_TARGET_RADIUS_PX;

export function resolveValueDisplayAnchor(comp = {}) {
    if (comp?.type === 'BlackBox') {
        const boxHeight = Math.max(60, comp.boxHeight || 110);
        return { x: 0, y: -boxHeight / 2 - 6 };
    }
    return VALUE_DISPLAY_ANCHOR_BY_TYPE[comp?.type] || DEFAULT_VALUE_DISPLAY_ANCHOR;
}

export function computeValueDisplayRowOffsets(visibleRows = [], rowGap = 15) {
    const orderedVisibleRows = VALUE_DISPLAY_STACK_ORDER.filter(row => visibleRows.includes(row));
    const safeRowGap = Math.max(1, Number.isFinite(rowGap) ? rowGap : 15);
    const rowOffsets = {};
    if (orderedVisibleRows.length === 0) {
        return rowOffsets;
    }
    const firstRowY = -(orderedVisibleRows.length - 1) * safeRowGap;
    orderedVisibleRows.forEach((row, index) => {
        rowOffsets[row] = firstRowY + index * safeRowGap;
    });
    return rowOffsets;
}

/**
 * SVG渲染器 - 生成各种元器件的SVG元素
 */
export const SVGRenderer = {
    /**
     * 创建元器件SVG组
     * @param {Object} comp - 元器件对象
     * @returns {SVGElement} SVG组元素
     */
    createComponentGroup(comp) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', `component ${comp.type.toLowerCase()}`);
        g.setAttribute('data-id', comp.id);
        g.setAttribute('transform', `translate(${comp.x}, ${comp.y}) rotate(${comp.rotation || 0})`);
        // 禁用原生拖放，防止触发 drop 事件
        g.setAttribute('draggable', 'false');
        
        renderComponentByRegistry(this, g, comp);
        
        // 添加数值显示
        this.addValueDisplay(g, comp);
        
        return g;
    },

    /**
     * 渲染接地
     */
    renderGround(g, comp) {
        // 引线与接地符号
        this.addLine(g, 0, -20, 0, -8, 2);
        this.addLine(g, -12, -8, 12, -8, 2);
        this.addLine(g, -8, -3, 8, -3, 2);
        this.addLine(g, -4, 2, 4, 2, 2);

        // 单端子（支持延长）
        this.addTerminal(g, 0, -20, 0, comp);

        const labelText = comp.label || 'GND';
        this.addText(g, 0, 18, labelText, 10, 'label');
    },

    /**
     * 渲染电源
     */
    renderPowerSource(g, comp) {
        // 连接线
        this.addLine(g, -30, 0, -10, 0);
        this.addLine(g, 10, 0, 30, 0);
        
        // 长线（正极）
        this.addLine(g, -10, -15, -10, 15, 3);
        // 短线（负极）
        this.addLine(g, 10, -8, 10, 8, 2);
        
        // 正负极标记
        this.addText(g, -18, -8, '+', 12);
        this.addText(g, 14, -8, '-', 12);
        
        // 端子（支持延长）
        this.addTerminal(g, -30, 0, 0, comp);
        this.addTerminal(g, 30, 0, 1, comp);
        
        // 标签 - 优先显示自定义标签
        const labelText = comp.label || `${comp.voltage}V`;
        this.addText(g, 0, 28, labelText, 10, 'label');
    },

    /**
     * 渲染交流电源
     */
    renderACVoltageSource(g, comp) {
        this.addLine(g, -35, 0, -16, 0);
        this.addLine(g, 16, 0, 35, 0);

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', 0);
        circle.setAttribute('cy', 0);
        circle.setAttribute('r', 16);
        circle.setAttribute('class', 'body');
        g.appendChild(circle);

        // ~ 符号
        this.addText(g, 0, 5, '~', 16, 'label');
        this.addText(g, -24, 5, '+', 10);
        this.addText(g, 24, 5, '-', 10);

        this.addTerminal(g, -35, 0, 0, comp);
        this.addTerminal(g, 35, 0, 1, comp);

        const labelText = comp.label || `${comp.rmsVoltage}V~`;
        this.addText(g, 0, 30, labelText, 9, 'label');
    },

    /**
     * 渲染定值电阻
     */
    renderResistor(g, comp) {
        // 连接线
        this.addLine(g, -30, 0, -20, 0);
        this.addLine(g, 20, 0, 30, 0);
        
        // 电阻体
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', -20);
        rect.setAttribute('y', -8);
        rect.setAttribute('width', 40);
        rect.setAttribute('height', 16);
        rect.setAttribute('class', 'body');
        g.appendChild(rect);
        
        // 端子（支持延长）
        this.addTerminal(g, -30, 0, 0, comp);
        this.addTerminal(g, 30, 0, 1, comp);
        
        // 标签 - 优先显示自定义标签
        const labelText = comp.label || `${comp.resistance}Ω`;
        this.addText(g, 0, 25, labelText, 10, 'label');
    },

    /**
     * 渲染二极管
     */
    renderDiode(g, comp) {
        // 连接线
        this.addLine(g, -30, 0, -14, 0);
        this.addLine(g, 14, 0, 30, 0);

        // 三角形（阳极侧）与竖线（阴极侧）
        const triangle = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        triangle.setAttribute('points', '-14,-10 -14,10 6,0');
        triangle.setAttribute('fill', '#fff');
        triangle.setAttribute('stroke', '#333');
        triangle.setAttribute('stroke-width', 2);
        g.appendChild(triangle);

        const cathodeBar = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        cathodeBar.setAttribute('x1', '9');
        cathodeBar.setAttribute('y1', '-12');
        cathodeBar.setAttribute('x2', '9');
        cathodeBar.setAttribute('y2', '12');
        cathodeBar.setAttribute('stroke', '#333');
        cathodeBar.setAttribute('stroke-width', 2.2);
        g.appendChild(cathodeBar);

        // 端子 0=阳极(左), 1=阴极(右)
        this.addTerminal(g, -30, 0, 0, comp);
        this.addTerminal(g, 30, 0, 1, comp);

        const isOn = !!comp.conducting;
        const labelText = comp.label || `${comp.forwardVoltage}V ${isOn ? '导通' : '截止'}`;
        this.addText(g, 0, 25, labelText, 9, 'label');
    },

    /**
     * 渲染 LED（发光二极管）
     */
    renderLED(g, comp) {
        this.addLine(g, -30, 0, -14, 0);
        this.addLine(g, 14, 0, 30, 0);

        const glow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        glow.setAttribute('cx', 0);
        glow.setAttribute('cy', 0);
        glow.setAttribute('r', 13);
        glow.setAttribute('class', 'glow led-glow');
        const color = comp.color || '#ff4d6d';
        const baseBrightness = Math.max(0, Math.min(1, Number(comp.brightness) || 0));
        glow.setAttribute('fill', color);
        glow.setAttribute('fill-opacity', String(baseBrightness * 0.85));
        g.appendChild(glow);

        const triangle = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        triangle.setAttribute('points', '-14,-10 -14,10 6,0');
        triangle.setAttribute('fill', '#fff8fb');
        triangle.setAttribute('stroke', '#333');
        triangle.setAttribute('stroke-width', 2);
        g.appendChild(triangle);

        const cathodeBar = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        cathodeBar.setAttribute('x1', '9');
        cathodeBar.setAttribute('y1', '-12');
        cathodeBar.setAttribute('x2', '9');
        cathodeBar.setAttribute('y2', '12');
        cathodeBar.setAttribute('stroke', '#333');
        cathodeBar.setAttribute('stroke-width', 2.2);
        g.appendChild(cathodeBar);

        this.addLine(g, -2, -14, 4, -20, 1.6);
        this.addLine(g, 2, -10, 8, -16, 1.6);
        const arrow1 = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        arrow1.setAttribute('points', '4,-20 2,-18 5,-18');
        arrow1.setAttribute('fill', color);
        g.appendChild(arrow1);
        const arrow2 = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        arrow2.setAttribute('points', '8,-16 6,-14 9,-14');
        arrow2.setAttribute('fill', color);
        g.appendChild(arrow2);

        this.addTerminal(g, -30, 0, 0, comp); // anode
        this.addTerminal(g, 30, 0, 1, comp);  // cathode

        const labelText = comp.label || `LED ${comp.forwardVoltage}V`;
        this.addText(g, 0, 25, labelText, 9, 'label');
    },

    /**
     * 渲染热敏电阻（NTC）
     */
    renderThermistor(g, comp) {
        this.addLine(g, -30, 0, -20, 0);
        this.addLine(g, 20, 0, 30, 0);

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', -20);
        rect.setAttribute('y', -8);
        rect.setAttribute('width', 40);
        rect.setAttribute('height', 16);
        rect.setAttribute('class', 'body');
        g.appendChild(rect);

        this.addLine(g, -14, 10, 14, -10, 1.8);
        this.addText(g, 0, -14, 'T', 9, 'label');

        this.addTerminal(g, -30, 0, 0, comp);
        this.addTerminal(g, 30, 0, 1, comp);

        const labelText = comp.label || `NTC ${Math.round(comp.temperatureC ?? 25)}°C`;
        this.addText(g, 0, 25, labelText, 9, 'label');
    },

    /**
     * 渲染光敏电阻（LDR）
     */
    renderPhotoresistor(g, comp) {
        this.addLine(g, -30, 0, -20, 0);
        this.addLine(g, 20, 0, 30, 0);

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', -20);
        rect.setAttribute('y', -8);
        rect.setAttribute('width', 40);
        rect.setAttribute('height', 16);
        rect.setAttribute('class', 'body');
        g.appendChild(rect);

        // 入射光箭头
        this.addLine(g, -12, -18, -2, -8, 1.6);
        this.addLine(g, -2, -18, 8, -8, 1.6);
        const arrow1 = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        arrow1.setAttribute('points', '-2,-8 -5,-9 -4,-6');
        arrow1.setAttribute('fill', '#333');
        g.appendChild(arrow1);
        const arrow2 = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        arrow2.setAttribute('points', '8,-8 5,-9 6,-6');
        arrow2.setAttribute('fill', '#333');
        g.appendChild(arrow2);

        this.addTerminal(g, -30, 0, 0, comp);
        this.addTerminal(g, 30, 0, 1, comp);

        const lightPercent = Math.round((Number.isFinite(comp.lightLevel) ? comp.lightLevel : 0.5) * 100);
        const labelText = comp.label || `LDR ${lightPercent}%`;
        this.addText(g, 0, 25, labelText, 9, 'label');
    },

    ...CONTROL_COMPONENT_RENDERERS,

    /**
     * 渲染灯泡
     */
    renderBulb(g, comp) {
        // 连接线
        this.addLine(g, -30, 0, -15, 0);
        this.addLine(g, 15, 0, 30, 0);
        
        // 发光层（用于动画）
        const glow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        glow.setAttribute('cx', 0);
        glow.setAttribute('cy', 0);
        glow.setAttribute('r', 14);
        glow.setAttribute('class', 'glow');
        glow.setAttribute('fill', `rgba(255, 235, 59, ${comp.brightness || 0})`);
        g.appendChild(glow);
        
        // 灯泡圆圈
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', 0);
        circle.setAttribute('cy', 0);
        circle.setAttribute('r', 12);
        circle.setAttribute('class', 'body');
        g.appendChild(circle);
        
        // 交叉线
        this.addLine(g, -8, -8, 8, 8, 1.5);
        this.addLine(g, 8, -8, -8, 8, 1.5);
        
        // 端子（支持延长）
        this.addTerminal(g, -30, 0, 0, comp);
        this.addTerminal(g, 30, 0, 1, comp);
        
        // 标签 - 优先显示自定义标签
        const labelText = comp.label || `${comp.ratedPower}W`;
        this.addText(g, 0, 28, labelText, 10, 'label');
    },

    /**
     * 渲染电容
     */
    renderCapacitor(g, comp) {
        // 连接线
        this.addLine(g, -30, 0, -5, 0);
        this.addLine(g, 5, 0, 30, 0);
        
        // 两条平行线
        const leftPlate = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        leftPlate.setAttribute('x1', -5);
        leftPlate.setAttribute('y1', -12);
        leftPlate.setAttribute('x2', -5);
        leftPlate.setAttribute('y2', 12);
        leftPlate.setAttribute('stroke-width', 2);
        leftPlate.setAttribute('class', 'capacitor-plate');
        g.appendChild(leftPlate);
        
        const rightPlate = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        rightPlate.setAttribute('x1', 5);
        rightPlate.setAttribute('y1', -12);
        rightPlate.setAttribute('x2', 5);
        rightPlate.setAttribute('y2', 12);
        rightPlate.setAttribute('stroke-width', 2);
        rightPlate.setAttribute('class', 'capacitor-plate');
        g.appendChild(rightPlate);
        
        // 端子（支持延长）
        this.addTerminal(g, -30, 0, 0, comp);
        this.addTerminal(g, 30, 0, 1, comp);
        
        // 标签 - 显示电容值，优先显示自定义标签
        if (comp.label) {
            this.addText(g, 0, 25, comp.label, 10, 'label');
        } else {
            const capValue = comp.capacitance >= 0.001 
                ? `${(comp.capacitance * 1000).toFixed(0)}mF`
                : `${(comp.capacitance * 1000000).toFixed(0)}μF`;
            this.addText(g, 0, 25, capValue, 10, 'label');
        }
    },

    /**
     * 渲染电感
     */
    renderInductor(g, comp) {
        this.addLine(g, -35, 0, -25, 0);
        this.addLine(g, 25, 0, 35, 0);

        const loops = 4;
        const radius = 5;
        const startX = -20;
        for (let i = 0; i < loops; i++) {
            const cx = startX + i * (radius * 2) + radius;
            const arc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            arc.setAttribute('d', `M ${cx - radius} 0 A ${radius} ${radius} 0 0 1 ${cx + radius} 0`);
            arc.setAttribute('fill', 'none');
            arc.setAttribute('stroke', '#333');
            arc.setAttribute('stroke-width', '2');
            g.appendChild(arc);
        }

        this.addTerminal(g, -35, 0, 0, comp);
        this.addTerminal(g, 35, 0, 1, comp);

        const labelText = comp.label || `${comp.inductance}H`;
        this.addText(g, 0, 25, labelText, 10, 'label');
    },

    /**
     * 渲染平行板电容（探索模式：可拖动右侧极板演示 d/重叠面积 对 C 的影响）
     */
    renderParallelPlateCapacitor(g, comp) {
        const plateLengthPx = 24;
        const halfLen = plateLengthPx / 2;
        const pxPerMm = 10;
        const minGapPx = 6;
        const maxGapPx = 30;
        const distanceMm = (comp.plateDistance ?? 0.001) * 1000;
        const gapPx = clamp(distanceMm * pxPerMm, minGapPx, maxGapPx);
        const offsetY = clamp(comp.plateOffsetYPx ?? 0, -plateLengthPx, plateLengthPx);

        const leftX = -gapPx / 2;
        const rightX = gapPx / 2;

        // 连接线
        const leftConn = this.addLine(g, -30, 0, leftX, 0);
        leftConn.setAttribute('class', 'ppc-connector ppc-connector-left');
        const rightConn = this.addLine(g, rightX, 0, 30, 0);
        rightConn.setAttribute('class', 'ppc-connector ppc-connector-right');

        // 极板（左固定、右可动）
        const plateWidth = 4;

        const leftPlate = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        leftPlate.setAttribute('x', leftX - plateWidth / 2);
        leftPlate.setAttribute('y', -halfLen);
        leftPlate.setAttribute('width', plateWidth);
        leftPlate.setAttribute('height', plateLengthPx);
        leftPlate.setAttribute('fill', 'none');
        leftPlate.setAttribute('stroke-width', 2);
        leftPlate.setAttribute('class', 'capacitor-plate plate-capacitor-plate ppc-plate ppc-plate-left');
        g.appendChild(leftPlate);

        const rightPlate = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rightPlate.setAttribute('x', rightX - plateWidth / 2);
        rightPlate.setAttribute('y', -halfLen + offsetY);
        rightPlate.setAttribute('width', plateWidth);
        rightPlate.setAttribute('height', plateLengthPx);
        rightPlate.setAttribute('fill', 'none');
        rightPlate.setAttribute('stroke-width', 2);
        rightPlate.setAttribute('class', 'capacitor-plate plate-capacitor-plate ppc-plate ppc-plate-right plate-movable');
        rightPlate.setAttribute('data-role', 'plate-movable');
        if (comp.explorationMode) {
            rightPlate.style.pointerEvents = 'all';
            rightPlate.style.cursor = 'grab';
        } else {
            rightPlate.style.pointerEvents = 'none';
        }
        g.appendChild(rightPlate);

        // 端子（支持延长）
        this.addTerminal(g, -30, 0, 0, comp);
        this.addTerminal(g, 30, 0, 1, comp);

        // 标签
        if (comp.label) {
            this.addText(g, 0, 25, comp.label, 10, 'label ppc-label');
        } else {
            // 根据量级显示 pF/nF/μF/mF
            const C = comp.capacitance || 0;
            let text;
            if (Math.abs(C) >= 1e-3) {
                text = `${(C * 1e3).toFixed(0)}mF`;
            } else if (Math.abs(C) >= 1e-6) {
                text = `${(C * 1e6).toFixed(1)}μF`;
            } else if (Math.abs(C) >= 1e-9) {
                text = `${(C * 1e9).toFixed(1)}nF`;
            } else {
                text = `${(C * 1e12).toFixed(1)}pF`;
            }
            this.addText(g, 0, 25, text, 10, 'label ppc-label');
        }
    },

    /**
     * 渲染电动机
     */
    renderMotor(g, comp) {
        // 连接线
        this.addLine(g, -35, 0, -18, 0);
        this.addLine(g, 18, 0, 35, 0);
        
        // 圆圈
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', 0);
        circle.setAttribute('cy', 0);
        circle.setAttribute('r', 16);
        circle.setAttribute('class', 'body');
        g.appendChild(circle);
        
        // M 标记
        this.addText(g, 0, 5, 'M', 14, 'label');
        
        // 端子（支持延长）
        this.addTerminal(g, -35, 0, 0, comp);
        this.addTerminal(g, 35, 0, 1, comp);
        
        // 显示自定义标签或转速
        if (comp.label) {
            this.addText(g, 0, 32, comp.label, 9, 'label');
        } else if (comp.speed !== undefined) {
            this.addText(g, 0, 32, `${(comp.speed * 60 / (2 * Math.PI)).toFixed(0)} rpm`, 9, 'label');
        }
    },

    /**
     * 渲染电流表
     */
    renderAmmeter(g, comp) {
        // 连接线
        this.addLine(g, -35, 0, -18, 0);
        this.addLine(g, 18, 0, 35, 0);
        
        // 圆圈表盘
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', 0);
        circle.setAttribute('cy', 0);
        circle.setAttribute('r', 16);
        circle.setAttribute('class', 'meter-body ammeter-body');
        circle.setAttribute('fill', '#fff');
        circle.setAttribute('stroke', '#c00');
        circle.setAttribute('stroke-width', 2);
        g.appendChild(circle);
        
        // A 标记
        this.addText(g, 0, 5, 'A', 14, 'meter-label');
        
        // 正负极标记
        this.addText(g, -22, 4, '+', 10);
        this.addText(g, 22, 4, '-', 10);
        
        // 端子
        this.addTerminal(g, -35, 0, 0, comp);
        this.addTerminal(g, 35, 0, 1, comp);
        
        // 量程标签 - 优先显示自定义标签
        const labelText = comp.label || `${comp.range}A`;
        this.addText(g, 0, 30, labelText, 9, 'label');
    },

    /**
     * 渲染电压表
     */
    renderVoltmeter(g, comp) {
        // 连接线
        this.addLine(g, -35, 0, -18, 0);
        this.addLine(g, 18, 0, 35, 0);
        
        // 圆圈表盘
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', 0);
        circle.setAttribute('cy', 0);
        circle.setAttribute('r', 16);
        circle.setAttribute('class', 'meter-body voltmeter-body');
        circle.setAttribute('fill', '#fff');
        circle.setAttribute('stroke', '#00c');
        circle.setAttribute('stroke-width', 2);
        g.appendChild(circle);
        
        // V 标记
        this.addText(g, 0, 5, 'V', 14, 'meter-label');
        
        // 正负极标记
        this.addText(g, -22, 4, '+', 10);
        this.addText(g, 22, 4, '-', 10);
        
        // 端子
        this.addTerminal(g, -35, 0, 0, comp);
        this.addTerminal(g, 35, 0, 1, comp);
        
        // 量程标签 - 优先显示自定义标签
        const labelText = comp.label || `${comp.range}V`;
        this.addText(g, 0, 30, labelText, 9, 'label');
    },

    /**
     * 辅助方法：添加线段
     */
    addLine(g, x1, y1, x2, y2, strokeWidth = 2) {
        return addSvgLine(g, x1, y1, x2, y2, strokeWidth);
    },

    /**
     * 辅助方法：添加端子
     */
    addTerminal(g, x, y, index, comp = null) {
        return addSvgTerminal(g, x, y, index, comp, TERMINAL_HIT_RADIUS_PX);
    },

    /**
     * 辅助方法：添加文本
     */
    addText(g, x, y, text, fontSize = 10, className = '') {
        return addSvgText(g, x, y, text, fontSize, className);
    },

    /**
     * 添加数值显示
     */
    addValueDisplay(g, comp) {
        return addValueDisplayRenderer({
            g,
            comp,
            createValueDisplayShape,
            resolveValueDisplayAnchor,
            layoutValueDisplay: (target, targetComp) => this.layoutValueDisplay(target, targetComp)
        });
    },

    getValueDisplayElements(g) {
        return readValueDisplayElements(g);
    },

    setElementTextIfChanged(element, nextText) {
        return updateTextIfChanged(element, nextText);
    },

    setElementAttributeIfChanged(element, name, value) {
        return updateAttributeIfChanged(element, name, value);
    },

    setDisplayTextAndStyle(element, text, fontSize = null, fontWeight = null) {
        return updateTextAndStyle(element, text, fontSize, fontWeight);
    },

    resolveValueDisplayRowGap(visibleDisplays) {
        return computeDisplayRowGap(visibleDisplays);
    },

    layoutValueDisplay(g, comp) {
        return layoutValueDisplayRenderer({
            g,
            comp,
            getValueDisplayElements: (node) => this.getValueDisplayElements(node),
            valueDisplayStackOrder: VALUE_DISPLAY_STACK_ORDER,
            resolveValueDisplayAnchor,
            resolveValueDisplayRowGap: (items) => this.resolveValueDisplayRowGap(items),
            setElementAttributeIfChanged: (...args) => this.setElementAttributeIfChanged(...args),
            computeValueDisplayRowOffsets
        });
    },

    /**
     * 更新元器件的数值显示
     */
    updateValueDisplay(g, comp, showCurrent, showVoltage, showPower) {
        return updateValueDisplayRenderer({
            g,
            comp,
            showCurrent,
            showVoltage,
            showPower,
            updateValueDisplayRuntime,
            getValueDisplayElements: (node) => this.getValueDisplayElements(node),
            setDisplayTextAndStyle: (...args) => this.setDisplayTextAndStyle(...args),
            layoutValueDisplay: (target, targetComp) => this.layoutValueDisplay(target, targetComp),
            formatValue: (value, unit) => this.formatValue(value, unit),
            setElementAttributeIfChanged: (...args) => this.setElementAttributeIfChanged(...args),
            safeToggleClass
        });
    },

    /**
     * 更新平行板电容的极板位置与标签（用于拖动探索模式，避免整组重绘导致闪烁）
     */
    updateParallelPlateCapacitorVisual(g, comp) {
        return updateParallelPlateCapacitorVisualRuntime({
            g,
            comp,
            helpers: {
                setElementAttributeIfChanged: (...args) => this.setElementAttributeIfChanged(...args)
            }
        });
    },

    /**
     * 格式化数值 - 更清晰的显示
     */
    formatValue(value, unit) {
        return formatDisplayValue(value, unit);
    },

    /**
     * 创建导线SVG
     */
    createWire(wire, getWireEndpointPosition = null) {
        return createWireSvg(wire, {
            getWireEndpointPosition,
            safeHasClassFn: safeHasClass,
            wireEndpointHitRadius: WIRE_ENDPOINT_HIT_RADIUS_PX
        });
    },

    /**
     * 更新导线路径
     */
    updateWirePath(pathOrGroup, wire, getWireEndpointPosition = null) {
        return updateWireSvgPath(pathOrGroup, wire, {
            getWireEndpointPosition,
            safeHasClassFn: safeHasClass,
            wireEndpointHitRadius: WIRE_ENDPOINT_HIT_RADIUS_PX
        });
    },

    /**
     * 更新导线组（路径+端点）
     */
    updateWirePathWithGroup(g, wire, getWireEndpointPosition = null) {
        return updateWireSvgPathWithGroup(g, wire, {
            getWireEndpointPosition,
            safeHasClassFn: safeHasClass,
            wireEndpointHitRadius: WIRE_ENDPOINT_HIT_RADIUS_PX
        });
    }
};
