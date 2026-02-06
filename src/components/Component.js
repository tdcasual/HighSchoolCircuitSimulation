/**
 * Component.js - 元器件基类和工厂
 * 定义各种电路元器件的属性和SVG渲染
 */

import { clamp, computeOverlapFractionFromOffsetPx, computeParallelPlateCapacitance } from '../utils/Physics.js';

// 元器件ID计数器
let componentIdCounter = 0;

/**
 * 生成唯一ID
 * @param {string} type - 元器件类型
 * @returns {string} 唯一ID
 */
export function generateId(type) {
    return `${type}_${++componentIdCounter}`;
}

/**
 * 重置ID计数器
 */
export function resetIdCounter() {
    componentIdCounter = 0;
}

/**
 * 根据现有ID更新计数器，防止ID冲突
 * @param {string[]} existingIds - 现有的ID列表
 */
export function updateIdCounterFromExisting(existingIds) {
    let maxNum = 0;
    for (const id of existingIds) {
        // 提取ID中的数字部分
        const match = id.match(/_(\d+)$/);
        if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) {
                maxNum = num;
            }
        }
    }
    componentIdCounter = maxNum;
}

/**
 * 元器件默认属性
 */
export const ComponentDefaults = {
    Ground: {
        isReference: true      // 参考地
    },
    PowerSource: {
        voltage: 12,           // 电动势 (V)
        internalResistance: 0.5 // 内阻 (Ω)
    },
    ACVoltageSource: {
        rmsVoltage: 12,        // 有效值 (V)
        frequency: 50,         // 频率 (Hz)
        phase: 0,              // 初相 (deg)
        offset: 0,             // 直流偏置 (V)
        internalResistance: 0.5 // 内阻 (Ω)
    },
    Resistor: {
        resistance: 100        // 电阻值 (Ω)
    },
    Rheostat: {
        minResistance: 0,      // 最小电阻 (Ω)
        maxResistance: 100,    // 最大电阻 (Ω)
        position: 0.5,         // 滑块位置 (0-1)
        connectionMode: 'none', // 连接模式
        activeResistance: 0,   // 接入电路的实际电阻
        resistanceDirection: 'disconnected' // 电阻变化方向
    },
    Bulb: {
        resistance: 50,        // 灯丝电阻 (Ω)
        ratedPower: 5          // 额定功率 (W)
    },
    Capacitor: {
        capacitance: 0.001,    // 电容值 (F) = 1000μF
        integrationMethod: 'auto', // 积分方法：auto/trapezoidal/backward-euler
        prevCurrent: 0         // 上一时刻电流 (A)，用于梯形法历史项
    },
    Inductor: {
        inductance: 0.1,       // 电感值 (H)
        initialCurrent: 0,     // 初始电流 (A)
        prevCurrent: 0,        // 上一时刻电流 (A)
        prevVoltage: 0,        // 上一时刻两端电压 (V)，用于梯形法历史项
        integrationMethod: 'auto' // 积分方法：auto/trapezoidal/backward-euler
    },
    ParallelPlateCapacitor: {
        // 平行板电容（用于演示 C 的决定因素）
        plateArea: 0.01,           // 极板面积 A (m²) = 100 cm²
        plateDistance: 0.001,      // 极板间距 d (m) = 1 mm
        dielectricConstant: 1,     // 相对介电常数 εr
        plateOffsetYPx: 0,         // 单极板纵向偏移（用于演示重叠面积），单位：局部像素
        explorationMode: true,     // 是否开启探索模式（允许拖动极板）
        capacitance: 8.854e-11,    // 由默认 A/d 估算得到的电容（F）
        integrationMethod: 'auto', // 积分方法：auto/trapezoidal/backward-euler
        prevCurrent: 0             // 上一时刻电流 (A)，用于梯形法历史项
    },
    Motor: {
        resistance: 5,         // 电枢电阻 (Ω)
        torqueConstant: 0.1,   // 转矩常数 (N·m/A)
        emfConstant: 0.1,      // 反电动势常数 (V·s/rad)
        inertia: 0.01,         // 转动惯量 (kg·m²)
        loadTorque: 0.01       // 负载转矩 (N·m)
    },
    Switch: {
        closed: false          // 开关状态：false=断开，true=闭合
    },
    Ammeter: {
        resistance: 0,         // 内阻 (Ω)，0表示理想电流表
        range: 3,              // 量程 (A)
        selfReading: false     // 自主读数模式（右侧指针表盘）
    },
    Voltmeter: {
        resistance: Infinity,  // 内阻 (Ω)，Infinity表示理想电压表
        range: 15,             // 量程 (V)
        selfReading: false     // 自主读数模式（右侧指针表盘）
    },
    BlackBox: {
        // 黑箱/组合容器：用于遮挡或透明观察内部电路
        boxWidth: 180,         // 盒子宽度（局部坐标 px）
        boxHeight: 110,        // 盒子高度（局部坐标 px）
        viewMode: 'transparent' // 'transparent' | 'opaque'
    }
};

