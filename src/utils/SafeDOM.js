/**
 * SafeDOM.js - 安全的 DOM 操作工具
 * 防止 XSS 攻击，提供安全的元素创建方法
 */

/**
 * HTML 转义特殊字符
 * @param {string} str - 需要转义的字符串
 * @returns {string} 转义后的字符串
 */
export function escapeHtml(str) {
    if (typeof str !== 'string') {
        str = String(str);
    }
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * 创建元素并设置属性和文本内容
 * @param {string} tag - 标签名
 * @param {Object} options - 选项
 * @param {string} [options.className] - CSS 类名
 * @param {string} [options.textContent] - 文本内容
 * @param {string} [options.id] - 元素 ID
 * @param {Object} [options.attrs] - 其他属性
 * @param {Object} [options.style] - 样式
 * @param {Array} [options.children] - 子元素数组
 * @returns {HTMLElement}
 */
export function createElement(tag, options = {}) {
    const el = document.createElement(tag);
    
    if (options.className) {
        el.className = options.className;
    }
    
    if (options.id) {
        el.id = options.id;
    }
    
    if (options.textContent !== undefined) {
        el.textContent = options.textContent;
    }
    
    if (options.attrs) {
        for (const [key, value] of Object.entries(options.attrs)) {
            el.setAttribute(key, value);
        }
    }
    
    if (options.style) {
        for (const [key, value] of Object.entries(options.style)) {
            el.style[key] = value;
        }
    }
    
    if (options.children) {
        for (const child of options.children) {
            if (child instanceof Node) {
                el.appendChild(child);
            } else if (typeof child === 'string') {
                el.appendChild(document.createTextNode(child));
            }
        }
    }
    
    return el;
}

/**
 * 创建属性行（用于属性面板）
 * @param {string} label - 标签文本
 * @param {string|number} value - 值
 * @param {Object} options - 选项
 * @param {string} [options.valueId] - 值元素的 ID
 * @param {string} [options.valueClass] - 值元素的额外类名
 * @param {string} [options.small] - 小字附加文本
 * @returns {HTMLElement}
 */
export function createPropertyRow(label, value, options = {}) {
    const row = createElement('div', { className: 'prop-row' + (options.rowClass ? ' ' + options.rowClass : '') });
    
    const labelEl = createElement('span', { className: 'label', textContent: label });
    row.appendChild(labelEl);
    
    const valueEl = createElement('span', { 
        className: 'value' + (options.valueClass ? ' ' + options.valueClass : ''),
        id: options.valueId
    });
    
    valueEl.textContent = String(value);
    
    if (options.small) {
        const smallEl = createElement('small', { textContent: ' ' + options.small });
        valueEl.appendChild(smallEl);
    }
    
    row.appendChild(valueEl);
    
    return row;
}

/**
 * 创建测量值组
 * @param {Object} values - 测量值对象
 * @param {number} values.current - 电流值
 * @param {number} values.voltage - 电压值
 * @param {number} values.power - 功率值
 * @returns {DocumentFragment}
 */
export function createMeasurementRows(values) {
    const fragment = document.createDocumentFragment();
    
    const header = createElement('h3', { 
        textContent: '测量值',
        style: { marginTop: '15px' }
    });
    fragment.appendChild(header);
    
    fragment.appendChild(createPropertyRow('电流', `${(values.current || 0).toFixed(4)} A`));
    fragment.appendChild(createPropertyRow('电压', `${(values.voltage || 0).toFixed(4)} V`));
    fragment.appendChild(createPropertyRow('功率', `${(values.power || 0).toFixed(4)} W`));
    
    return fragment;
}

/**
 * 创建提示文本段落
 * @param {Array<string>} lines - 多行文本
 * @returns {HTMLElement}
 */
export function createHintParagraph(lines) {
    const p = createElement('p', {
        style: { marginTop: '15px', fontSize: '12px', color: '#666' }
    });
    
    lines.forEach((line, index) => {
        if (index > 0) {
            p.appendChild(document.createElement('br'));
        }
        // 检查是否需要加粗
        if (line.startsWith('<b>') && line.endsWith('</b>')) {
            const b = createElement('b', { textContent: line.slice(3, -4) });
            p.appendChild(b);
        } else {
            p.appendChild(document.createTextNode(line));
        }
    });
    
    return p;
}

/**
 * 创建表单组（用于对话框）
 * @param {string} labelText - 标签文本
 * @param {Object} inputOptions - 输入框选项
 * @param {string} [hint] - 提示文本
 * @returns {HTMLElement}
 */
export function createFormGroup(labelText, inputOptions = {}, hint = null) {
    const group = createElement('div', { className: 'form-group' });
    
    // 标签
    const label = createElement('label', { textContent: labelText });
    group.appendChild(label);
    
    // 输入框包装
    const inputWrapper = createElement('div', { className: 'input-with-unit' });
    
    // 输入框
    const input = createElement('input', {
        id: inputOptions.id,
        attrs: {
            type: inputOptions.type || 'number',
            value: inputOptions.value !== undefined ? inputOptions.value : '',
            min: inputOptions.min !== undefined ? inputOptions.min : undefined,
            max: inputOptions.max !== undefined ? inputOptions.max : undefined,
            step: inputOptions.step !== undefined ? inputOptions.step : undefined,
            placeholder: inputOptions.placeholder || ''
        }
    });
    inputWrapper.appendChild(input);
    
    // 单位
    if (inputOptions.unit) {
        const unit = createElement('span', { className: 'unit', textContent: inputOptions.unit });
        inputWrapper.appendChild(unit);
    }
    
    group.appendChild(inputWrapper);
    
    // 提示
    if (hint) {
        const hintEl = createElement('p', { className: 'hint', textContent: hint });
        group.appendChild(hintEl);
    }
    
    return group;
}

/**
 * 创建滑块表单组
 * @param {string} labelText - 标签文本
 * @param {Object} options - 选项
 * @returns {HTMLElement}
 */
export function createSliderFormGroup(labelText, options = {}) {
    const group = createElement('div', { className: 'form-group slider-group' });
    
    // 标签带值显示
    const label = document.createElement('label');
    label.appendChild(document.createTextNode(labelText + ': '));
    const valueSpan = createElement('span', {
        id: options.valueId,
        textContent: options.displayValue || options.value + '%'
    });
    label.appendChild(valueSpan);
    group.appendChild(label);
    
    // 滑块
    const slider = createElement('input', {
        id: options.id,
        attrs: {
            type: 'range',
            value: options.value,
            min: options.min || 0,
            max: options.max || 100,
            step: options.step || 1
        }
    });
    group.appendChild(slider);
    
    return group;
}

/**
 * 创建开关切换按钮组
 * @param {boolean} isClosed - 当前是否闭合
 * @returns {HTMLElement}
 */
export function createSwitchToggleGroup(isClosed) {
    const group = createElement('div', { className: 'form-group' });
    
    const label = createElement('label', { textContent: '开关状态' });
    group.appendChild(label);
    
    const toggleDiv = createElement('div', { className: 'switch-toggle' });
    
    const openBtn = createElement('button', {
        id: 'switch-open',
        className: !isClosed ? 'active' : '',
        textContent: '断开',
        attrs: { type: 'button' }
    });
    toggleDiv.appendChild(openBtn);
    
    const closeBtn = createElement('button', {
        id: 'switch-close',
        className: isClosed ? 'active' : '',
        textContent: '闭合',
        attrs: { type: 'button' }
    });
    toggleDiv.appendChild(closeBtn);
    
    group.appendChild(toggleDiv);
    
    const hint = createElement('p', { className: 'hint', textContent: '点击开关元件可直接切换状态' });
    group.appendChild(hint);
    
    return group;
}

/**
 * 清空元素内容（安全方式）
 * @param {HTMLElement} element - 要清空的元素
 */
export function clearElement(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}
