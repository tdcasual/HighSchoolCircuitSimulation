/**
 * Component.js - 元器件基类和工厂
 * 定义各种电路元器件的属性和SVG渲染
 */

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
    PowerSource: {
        voltage: 12,           // 电动势 (V)
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
        capacitance: 0.001     // 电容值 (F) = 1000μF
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
        range: 3               // 量程 (A)
    },
    Voltmeter: {
        resistance: Infinity,  // 内阻 (Ω)，Infinity表示理想电压表
        range: 15              // 量程 (V)
    }
};

/**
 * 元器件显示名称
 */
export const ComponentNames = {
    PowerSource: '电源',
    Resistor: '定值电阻',
    Rheostat: '滑动变阻器',
    Bulb: '灯泡',
    Capacitor: '电容',
    Motor: '电动机',
    Switch: '开关',
    Ammeter: '电流表',
    Voltmeter: '电压表'
};

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
    const terminalCount = type === 'Rheostat' ? 3 : 2;
    
    // 初始化端子延长数据
    const terminalExtensions = {};
    for (let i = 0; i < terminalCount; i++) {
        terminalExtensions[i] = { x: 0, y: 0 }; // 相对于默认位置的偏移
    }
    
    const id = existingId || generateId(type);
    
    return {
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
        terminalExtensions: terminalExtensions, // 端子延长偏移
        ...defaults
    };
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
            case 'PowerSource':
                this.renderPowerSource(g, comp);
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
        }
        
        // 添加数值显示
        this.addValueDisplay(g, comp);
        
        return g;
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
        const sliderX = -20 + 40 * comp.position; // 从 -20 到 +20，留出边距
        
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
                (comp.minResistance + (comp.maxResistance - comp.minResistance) * comp.position);
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
        this.addLine(g, -5, -12, -5, 12, 2);
        this.addLine(g, 5, -12, 5, 12, 2);
        
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
     * 辅助方法：添加端子（支持延长）
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
        
        // 端子圆圈放在延长后的位置
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', x + extX);
        circle.setAttribute('cy', y + extY);
        circle.setAttribute('r', 5);
        circle.setAttribute('class', 'terminal');
        circle.setAttribute('data-terminal', index);
        circle.setAttribute('data-base-x', x); // 保存原始位置
        circle.setAttribute('data-base-y', y);
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
        valueGroup.setAttribute('transform', 'translate(0, -30)');
        
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
        voltageText.setAttribute('y', -16);
        voltageText.setAttribute('text-anchor', 'middle');
        voltageText.setAttribute('font-size', '13');
        voltageText.setAttribute('font-weight', '600');
        voltageText.textContent = '';
        valueGroup.appendChild(voltageText);
        
        // 功率显示（最上方）
        const powerText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        powerText.setAttribute('class', 'value-display power-display');
        powerText.setAttribute('x', 0);
        powerText.setAttribute('y', -32);
        powerText.setAttribute('text-anchor', 'middle');
        powerText.setAttribute('font-size', '13');
        powerText.setAttribute('font-weight', '600');
        powerText.textContent = '';
        valueGroup.appendChild(powerText);
        
        g.appendChild(valueGroup);
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
                const reading = Math.abs(comp.currentValue || 0);
                currentDisplay.textContent = `${reading.toFixed(3)} A`;
                currentDisplay.setAttribute('font-size', '14');
                currentDisplay.setAttribute('font-weight', '700');
            }
            if (voltageDisplay) voltageDisplay.textContent = '';
            if (powerDisplay) powerDisplay.textContent = '';
            return;
        }
        
        if (comp.type === 'Voltmeter') {
            // 电压表：显示电压读数，更大更醒目
            if (voltageDisplay) {
                const reading = Math.abs(comp.voltageValue || 0);
                voltageDisplay.textContent = `${reading.toFixed(3)} V`;
                voltageDisplay.setAttribute('font-size', '14');
                voltageDisplay.setAttribute('font-weight', '700');
            }
            // 理想电压表不显示电流，强制清空
            if (currentDisplay) {
                currentDisplay.textContent = '';
                currentDisplay.setAttribute('font-size', '13');
                currentDisplay.setAttribute('font-weight', '600');
            }
            if (powerDisplay) powerDisplay.textContent = '';
            return;
        }
        
        // 开关不需要显示电压电流
        if (comp.type === 'Switch') {
            if (currentDisplay) currentDisplay.textContent = '';
            if (voltageDisplay) voltageDisplay.textContent = '';
            if (powerDisplay) powerDisplay.textContent = '';
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
    createWire(wire, getTerminalPosition) {
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
        
        // 初始化控制点数组（如果没有）
        if (!wire.controlPoints) {
            wire.controlPoints = [];
        }
        
        this.updateWirePathWithGroup(g, wire, getTerminalPosition);
        
        return g;
    },

    /**
     * 更新导线路径（包含控制点）
     */
    updateWirePath(pathOrGroup, wire, getTerminalPosition) {
        // 兼容旧代码：如果传入的是path元素
        if (pathOrGroup.tagName === 'path') {
            const start = getTerminalPosition(wire.startComponentId, wire.startTerminalIndex);
            const end = getTerminalPosition(wire.endComponentId, wire.endTerminalIndex);
            if (start && end) {
                const points = [start, ...(wire.controlPoints || []), end];
                const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                pathOrGroup.setAttribute('d', d);
            }
        } else {
            this.updateWirePathWithGroup(pathOrGroup, wire, getTerminalPosition);
        }
    },

    /**
     * 更新导线组（路径+控制点）
     */
    updateWirePathWithGroup(g, wire, getTerminalPosition) {
        const path = g.querySelector('path.wire');
        const hitArea = g.querySelector('path.wire-hit-area');
        if (!path) return;
        
        const start = getTerminalPosition(wire.startComponentId, wire.startTerminalIndex);
        const end = getTerminalPosition(wire.endComponentId, wire.endTerminalIndex);
        
        if (!start || !end) return;
        
        // 构建路径点
        const controlPoints = wire.controlPoints || [];
        const points = [start, ...controlPoints, end];
        const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        path.setAttribute('d', d);
        
        // 更新点击区域
        if (hitArea) {
            hitArea.setAttribute('d', d);
        }
        
        // 移除旧的控制点圆圈
        g.querySelectorAll('.wire-control-point, .wire-add-point, .wire-node-point').forEach(el => el.remove());
        
        // 如果导线被选中，显示控制点
        if (g.classList.contains('selected')) {
            // 显示现有控制点（蓝色大圆，可拖动和连接）
            controlPoints.forEach((cp, i) => {
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', cp.x);
                circle.setAttribute('cy', cp.y);
                circle.setAttribute('r', 7);
                circle.setAttribute('class', 'wire-node-point');
                circle.setAttribute('data-index', i);
                circle.style.cursor = 'move';
                g.appendChild(circle);
            });
        }
    }
};