/**
 * 元器件显示名称
 */
export const ComponentNames = {
    Ground: '接地',
    PowerSource: '电源',
    ACVoltageSource: '交流电源',
    Resistor: '定值电阻',
    Rheostat: '滑动变阻器',
    Bulb: '灯泡',
    Capacitor: '电容',
    Inductor: '电感',
    ParallelPlateCapacitor: '平行板电容',
    Motor: '电动机',
    Switch: '开关',
    Ammeter: '电流表',
    Voltmeter: '电压表',
    BlackBox: '黑箱'
};

const COMPONENT_TERMINAL_COUNT = Object.freeze({
    Ground: 1,
    Rheostat: 3
});

export function getComponentTerminalCount(type) {
    return COMPONENT_TERMINAL_COUNT[type] || 2;
}

const VALUE_DISPLAY_STACK_ORDER = ['power', 'voltage', 'current'];
const DEFAULT_VALUE_DISPLAY_ANCHOR = Object.freeze({ x: 0, y: -14 });
const VALUE_DISPLAY_ANCHOR_BY_TYPE = Object.freeze({
    Rheostat: Object.freeze({ x: 0, y: -22 }),
    Ammeter: Object.freeze({ x: 0, y: -18 }),
    Voltmeter: Object.freeze({ x: 0, y: -18 }),
    Motor: Object.freeze({ x: 0, y: -18 }),
    ParallelPlateCapacitor: Object.freeze({ x: 0, y: -16 })
});

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
 * 创建元器件对象
 * @param {string} type - 元器件类型
 * @param {number} x - X坐标
 * @param {number} y - Y坐标
 * @param {string} existingId - 可选，使用现有的ID（用于加载保存的电路）
 * @returns {Object} 元器件对象
 */
