import { ComponentNames } from '../../components/Component.js';
import {
    createElement,
    createFormGroup,
    createSelectFormGroup,
    createSliderFormGroup,
    createSwitchToggleGroup,
    clearElement
} from '../../utils/SafeDOM.js';

const INTEGRATION_METHOD_OPTIONS = Object.freeze([
    { value: 'auto', label: '自动（默认梯形法）' },
    { value: 'trapezoidal', label: '梯形法' },
    { value: 'backward-euler', label: '后向欧拉' }
]);

export function showPropertyDialog(id) {
    const comp = this.circuit.getComponent(id);
    if (!comp) return;
    
    this.editingComponent = comp;
    
    const dialog = document.getElementById('dialog-overlay');
    const title = document.getElementById('dialog-title');
    const content = document.getElementById('dialog-content');
    
    title.textContent = `编辑 ${ComponentNames[comp.type]}`;
    
    // 使用安全的 DOM 操作构建对话框内容
    clearElement(content);
    
    switch (comp.type) {
        case 'Ground':
            content.appendChild(createElement('p', { className: 'hint', textContent: '接地元件用于指定 0V 参考节点。' }));
            break;

        case 'PowerSource':
            content.appendChild(createFormGroup('电动势 (V)', {
                id: 'edit-voltage',
                value: comp.voltage,
                min: 0,
                step: 0.1,
                unit: 'V'
            }));
            content.appendChild(createFormGroup('内阻 (Ω)', {
                id: 'edit-internal-resistance',
                value: comp.internalResistance,
                min: 0,
                step: 0.1,
                unit: 'Ω'
            }));
            break;

        case 'ACVoltageSource':
            content.appendChild(createFormGroup('有效值 (V)', {
                id: 'edit-rms-voltage',
                value: comp.rmsVoltage,
                min: 0,
                step: 0.1,
                unit: 'V'
            }));
            content.appendChild(createFormGroup('频率 (Hz)', {
                id: 'edit-frequency',
                value: comp.frequency,
                min: 0,
                step: 0.1,
                unit: 'Hz'
            }));
            content.appendChild(createFormGroup('相位 (°)', {
                id: 'edit-phase',
                value: comp.phase,
                step: 1,
                unit: '°'
            }));
            content.appendChild(createFormGroup('偏置 (V)', {
                id: 'edit-offset',
                value: comp.offset,
                step: 0.1,
                unit: 'V'
            }));
            content.appendChild(createFormGroup('内阻 (Ω)', {
                id: 'edit-internal-resistance',
                value: comp.internalResistance,
                min: 0,
                step: 0.1,
                unit: 'Ω'
            }));
            break;
            
        case 'Resistor':
            content.appendChild(createFormGroup('电阻值 (Ω)', {
                id: 'edit-resistance',
                value: comp.resistance,
                min: 0.001,
                step: 1,
                unit: 'Ω'
            }));
            break;

        case 'Diode':
            content.appendChild(createFormGroup('导通压降 Vf (V)', {
                id: 'edit-forward-voltage',
                value: Number.isFinite(comp.forwardVoltage) ? comp.forwardVoltage : 0.7,
                min: 0,
                step: 0.01,
                unit: 'V'
            }));
            content.appendChild(createFormGroup('导通电阻 Ron (Ω)', {
                id: 'edit-on-resistance',
                value: Number.isFinite(comp.onResistance) ? comp.onResistance : 1,
                min: 1e-9,
                step: 0.01,
                unit: 'Ω'
            }));
            content.appendChild(createFormGroup('截止电阻 Roff (Ω)', {
                id: 'edit-off-resistance',
                value: Number.isFinite(comp.offResistance) ? comp.offResistance : 1e9,
                min: 1,
                step: 1000,
                unit: 'Ω'
            }));
            break;

        case 'LED':
            content.appendChild(createFormGroup('导通压降 Vf (V)', {
                id: 'edit-forward-voltage',
                value: Number.isFinite(comp.forwardVoltage) ? comp.forwardVoltage : 2.0,
                min: 0,
                step: 0.01,
                unit: 'V'
            }));
            content.appendChild(createFormGroup('导通电阻 Ron (Ω)', {
                id: 'edit-on-resistance',
                value: Number.isFinite(comp.onResistance) ? comp.onResistance : 2,
                min: 1e-9,
                step: 0.01,
                unit: 'Ω'
            }));
            content.appendChild(createFormGroup('截止电阻 Roff (Ω)', {
                id: 'edit-off-resistance',
                value: Number.isFinite(comp.offResistance) ? comp.offResistance : 1e9,
                min: 1,
                step: 1000,
                unit: 'Ω'
            }));
            content.appendChild(createFormGroup('额定电流 If (mA)', {
                id: 'edit-rated-current',
                value: (Number.isFinite(comp.ratedCurrent) ? comp.ratedCurrent : 0.02) * 1000,
                min: 0.1,
                step: 0.1,
                unit: 'mA'
            }));
            break;

        case 'Thermistor':
            content.appendChild(createFormGroup('R25 (Ω)', {
                id: 'edit-r25',
                value: Number.isFinite(comp.resistanceAt25) ? comp.resistanceAt25 : 1000,
                min: 0.001,
                step: 1,
                unit: 'Ω'
            }));
            content.appendChild(createFormGroup('Beta 常数 (K)', {
                id: 'edit-beta',
                value: Number.isFinite(comp.beta) ? comp.beta : 3950,
                min: 1,
                step: 10,
                unit: 'K'
            }));
            content.appendChild(createFormGroup('温度 (°C)', {
                id: 'edit-temperature-c',
                value: Number.isFinite(comp.temperatureC) ? comp.temperatureC : 25,
                min: -100,
                max: 300,
                step: 1,
                unit: '°C'
            }));
            break;

        case 'Photoresistor':
            content.appendChild(createFormGroup('暗态电阻 Rdark (Ω)', {
                id: 'edit-resistance-dark',
                value: Number.isFinite(comp.resistanceDark) ? comp.resistanceDark : 100000,
                min: 0.001,
                step: 100,
                unit: 'Ω'
            }));
            content.appendChild(createFormGroup('亮态电阻 Rlight (Ω)', {
                id: 'edit-resistance-light',
                value: Number.isFinite(comp.resistanceLight) ? comp.resistanceLight : 500,
                min: 0.001,
                step: 1,
                unit: 'Ω'
            }));
            content.appendChild(createSliderFormGroup('光照强度', {
                id: 'edit-light-level',
                valueId: 'light-level-value',
                value: (Number.isFinite(comp.lightLevel) ? comp.lightLevel : 0.5) * 100,
                displayValue: `${Math.round((Number.isFinite(comp.lightLevel) ? comp.lightLevel : 0.5) * 100)}%`,
                min: 0,
                max: 100,
                step: 1
            }));
            break;

        case 'Relay':
            content.appendChild(createFormGroup('线圈电阻 (Ω)', {
                id: 'edit-coil-resistance',
                value: Number.isFinite(comp.coilResistance) ? comp.coilResistance : 200,
                min: 0.001,
                step: 1,
                unit: 'Ω'
            }));
            content.appendChild(createFormGroup('吸合电流 (mA)', {
                id: 'edit-pullin-current',
                value: (Number.isFinite(comp.pullInCurrent) ? comp.pullInCurrent : 0.02) * 1000,
                min: 0.1,
                step: 0.1,
                unit: 'mA'
            }));
            content.appendChild(createFormGroup('释放电流 (mA)', {
                id: 'edit-dropout-current',
                value: (Number.isFinite(comp.dropOutCurrent) ? comp.dropOutCurrent : 0.01) * 1000,
                min: 0.1,
                step: 0.1,
                unit: 'mA'
            }));
            content.appendChild(createFormGroup('触点导通电阻 (Ω)', {
                id: 'edit-contact-on-resistance',
                value: Number.isFinite(comp.contactOnResistance) ? comp.contactOnResistance : 1e-3,
                min: 1e-9,
                step: 0.001,
                unit: 'Ω'
            }));
            content.appendChild(createFormGroup('触点断开电阻 (Ω)', {
                id: 'edit-contact-off-resistance',
                value: Number.isFinite(comp.contactOffResistance) ? comp.contactOffResistance : 1e12,
                min: 1,
                step: 1000,
                unit: 'Ω'
            }));
            break;
            
        case 'Rheostat':
            content.appendChild(createFormGroup('最小电阻 (Ω)', {
                id: 'edit-min-resistance',
                value: comp.minResistance,
                min: 0,
                step: 1,
                unit: 'Ω'
            }));
            content.appendChild(createFormGroup('最大电阻 (Ω)', {
                id: 'edit-max-resistance',
                value: comp.maxResistance,
                min: 0.001,
                step: 1,
                unit: 'Ω'
            }));
            content.appendChild(createSliderFormGroup('滑块位置', {
                id: 'edit-position',
                valueId: 'position-value',
                value: (comp.position * 100).toFixed(0),
                displayValue: `${(comp.position * 100).toFixed(0)}%`,
                min: 0,
                max: 100,
                step: 1
            }));
            break;
            
        case 'Bulb':
            content.appendChild(createFormGroup('灯丝电阻 (Ω)', {
                id: 'edit-resistance',
                value: comp.resistance,
                min: 0.001,
                step: 1,
                unit: 'Ω'
            }));
            content.appendChild(createFormGroup('额定功率 (W)', {
                id: 'edit-rated-power',
                value: comp.ratedPower,
                min: 0.001,
                step: 0.1,
                unit: 'W'
            }));
            break;
            
        case 'Capacitor':
            content.appendChild(createFormGroup('电容值 (μF)', {
                id: 'edit-capacitance',
                value: comp.capacitance * 1000000,
                min: 0.001,
                step: 100,
                unit: 'μF'
            }));
            content.appendChild(createSelectFormGroup('积分方法', {
                id: 'edit-integration-method',
                value: comp.integrationMethod || 'auto',
                options: INTEGRATION_METHOD_OPTIONS
            }, '自动模式会在含开关场景回退为后向欧拉。'));
            break;

        case 'Inductor':
            content.appendChild(createFormGroup('电感值 (H)', {
                id: 'edit-inductance',
                value: comp.inductance,
                min: 1e-6,
                step: 0.01,
                unit: 'H'
            }));
            content.appendChild(createFormGroup('初始电流 (A)', {
                id: 'edit-initial-current',
                value: comp.initialCurrent || 0,
                step: 0.01,
                unit: 'A'
            }));
            content.appendChild(createSelectFormGroup('积分方法', {
                id: 'edit-integration-method',
                value: comp.integrationMethod || 'auto',
                options: INTEGRATION_METHOD_OPTIONS
            }, '自动模式会在含开关场景回退为后向欧拉。'));
            break;

        case 'ParallelPlateCapacitor': {
            content.appendChild(createFormGroup('极板面积 A (cm²)', {
                id: 'edit-plate-area',
                value: (comp.plateArea || 0) * 10000,
                min: 0.01,
                step: 1,
                unit: 'cm²'
            }));
            content.appendChild(createFormGroup('极板间距 d (mm)', {
                id: 'edit-plate-distance',
                value: (comp.plateDistance || 0) * 1000,
                min: 0.01,
                step: 0.1,
                unit: 'mm'
            }));
            content.appendChild(createFormGroup('相对介电常数 εr', {
                id: 'edit-dielectric-constant',
                value: comp.dielectricConstant ?? 1,
                min: 1,
                step: 0.1,
                unit: ''
            }));

            const exploreGroup = createElement('div', { className: 'form-group' });
            exploreGroup.appendChild(createElement('label', { textContent: '探索模式（可拖动极板）' }));
            const checkbox = createElement('input', {
                id: 'edit-exploration-mode',
                attrs: { type: 'checkbox' }
            });
            checkbox.checked = !!comp.explorationMode;
            exploreGroup.appendChild(checkbox);
            content.appendChild(exploreGroup);
            break;
        }
            
        case 'Motor':
            content.appendChild(createFormGroup('电枢电阻 (Ω)', {
                id: 'edit-resistance',
                value: comp.resistance,
                min: 0.001,
                step: 0.1,
                unit: 'Ω'
            }));
            content.appendChild(createFormGroup('负载转矩 (N·m)', {
                id: 'edit-load-torque',
                value: comp.loadTorque,
                min: 0,
                step: 0.001,
                unit: 'N·m'
            }));
            break;
            
        case 'Switch':
            content.appendChild(createSwitchToggleGroup(comp.closed));
            break;

        case 'SPDTSwitch':
            content.appendChild(createSelectFormGroup('拨杆位置', {
                id: 'edit-spdt-position',
                value: comp.position === 'b' ? 'b' : 'a',
                options: [
                    { value: 'a', label: '上掷 (A)' },
                    { value: 'b', label: '下掷 (B)' }
                ]
            }));
            content.appendChild(createFormGroup('导通电阻 (Ω)', {
                id: 'edit-on-resistance',
                value: Number.isFinite(comp.onResistance) ? comp.onResistance : 1e-9,
                min: 1e-9,
                step: 0.001,
                unit: 'Ω'
            }));
            content.appendChild(createFormGroup('断开支路电阻 (Ω)', {
                id: 'edit-off-resistance',
                value: Number.isFinite(comp.offResistance) ? comp.offResistance : 1e12,
                min: 1,
                step: 1000,
                unit: 'Ω'
            }, '数值越大越接近理想断开'));
            break;

        case 'Fuse': {
            content.appendChild(createFormGroup('额定电流 (A)', {
                id: 'edit-rated-current',
                value: comp.ratedCurrent ?? 3,
                min: 0.001,
                step: 0.1,
                unit: 'A'
            }));
            content.appendChild(createFormGroup('熔断阈值 I²t (A²·s)', {
                id: 'edit-i2t-threshold',
                value: comp.i2tThreshold ?? 1,
                min: 1e-6,
                step: 0.1,
                unit: 'A²·s'
            }));
            content.appendChild(createFormGroup('正常电阻 (Ω)', {
                id: 'edit-cold-resistance',
                value: comp.coldResistance ?? 0.05,
                min: 1e-9,
                step: 0.001,
                unit: 'Ω'
            }));
            content.appendChild(createFormGroup('熔断后电阻 (Ω)', {
                id: 'edit-blown-resistance',
                value: comp.blownResistance ?? 1e12,
                min: 1,
                step: 1000,
                unit: 'Ω'
            }));

            const blownGroup = createElement('div', { className: 'form-group' });
            blownGroup.appendChild(createElement('label', { textContent: '状态' }));
            const blownInput = createElement('input', {
                id: 'edit-fuse-blown',
                attrs: { type: 'checkbox' }
            });
            blownInput.checked = !!comp.blown;
            blownGroup.appendChild(blownInput);
            blownGroup.appendChild(createElement('p', { className: 'hint', textContent: '取消勾选会复位保险丝并清空 I²t 累计值。' }));
            content.appendChild(blownGroup);
            break;
        }
            
        case 'Ammeter':
            content.appendChild(createFormGroup('内阻 (Ω)', {
                id: 'edit-resistance',
                value: comp.resistance,
                min: 0,
                step: 0.01,
                unit: 'Ω'
            }, '设为 0 表示理想电流表'));
            content.appendChild(createFormGroup('量程 (A)', {
                id: 'edit-range',
                value: comp.range,
                min: 0.001,
                step: 0.1,
                unit: 'A'
            }));
            break;
            
        case 'Voltmeter':
            content.appendChild(createFormGroup('内阻 (Ω)', {
                id: 'edit-resistance',
                value: comp.resistance === Infinity ? '' : comp.resistance,
                min: 0,
                step: 100,
                unit: 'Ω',
                placeholder: '留空表示无穷大'
            }, '留空或填 0 表示理想电压表（无穷大内阻）'));
            content.appendChild(createFormGroup('量程 (V)', {
                id: 'edit-range',
                value: comp.range,
                min: 0.001,
                step: 1,
                unit: 'V'
            }));
            break;

        case 'BlackBox': {
            const w = Math.max(80, comp.boxWidth || 180);
            const h = Math.max(60, comp.boxHeight || 110);
            content.appendChild(createFormGroup('宽度 (px)', {
                id: 'edit-box-width',
                value: w,
                min: 80,
                step: 10,
                unit: 'px'
            }));
            content.appendChild(createFormGroup('高度 (px)', {
                id: 'edit-box-height',
                value: h,
                min: 60,
                step: 10,
                unit: 'px'
            }));

            const modeGroup = createElement('div', { className: 'form-group' });
            modeGroup.appendChild(createElement('label', { textContent: '显示模式' }));
            const select = createElement('select', { id: 'edit-box-mode' });
            select.appendChild(createElement('option', { textContent: '透明（观察内部）', attrs: { value: 'transparent' } }));
            select.appendChild(createElement('option', { textContent: '隐藏（黑箱）', attrs: { value: 'opaque' } }));
            select.value = comp.viewMode === 'opaque' ? 'opaque' : 'transparent';
            modeGroup.appendChild(select);
            modeGroup.appendChild(createElement('p', { className: 'hint', textContent: '隐藏模式下会遮挡盒内电路，但电学计算不变。' }));
            content.appendChild(modeGroup);
            break;
        }
    }
    
    dialog.classList.remove('hidden');
    
    // 滑块实时更新
    const positionSlider = document.getElementById('edit-position');
    const positionValue = document.getElementById('position-value');
    if (positionSlider && positionValue) {
        positionSlider.addEventListener('input', () => {
            positionValue.textContent = `${positionSlider.value}%`;
        });
    }

    const lightLevelSlider = document.getElementById('edit-light-level');
    const lightLevelValue = document.getElementById('light-level-value');
    if (lightLevelSlider && lightLevelValue) {
        lightLevelSlider.addEventListener('input', () => {
            lightLevelValue.textContent = `${Math.round(Number(lightLevelSlider.value) || 0)}%`;
        });
    }
    
    // 开关状态切换按钮
    const switchOpen = document.getElementById('switch-open');
    const switchClose = document.getElementById('switch-close');
    if (switchOpen && switchClose) {
        switchOpen.addEventListener('click', () => {
            switchOpen.classList.add('active');
            switchClose.classList.remove('active');
        });
        switchClose.addEventListener('click', () => {
            switchClose.classList.add('active');
            switchOpen.classList.remove('active');
        });
    }
}
