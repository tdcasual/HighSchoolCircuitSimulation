import { ComponentNames } from '../../components/Component.js';
import {
    createElement,
    createPropertyRow,
    createHintParagraph,
    createFormGroup,
    clearElement
} from '../../utils/SafeDOM.js';

function resolveIntegrationMethodLabel(method) {
    const normalized = typeof method === 'string' ? method.toLowerCase() : 'auto';
    if (normalized === 'trapezoidal') return '梯形法';
    if (normalized === 'backward-euler') return '后向欧拉';
    return '自动';
}

/**
 * 更新属性面板（使用安全的 DOM 操作防止 XSS）
 */
export function updatePropertyPanel(comp) {
    const content = document.getElementById('property-content');
    clearElement(content);

    // 基础属性
    content.appendChild(createPropertyRow('类型', ComponentNames[comp.type]));
    content.appendChild(createPropertyRow('ID', comp.id));

    // 添加自定义标签编辑
    const labelGroup = createFormGroup('标签 (例如 V1, R1)', {
        id: 'comp-label',
        type: 'text',
        value: comp.label || '',
        placeholder: '输入标签名称'
    }, '自定义标签将显示在元器件上');
    const labelInput = labelGroup.querySelector('#comp-label');
    labelInput.addEventListener('change', () => {
        const newLabel = labelInput.value.trim();
        comp.label = newLabel || null;
        this.renderer.render();
        this.app.observationPanel?.refreshComponentOptions();
        this.app.observationPanel?.refreshDialGauges();
        this.app.updateStatus(`已更新标签: ${newLabel || '（空）'}`);
    });
    content.appendChild(labelGroup);

    // 数值显示（每个元器件单独配置）
    const displayKeys = (() => {
        switch (comp.type) {
            case 'Switch':
            case 'SPDTSwitch':
            case 'BlackBox':
            case 'Ground':
                return [];
            case 'Ammeter':
                return ['current'];
            case 'Voltmeter':
                return ['voltage'];
            default:
                return ['current', 'voltage', 'power'];
        }
    })();

    if (displayKeys.length > 0) {
        const displayHeader = createElement('h3', { textContent: '数值显示' });
        content.appendChild(displayHeader);

        const chipRow = createElement('div', { className: 'display-chip-row' });
        const chipLabels = {
            current: 'I 电流',
            voltage: 'U 电压',
            power: 'P 功率'
        };

        // 确保 display 结构存在
        if (!comp.display || typeof comp.display !== 'object') {
            comp.display = { current: true, voltage: false, power: false };
        }

        displayKeys.forEach((key) => {
            const isOn = !!comp.display[key];
            const btn = createElement('button', {
                className: 'display-chip' + (isOn ? ' active' : ''),
                textContent: chipLabels[key] || key,
                attrs: {
                    type: 'button',
                    'data-key': key,
                    'aria-pressed': isOn ? 'true' : 'false'
                }
            });

            btn.addEventListener('click', () => {
                const next = !comp.display[key];
                comp.display[key] = next;
                btn.classList.toggle('active', next);
                btn.setAttribute('aria-pressed', next ? 'true' : 'false');
                this.renderer.updateValues();
            });

            chipRow.appendChild(btn);
        });

        content.appendChild(chipRow);
    }

    // 根据类型显示不同的属性
    switch (comp.type) {
        case 'Ground':
            content.appendChild(createPropertyRow('类型说明', '参考地（0V基准）'));
            break;

        case 'PowerSource':
            content.appendChild(createPropertyRow('电动势', `${comp.voltage} V`));
            content.appendChild(createPropertyRow('内阻', `${comp.internalResistance} Ω`));
            break;

        case 'ACVoltageSource':
            content.appendChild(createPropertyRow('有效值', `${comp.rmsVoltage} V`));
            content.appendChild(createPropertyRow('频率', `${comp.frequency} Hz`));
            content.appendChild(createPropertyRow('相位', `${comp.phase} °`));
            content.appendChild(createPropertyRow('偏置', `${comp.offset} V`));
            content.appendChild(createPropertyRow('内阻', `${comp.internalResistance} Ω`));
            break;

        case 'Resistor':
            content.appendChild(createPropertyRow('电阻值', `${comp.resistance} Ω`));
            break;

        case 'Rheostat': {
            const connectionModeText = {
                'left-slider': '左端-滑块',
                'right-slider': '右端-滑块',
                'left-right': '左端-右端（全阻）',
                all: '并联（三端）',
                'slider-only': '未接通',
                none: '未接通'
            };
            const directionText = {
                'slider-right-increase': '→增大',
                'slider-right-decrease': '→减小',
                fixed: '固定',
                parallel: '并联',
                disconnected: '-'
            };
            content.appendChild(createPropertyRow('阻值范围', `${comp.minResistance} ~ ${comp.maxResistance} Ω`));
            content.appendChild(createPropertyRow('接入方式', connectionModeText[comp.connectionMode] || '未接通', { valueId: 'rheostat-mode' }));
            content.appendChild(createPropertyRow('接入电阻', `${(comp.activeResistance || 0).toFixed(1)} Ω`, {
                valueId: 'rheostat-current-r',
                small: directionText[comp.resistanceDirection] || ''
            }));
            content.appendChild(createPropertyRow('滑块位置', `${(comp.position * 100).toFixed(0)}%`, { valueId: 'rheostat-position' }));
            break;
        }

        case 'Bulb':
            content.appendChild(createPropertyRow('灯丝电阻', `${comp.resistance} Ω`));
            content.appendChild(createPropertyRow('额定功率', `${comp.ratedPower} W`));
            break;

        case 'Capacitor':
            content.appendChild(createPropertyRow('电容值', `${(comp.capacitance * 1000000).toFixed(0)} μF`));
            content.appendChild(createPropertyRow('积分方法', resolveIntegrationMethodLabel(comp.integrationMethod)));
            break;

        case 'Inductor':
            content.appendChild(createPropertyRow('电感值', `${comp.inductance} H`));
            content.appendChild(createPropertyRow('初始电流', `${(comp.initialCurrent || 0).toFixed(3)} A`));
            content.appendChild(createPropertyRow('积分方法', resolveIntegrationMethodLabel(comp.integrationMethod)));
            break;

        case 'ParallelPlateCapacitor': {
            // 先用当前物理参数同步一次电容值（不改变已存电荷）
            this.recomputeParallelPlateCapacitance(comp, { updateVisual: false, updatePanel: false });

            content.appendChild(createElement('h3', { textContent: '探索模式' }));

            const exploreGroup = createElement('div', { className: 'form-group' });
            exploreGroup.appendChild(createElement('label', { textContent: '开启探索（拖动右侧极板）' }));
            const exploreToggle = createElement('input', {
                id: 'ppc-toggle-explore',
                attrs: { type: 'checkbox' }
            });
            exploreToggle.checked = !!comp.explorationMode;
            exploreToggle.addEventListener('change', () => {
                comp.explorationMode = !!exploreToggle.checked;
                this.recomputeParallelPlateCapacitance(comp, { updateVisual: true, updatePanel: true });
            });
            exploreGroup.appendChild(exploreToggle);
            exploreGroup.appendChild(createElement('p', { className: 'hint', textContent: '左右拖动改变 d，上下拖动改变重叠面积' }));
            content.appendChild(exploreGroup);

            const distanceGroup = createFormGroup('极板间距 d', {
                id: 'ppc-input-distance',
                value: ((comp.plateDistance || 0) * 1000).toFixed(3),
                min: 0.001,
                step: 0.1,
                unit: 'mm'
            });
            const areaGroup = createFormGroup('极板面积 A', {
                id: 'ppc-input-area',
                value: ((comp.plateArea || 0) * 10000).toFixed(2),
                min: 0.01,
                step: 1,
                unit: 'cm²'
            });
            const erGroup = createFormGroup('介电常数 εr', {
                id: 'ppc-input-er',
                value: comp.dielectricConstant ?? 1,
                min: 1,
                step: 0.1,
                unit: ''
            });

            content.appendChild(distanceGroup);
            content.appendChild(areaGroup);
            content.appendChild(erGroup);

            const distanceInput = distanceGroup.querySelector('#ppc-input-distance');
            if (distanceInput) {
                distanceInput.addEventListener('change', () => {
                    const distanceMm = this.safeParseFloat(distanceInput.value, (comp.plateDistance || 0.001) * 1000, 0.001, 1e9);
                    comp.plateDistance = distanceMm / 1000;
                    this.recomputeParallelPlateCapacitance(comp, { updateVisual: true, updatePanel: true });
                });
            }

            const areaInput = areaGroup.querySelector('#ppc-input-area');
            if (areaInput) {
                areaInput.addEventListener('change', () => {
                    const areaCm2 = this.safeParseFloat(areaInput.value, (comp.plateArea || 0.01) * 10000, 0.01, 1e12);
                    comp.plateArea = areaCm2 / 10000;
                    this.recomputeParallelPlateCapacitance(comp, { updateVisual: true, updatePanel: true });
                });
            }

            const erInput = erGroup.querySelector('#ppc-input-er');
            if (erInput) {
                erInput.addEventListener('change', () => {
                    comp.dielectricConstant = this.safeParseFloat(erInput.value, comp.dielectricConstant ?? 1, 1, 1e9);
                    this.recomputeParallelPlateCapacitance(comp, { updateVisual: true, updatePanel: true });
                });
            }

            content.appendChild(createElement('h3', { textContent: '演示量' }));
            content.appendChild(createPropertyRow('电容 C', '—', { valueId: 'ppc-readout-capacitance' }));
            content.appendChild(createPropertyRow('板间距 d', '—', { valueId: 'ppc-readout-distance' }));
            content.appendChild(createPropertyRow('重叠比例', '—', { valueId: 'ppc-readout-overlap' }));
            content.appendChild(createPropertyRow('有效面积 A_eff', '—', { valueId: 'ppc-readout-area' }));
            content.appendChild(createPropertyRow('电场强度 E', '—', { valueId: 'ppc-readout-field' }));
            content.appendChild(createPropertyRow('电荷 |Q|', '—', { valueId: 'ppc-readout-charge' }));

            // 初始化一次读数
            this.updateParallelPlateCapacitorPanelValues(comp);
            break;
        }

        case 'Motor':
            content.appendChild(createPropertyRow('电枢电阻', `${comp.resistance} Ω`));
            content.appendChild(createPropertyRow('转速', `${((comp.speed || 0) * 60 / (2 * Math.PI)).toFixed(0)} rpm`));
            break;

        case 'Switch':
            content.appendChild(createPropertyRow('状态', comp.closed ? '闭合' : '断开'));
            break;

        case 'SPDTSwitch':
            content.appendChild(createPropertyRow('拨杆位置', comp.position === 'b' ? '下掷 (B)' : '上掷 (A)'));
            content.appendChild(createPropertyRow('导通电阻', `${Number.isFinite(comp.onResistance) ? comp.onResistance : 1e-9} Ω`));
            content.appendChild(createPropertyRow('断开支路电阻', `${Number.isFinite(comp.offResistance) ? comp.offResistance : 1e12} Ω`));
            break;

        case 'Fuse':
            content.appendChild(createPropertyRow('状态', comp.blown ? '已熔断' : '正常'));
            content.appendChild(createPropertyRow('额定电流', `${Number.isFinite(comp.ratedCurrent) ? comp.ratedCurrent : 3} A`));
            content.appendChild(createPropertyRow('I²t 阈值', `${Number.isFinite(comp.i2tThreshold) ? comp.i2tThreshold : 1} A²·s`));
            content.appendChild(createPropertyRow('I²t 累计', `${Number.isFinite(comp.i2tAccum) ? comp.i2tAccum.toFixed(3) : '0.000'} A²·s`));
            content.appendChild(createPropertyRow('正常电阻', `${Number.isFinite(comp.coldResistance) ? comp.coldResistance : 0.05} Ω`));
            content.appendChild(createPropertyRow('熔断电阻', `${Number.isFinite(comp.blownResistance) ? comp.blownResistance : 1e12} Ω`));
            break;

        case 'Ammeter':
            content.appendChild(createPropertyRow('内阻', comp.resistance > 0 ? `${comp.resistance} Ω` : '理想（0Ω）'));
            content.appendChild(createPropertyRow('量程', `${comp.range} A`));
            content.appendChild(this.createMeterSelfReadingControl(comp));
            content.appendChild(createPropertyRow('读数', `${(Math.abs(comp.currentValue) || 0).toFixed(3)} A`, {
                rowClass: 'reading',
                valueClass: 'ammeter-reading'
            }));
            break;

        case 'Voltmeter':
            content.appendChild(createPropertyRow('内阻', comp.resistance === Infinity ? '理想（∞）' : `${comp.resistance} Ω`));
            content.appendChild(createPropertyRow('量程', `${comp.range} V`));
            content.appendChild(this.createMeterSelfReadingControl(comp));
            content.appendChild(createPropertyRow('读数', `${(Math.abs(comp.voltageValue) || 0).toFixed(3)} V`, {
                rowClass: 'reading',
                valueClass: 'voltmeter-reading'
            }));
            break;

        case 'BlackBox': {
            const w = Math.max(80, comp.boxWidth || 180);
            const h = Math.max(60, comp.boxHeight || 110);
            const modeLabel = comp.viewMode === 'opaque' ? '隐藏（黑箱）' : '透明（可观察）';

            // 自动统计当前“盒内”组件数量（不含自身）
            const contained = this.getBlackBoxContainedComponentIds(comp, { includeBoxes: true });

            content.appendChild(createPropertyRow('大小', `${w.toFixed(0)} × ${h.toFixed(0)} px`));
            content.appendChild(createPropertyRow('显示模式', modeLabel));
            content.appendChild(createPropertyRow('内部元件数', `${contained.length} 个`));

            content.appendChild(createElement('h3', { textContent: '黑箱设置' }));

            const modeGroup = createElement('div', { className: 'form-group' });
            modeGroup.appendChild(createElement('label', { textContent: '内部可见性' }));
            const modeSelect = createElement('select', { id: 'blackbox-viewmode' });
            modeSelect.appendChild(createElement('option', { textContent: '透明（观察内部）', attrs: { value: 'transparent' } }));
            modeSelect.appendChild(createElement('option', { textContent: '隐藏（黑箱）', attrs: { value: 'opaque' } }));
            modeSelect.value = comp.viewMode === 'opaque' ? 'opaque' : 'transparent';
            modeSelect.addEventListener('change', () => {
                comp.viewMode = modeSelect.value === 'opaque' ? 'opaque' : 'transparent';
                this.renderer.render();
                this.selectComponent(comp.id);
            });
            modeGroup.appendChild(modeSelect);
            modeGroup.appendChild(createElement('p', { className: 'hint', textContent: '隐藏模式下，盒内元件与导线会被遮挡/隐藏，电路计算不受影响。' }));
            content.appendChild(modeGroup);

            const widthGroup = createFormGroup('宽度', {
                id: 'blackbox-width',
                value: w.toFixed(0),
                min: 80,
                step: 10,
                unit: 'px'
            });
            const heightGroup = createFormGroup('高度', {
                id: 'blackbox-height',
                value: h.toFixed(0),
                min: 60,
                step: 10,
                unit: 'px'
            });
            const widthInput = widthGroup.querySelector('#blackbox-width');
            const heightInput = heightGroup.querySelector('#blackbox-height');
            if (widthInput) {
                widthInput.addEventListener('change', () => {
                    comp.boxWidth = Math.round(this.safeParseFloat(widthInput.value, w, 80, 5000));
                    this.renderer.render();
                    this.selectComponent(comp.id);
                });
            }
            if (heightInput) {
                heightInput.addEventListener('change', () => {
                    comp.boxHeight = Math.round(this.safeParseFloat(heightInput.value, h, 60, 5000));
                    this.renderer.render();
                    this.selectComponent(comp.id);
                });
            }
            content.appendChild(widthGroup);
            content.appendChild(heightGroup);
            break;
        }
        default:
            break;
    }

    // 实时测量（不再每帧重建面板，改为更新这些读数节点）
    content.appendChild(createElement('h3', { textContent: '实时测量' }));
    content.appendChild(createPropertyRow('电流', `${(comp.currentValue || 0).toFixed(4)} A`, { valueId: 'measure-current' }));
    content.appendChild(createPropertyRow('电压', `${(comp.voltageValue || 0).toFixed(4)} V`, { valueId: 'measure-voltage' }));
    content.appendChild(createPropertyRow('功率', `${(comp.powerValue || 0).toFixed(4)} W`, { valueId: 'measure-power' }));

    content.appendChild(createHintParagraph([
        '双击或右键编辑属性',
        '按 R 旋转，按 Delete 删除',
        'Shift + 点击空白处开始画导线',
        '拖动端子可伸长/缩短元器件引脚'
    ]));
}