export function createComponent(type, x, y, existingId = null) {
    const defaults = ComponentDefaults[type] || {};
    
    // 确定端子数量
    const terminalCount = getComponentTerminalCount(type);
    
    // 初始化端子延长数据
    const terminalExtensions = {};
    for (let i = 0; i < terminalCount; i++) {
        terminalExtensions[i] = { x: 0, y: 0 }; // 相对于默认位置的偏移
    }
    
    const id = existingId || generateId(type);
    
    const defaultDisplay = {
        current: true,
        voltage: false,
        power: false
    };
    // 仪表默认显示其“主读数”
    if (type === 'Voltmeter') {
        defaultDisplay.current = false;
        defaultDisplay.voltage = true;
    }
    // 开关默认不显示数值（避免干扰）
    if (type === 'Switch' || type === 'Ground') {
        defaultDisplay.current = false;
        defaultDisplay.voltage = false;
        defaultDisplay.power = false;
    }
    // 黑箱仅用于封装/遮挡，默认不显示数值
    if (type === 'BlackBox') {
        defaultDisplay.current = false;
        defaultDisplay.voltage = false;
        defaultDisplay.power = false;
    }

    const component = {
        id: id,
        type: type,
        label: null,           // 自定义标签 (如 V1, R1, R2 等)
        x: x,
        y: y,
        rotation: 0,
        // 节点数组长度与端子数一致，避免三端器件节点丢失
        nodes: Array.from({ length: terminalCount }, () => -1),
        currentValue: 0,       // 当前电流
        voltageValue: 0,       // 当前电压
        powerValue: 0,         // 当前功率
        // 数值显示开关：每个元器件单独配置
        // 默认仅显示电流，电压/功率默认隐藏
        display: defaultDisplay,
        terminalExtensions: terminalExtensions, // 端子延长偏移
        ...defaults
    };

    // 平行板电容：根据物理参数计算初始电容值
    if (type === 'ParallelPlateCapacitor') {
        const plateLengthPx = 24;
        const overlapFraction = computeOverlapFractionFromOffsetPx(component.plateOffsetYPx || 0, plateLengthPx);
        component.capacitance = computeParallelPlateCapacitance({
            plateArea: component.plateArea,
            plateDistance: component.plateDistance,
            dielectricConstant: component.dielectricConstant,
            overlapFraction
        });
    }

    return component;
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
        
        // 根据类型渲染不同的元器件
        switch (comp.type) {
            case 'Ground':
                this.renderGround(g, comp);
                break;
            case 'PowerSource':
                this.renderPowerSource(g, comp);
                break;
            case 'ACVoltageSource':
                this.renderACVoltageSource(g, comp);
                break;
            case 'Resistor':
                this.renderResistor(g, comp);
                break;
            case 'Rheostat':
                this.renderRheostat(g, comp);
                break;
            case 'Bulb':
                this.renderBulb(g, comp);
                break;
            case 'Capacitor':
                this.renderCapacitor(g, comp);
                break;
            case 'Inductor':
                this.renderInductor(g, comp);
                break;
            case 'ParallelPlateCapacitor':
                this.renderParallelPlateCapacitor(g, comp);
                break;
            case 'Motor':
                this.renderMotor(g, comp);
                break;
            case 'Switch':
                this.renderSwitch(g, comp);
                break;
            case 'Ammeter':
                this.renderAmmeter(g, comp);
                break;
            case 'Voltmeter':
                this.renderVoltmeter(g, comp);
                break;
            case 'BlackBox':
                this.renderBlackBox(g, comp);
                break;
        }
        
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
     * 渲染滑动变阻器
     */
    renderRheostat(g, comp) {
        // 连接线
        this.addLine(g, -35, 0, -25, 0);
        this.addLine(g, 25, 0, 35, 0);
        
        // 电阻体
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', -25);
        rect.setAttribute('y', -8);
        rect.setAttribute('width', 50);
        rect.setAttribute('height', 16);
        rect.setAttribute('class', 'body');
        g.appendChild(rect);
        
        // 滑块位置 - 限制在电阻体范围内，避免穿模
        // position may be 0; do not use || 0.5
        const posRaw = comp.position !== undefined ? comp.position : 0.5;
        const pos = Math.min(Math.max(posRaw, 0), 1);
        // keep terminal coordinates integer to avoid hidden rounding in connectivity
        const sliderX = Math.round(-20 + 40 * pos); // 从 -20 到 +20，留出边距
        
        // 滑动杆（横跨电阻体上方）
        this.addLine(g, -25, -12, 25, -12, 1.5);
        
        // 滑块连接线（从滑块位置向上到端子）
        this.addLine(g, sliderX, -12, sliderX, -25, 2);
        
        // 滑块三角形（可拖动调节）- 指向下方接触电阻体
        const triangle = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        triangle.setAttribute('points', `${sliderX - 6},-16 ${sliderX + 6},-16 ${sliderX},-9`);
        triangle.setAttribute('class', 'rheostat-slider');
        triangle.setAttribute('fill', '#2196F3');
        triangle.style.pointerEvents = 'auto';
        triangle.style.cursor = 'ew-resize';
        g.appendChild(triangle);
        
        // 端子 0: 左端（支持延长）
        const term0 = this.addTerminal(g, -35, 0, 0, comp);
        term0.style.pointerEvents = 'all';
        
        // 端子 1: 右端（支持延长）
        const term1 = this.addTerminal(g, 35, 0, 1, comp);
        term1.style.pointerEvents = 'all';
        
        // 端子 2: 滑动触点（上方，支持延长）
        const term2 = this.addTerminal(g, sliderX, -28, 2, comp);
        term2.style.pointerEvents = 'all';
        term2.setAttribute('fill', '#FF5722'); // 不同颜色以区分
        
        // 标签 - 显示接入电路的实际电阻，优先显示自定义标签
        if (comp.label) {
            this.addText(g, 0, 28, comp.label, 10, 'label');
        } else {
            const displayR = comp.activeResistance !== undefined ? comp.activeResistance :
                (comp.minResistance + (comp.maxResistance - comp.minResistance) * pos);
            const directionMark = comp.resistanceDirection === 'slider-right-increase' ? '→↑' :
                                  comp.resistanceDirection === 'slider-right-decrease' ? '→↓' : '';
            this.addText(g, 0, 28, `${displayR.toFixed(1)}Ω ${directionMark}`, 10, 'label');
        }
    },

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
     * 渲染开关
     */
    renderSwitch(g, comp) {
        // 连接线
        this.addLine(g, -30, 0, -12, 0);
        this.addLine(g, 12, 0, 30, 0);
        
        // 开关触点
        const leftDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        leftDot.setAttribute('cx', -10);
        leftDot.setAttribute('cy', 0);
        leftDot.setAttribute('r', 3);
        leftDot.setAttribute('fill', '#333');
        g.appendChild(leftDot);
        
        const rightDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        rightDot.setAttribute('cx', 10);
        rightDot.setAttribute('cy', 0);
        rightDot.setAttribute('r', 3);
        rightDot.setAttribute('fill', '#333');
        g.appendChild(rightDot);
        
        // 透明的触摸区域（便于点击切换）
        const touchArea = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        touchArea.setAttribute('x', -12);
        touchArea.setAttribute('y', -15);
        touchArea.setAttribute('width', 24);
        touchArea.setAttribute('height', 18);
        touchArea.setAttribute('fill', 'transparent');
        touchArea.setAttribute('class', 'switch-touch');
        touchArea.style.cursor = 'pointer';
        g.appendChild(touchArea);
        
        // 开关刀（可动部分）
        const blade = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        blade.setAttribute('x1', -10);
        blade.setAttribute('y1', 0);
        blade.setAttribute('class', 'switch-blade');
        if (comp.closed) {
            // 闭合状态
            blade.setAttribute('x2', 10);
            blade.setAttribute('y2', 0);
        } else {
            // 断开状态
            blade.setAttribute('x2', 5);
            blade.setAttribute('y2', -12);
        }
        blade.setAttribute('stroke', '#333');
        blade.setAttribute('stroke-width', 2.5);
        blade.setAttribute('stroke-linecap', 'round');
        blade.style.cursor = 'pointer';
        g.appendChild(blade);
        
        // 端子
        this.addTerminal(g, -30, 0, 0, comp);
        this.addTerminal(g, 30, 0, 1, comp);
        
        // 状态标签 - 优先显示自定义标签
        const labelText = comp.label || (comp.closed ? '闭合' : '断开');
        this.addText(g, 0, 22, labelText, 9, 'label');
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
     * 渲染黑箱（组合容器）
     */
    renderBlackBox(g, comp) {
        const w = Math.max(80, comp.boxWidth || 180);
        const h = Math.max(60, comp.boxHeight || 110);
        const mode = comp.viewMode === 'opaque' ? 'opaque' : 'transparent';

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', String(-w / 2));
        rect.setAttribute('y', String(-h / 2));
        rect.setAttribute('width', String(w));
        rect.setAttribute('height', String(h));
        rect.setAttribute('rx', '14');
        rect.setAttribute('ry', '14');
        rect.setAttribute('class', `blackbox-body ${mode}`);
        g.appendChild(rect);

        // 标题
        const labelText = comp.label || 'BlackBox';
        this.addText(g, 0, 6, labelText, 13, 'blackbox-title');

        // 端口提示
        this.addText(g, -w / 2 + 14, -h / 2 + 18, '端口1', 10, 'blackbox-port');
        this.addText(g, w / 2 - 14, -h / 2 + 18, '端口2', 10, 'blackbox-port');

        // 端子：放在盒子边缘中心（内部连线可从盒子内接到边缘；外部连线从外侧接入）
        this.addTerminal(g, -w / 2, 0, 0, comp);
        this.addTerminal(g, w / 2, 0, 1, comp);
    },

    /**
     * 辅助方法：添加线段
     */
    addLine(g, x1, y1, x2, y2, strokeWidth = 2) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('stroke', '#333');
        line.setAttribute('stroke-width', strokeWidth);
        g.appendChild(line);
        return line;
    },

    /**
     * 辅助方法：添加端子
     */
    addTerminal(g, x, y, index, comp = null) {
        // 获取端子延长偏移
        let extX = 0, extY = 0;
        if (comp && comp.terminalExtensions && comp.terminalExtensions[index]) {
            extX = comp.terminalExtensions[index].x || 0;
            extY = comp.terminalExtensions[index].y || 0;
        }
        
        // 如果有延长，绘制引出线
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

        // 透明触控命中区（不改变可视尺寸）
        const hitCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        hitCircle.setAttribute('cx', x + extX);
        hitCircle.setAttribute('cy', y + extY);
        hitCircle.setAttribute('r', 14);
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
        // 确保端子可以接收鼠标事件
        circle.style.pointerEvents = 'all';
        circle.setAttribute('draggable', 'false');
        g.appendChild(circle);
        return circle;
    },

    /**
     * 辅助方法：添加文本
     */
    addText(g, x, y, text, fontSize = 10, className = '') {
        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('x', x);
        textEl.setAttribute('y', y);
        textEl.setAttribute('text-anchor', 'middle');
        textEl.setAttribute('font-size', fontSize);
        textEl.setAttribute('class', className);
        textEl.textContent = text;
        g.appendChild(textEl);
        return textEl;
    },

    /**
     * 添加数值显示
     */
    addValueDisplay(g, comp) {
        const valueGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        valueGroup.setAttribute('class', 'value-display-group');
        const anchor = resolveValueDisplayAnchor(comp);
        valueGroup.setAttribute('transform', `translate(${anchor.x}, ${anchor.y})`);
        
        // 电流显示（最下方）
        const currentText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        currentText.setAttribute('class', 'value-display current-display');
        currentText.setAttribute('x', 0);
        currentText.setAttribute('y', 0);
        currentText.setAttribute('text-anchor', 'middle');
        currentText.setAttribute('font-size', '13');
        currentText.setAttribute('font-weight', '600');
        currentText.textContent = '';
        valueGroup.appendChild(currentText);
        
        // 电压显示（中间）
        const voltageText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        voltageText.setAttribute('class', 'value-display voltage-display');
        voltageText.setAttribute('x', 0);
        voltageText.setAttribute('y', 0);
        voltageText.setAttribute('text-anchor', 'middle');
        voltageText.setAttribute('font-size', '13');
        voltageText.setAttribute('font-weight', '600');
        voltageText.textContent = '';
        valueGroup.appendChild(voltageText);
        
        // 功率显示（最上方）
        const powerText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        powerText.setAttribute('class', 'value-display power-display');
        powerText.setAttribute('x', 0);
        powerText.setAttribute('y', 0);
        powerText.setAttribute('text-anchor', 'middle');
        powerText.setAttribute('font-size', '13');
        powerText.setAttribute('font-weight', '600');
        powerText.textContent = '';
        valueGroup.appendChild(powerText);
        
        g.appendChild(valueGroup);
        this.layoutValueDisplay(g, comp);
    },

    resolveValueDisplayRowGap(visibleDisplays) {
        if (!Array.isArray(visibleDisplays) || visibleDisplays.length === 0) {
            return 15;
        }
        const maxFontSize = visibleDisplays.reduce((maxSize, display) => {
            const fontSizeAttr = parseFloat(display.getAttribute('font-size') || '13');
            if (!Number.isFinite(fontSizeAttr)) {
                return maxSize;
            }
            return Math.max(maxSize, fontSizeAttr);
        }, 13);
        return Math.max(12, Math.round(maxFontSize + 2));
    },

    layoutValueDisplay(g, comp) {
        const valueGroup = g.querySelector('.value-display-group');
        if (!valueGroup) return;

        const displays = {
            power: g.querySelector('.power-display'),
            voltage: g.querySelector('.voltage-display'),
            current: g.querySelector('.current-display')
        };
        const visibleRows = [];
        const visibleDisplays = [];
        for (const row of VALUE_DISPLAY_STACK_ORDER) {
            const display = displays[row];
            if (!display) continue;
            if ((display.textContent || '').trim().length > 0) {
                visibleRows.push(row);
                visibleDisplays.push(display);
            }
        }

        const anchor = resolveValueDisplayAnchor(comp);
        valueGroup.setAttribute('transform', `translate(${anchor.x}, ${anchor.y})`);

        const rowGap = this.resolveValueDisplayRowGap(visibleDisplays);
        const rowOffsets = computeValueDisplayRowOffsets(visibleRows, rowGap);
        for (const row of VALUE_DISPLAY_STACK_ORDER) {
            const display = displays[row];
            if (!display) continue;
            display.setAttribute('y', String(rowOffsets[row] ?? 0));
        }
    },

    /**
     * 更新元器件的数值显示
     */
    updateValueDisplay(g, comp, showCurrent, showVoltage, showPower) {
        const currentDisplay = g.querySelector('.current-display');
        const voltageDisplay = g.querySelector('.voltage-display');
        const powerDisplay = g.querySelector('.power-display');
        
        // 电表显示读数而非 I/U/P 格式
        if (comp.type === 'Ammeter') {
            // 电流表：显示电流读数，更大更醒目
            if (currentDisplay) {
                if (showCurrent) {
                    const reading = Math.abs(comp.currentValue || 0);
                    currentDisplay.textContent = `${reading.toFixed(3)} A`;
                    currentDisplay.setAttribute('font-size', '14');
                    currentDisplay.setAttribute('font-weight', '700');
                } else {
                    currentDisplay.textContent = '';
                    currentDisplay.setAttribute('font-size', '13');
                    currentDisplay.setAttribute('font-weight', '600');
                }
            }
            if (voltageDisplay) voltageDisplay.textContent = '';
            if (powerDisplay) powerDisplay.textContent = '';
            this.layoutValueDisplay(g, comp);
            return;
        }
        
        if (comp.type === 'Voltmeter') {
            // 电压表：显示电压读数，更大更醒目
            if (voltageDisplay) {
                if (showVoltage) {
                    const reading = Math.abs(comp.voltageValue || 0);
                    voltageDisplay.textContent = `${reading.toFixed(3)} V`;
                    voltageDisplay.setAttribute('font-size', '14');
                    voltageDisplay.setAttribute('font-weight', '700');
                } else {
                    voltageDisplay.textContent = '';
                    voltageDisplay.setAttribute('font-size', '13');
                    voltageDisplay.setAttribute('font-weight', '600');
                }
            }
            // 理想电压表不显示电流，强制清空
            if (currentDisplay) {
                currentDisplay.textContent = '';
                currentDisplay.setAttribute('font-size', '13');
                currentDisplay.setAttribute('font-weight', '600');
            }
            if (powerDisplay) powerDisplay.textContent = '';
            this.layoutValueDisplay(g, comp);
            return;
        }
        
        // 开关不需要显示电压电流
        if (comp.type === 'Switch' || comp.type === 'Ground') {
            if (currentDisplay) currentDisplay.textContent = '';
            if (voltageDisplay) voltageDisplay.textContent = '';
            if (powerDisplay) powerDisplay.textContent = '';
            this.layoutValueDisplay(g, comp);
            return;
        }
        
        // 其他元器件正常显示
        if (currentDisplay) {
            currentDisplay.textContent = showCurrent ? 
                `I = ${this.formatValue(comp.currentValue, 'A')}` : '';
        }
        
        if (voltageDisplay) {
            if (comp.type === 'Rheostat' && showVoltage) {
                // 当滑动变阻器两端与滑块同时接入时，显示左右两段电压
                const parts = [];
                if (comp.voltageSegLeft !== undefined && comp.voltageSegLeft !== null) {
                    parts.push(`U₁=${this.formatValue(comp.voltageSegLeft, 'V')}`);
                }
                if (comp.voltageSegRight !== undefined && comp.voltageSegRight !== null) {
                    parts.push(`U₂=${this.formatValue(comp.voltageSegRight, 'V')}`);
                }
                if (parts.length > 0) {
                    voltageDisplay.textContent = parts.join('  ');
                } else {
                    voltageDisplay.textContent = `U = ${this.formatValue(comp.voltageValue, 'V')}`;
                }
            } else {
                voltageDisplay.textContent = showVoltage ? 
                    `U = ${this.formatValue(comp.voltageValue, 'V')}` : '';
            }
        }
        
        if (powerDisplay) {
            powerDisplay.textContent = showPower ? 
                `P = ${this.formatValue(comp.powerValue, 'W')}` : '';
        }
        this.layoutValueDisplay(g, comp);
        
        // 更新灯泡亮度
        if (comp.type === 'Bulb') {
            const glow = g.querySelector('.glow');
            if (glow) {
                const brightness = Math.min(1, comp.powerValue / comp.ratedPower);
                glow.setAttribute('fill', `rgba(255, 235, 59, ${brightness * 0.8})`);
                if (brightness > 0.1) {
                    g.classList.add('on');
                } else {
                    g.classList.remove('on');
                }
            }
        }
        
        // 更新电容器充电状态视觉指示
        if (comp.type === 'Capacitor') {
            const plates = g.querySelectorAll('.capacitor-plate');
            const isCharged = Math.abs(comp.currentValue || 0) < 1e-6; // 电流极小，认为充电完成
            
            plates.forEach(plate => {
                if (isCharged) {
                    plate.classList.add('charged');
                } else {
                    plate.classList.remove('charged');
                }
            });
        }
    },

    /**
     * 更新平行板电容的极板位置与标签（用于拖动探索模式，避免整组重绘导致闪烁）
     */
    updateParallelPlateCapacitorVisual(g, comp) {
        if (!g || !comp) return;

        const plateLengthPx = 24;
        const halfLen = plateLengthPx / 2;
        const plateWidth = 4;
        const pxPerMm = 10;
        const minGapPx = 6;
        const maxGapPx = 30;

        const distanceMm = (comp.plateDistance ?? 0.001) * 1000;
        const gapPx = clamp(distanceMm * pxPerMm, minGapPx, maxGapPx);
        const offsetY = clamp(comp.plateOffsetYPx ?? 0, -plateLengthPx, plateLengthPx);

        const leftX = -gapPx / 2;
        const rightX = gapPx / 2;

        const leftConn = g.querySelector('.ppc-connector-left');
        if (leftConn) {
            leftConn.setAttribute('x2', String(leftX));
        }
        const rightConn = g.querySelector('.ppc-connector-right');
        if (rightConn) {
            rightConn.setAttribute('x1', String(rightX));
        }

        const leftPlate = g.querySelector('.ppc-plate-left');
        if (leftPlate) {
            leftPlate.setAttribute('x', String(leftX - plateWidth / 2));
            leftPlate.setAttribute('y', String(-halfLen));
        }

        const rightPlate = g.querySelector('.ppc-plate-right');
        if (rightPlate) {
            rightPlate.setAttribute('x', String(rightX - plateWidth / 2));
            rightPlate.setAttribute('y', String(-halfLen + offsetY));
            if (comp.explorationMode) {
                rightPlate.style.pointerEvents = 'all';
                rightPlate.style.cursor = 'grab';
            } else {
                rightPlate.style.pointerEvents = 'none';
                rightPlate.style.cursor = '';
            }
        }

        // 标签（无自定义标签时显示电容值）
        const label = g.querySelector('.ppc-label');
        if (label && !comp.label) {
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
            label.textContent = text;
        }
    },

    /**
     * 格式化数值 - 更清晰的显示
     */
    formatValue(value, unit) {
        if (value === undefined || value === null || isNaN(value)) return '0 ' + unit;
        
        const absValue = Math.abs(value);
        if (absValue >= 1000) {
            return (value / 1000).toFixed(2) + ' k' + unit;
        } else if (absValue >= 1) {
            return value.toFixed(3) + ' ' + unit;
        } else if (absValue >= 0.001) {
            return (value * 1000).toFixed(2) + ' m' + unit;
        } else if (absValue >= 0.000001) {
            return (value * 1000000).toFixed(2) + ' μ' + unit;
        } else {
            return '0 ' + unit;
        }
    },

    /**
     * 创建导线SVG
     */
    createWire(wire, getWireEndpointPosition = null) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'wire-group');
        g.setAttribute('data-id', wire.id);
        
        // 不可见的点击区域（更粗，便于点击）
        const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        hitArea.setAttribute('class', 'wire-hit-area');
        hitArea.setAttribute('data-id', wire.id);
        g.appendChild(hitArea);
        
        // 主导线路径
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'wire');
        path.setAttribute('data-id', wire.id);
        g.appendChild(path);
        
        this.updateWirePathWithGroup(g, wire, getWireEndpointPosition);
        
        return g;
    },

    /**
     * 更新导线路径
     */
    updateWirePath(pathOrGroup, wire, getWireEndpointPosition = null) {
        this.updateWirePathWithGroup(pathOrGroup, wire, getWireEndpointPosition);
    },

    /**
     * 更新导线组（路径+端点）
     */
    updateWirePathWithGroup(g, wire, getWireEndpointPosition = null) {
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
        
        // 更新点击区域
        if (hitArea) {
            hitArea.setAttribute('d', d);
        }
        
        // 移除旧的端点与命中圈，避免重绘叠加导致残留交互层。
        g.querySelectorAll('.wire-endpoint, .wire-endpoint-hit').forEach(el => el.remove());
        
        // 如果导线被选中，显示端点（可拖动）
        if (g.classList.contains('selected')) {
            const makeEndpoint = (pt, which) => {
                const hitCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                hitCircle.setAttribute('cx', pt.x);
                hitCircle.setAttribute('cy', pt.y);
                hitCircle.setAttribute('r', 15);
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
        }
    }
};
