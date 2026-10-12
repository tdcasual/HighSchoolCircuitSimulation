import { requireComponentDefinition } from '../../components/ComponentDefinitionRegistry.js';

function getDefaultValue(type, key, fallback = undefined) {
    const defaults = requireComponentDefinition(type).defaults || {};
    return Object.prototype.hasOwnProperty.call(defaults, key) ? defaults[key] : fallback;
}

function readNumericField(field, component) {
    const current = component?.[field.key];
    if (Number.isFinite(current)) return current;
    return getDefaultValue(component.type, field.key, field.defaultValue);
}

const DIALOG_FIELD_SCHEMAS = Object.freeze({
    PowerSource: Object.freeze([
        Object.freeze({ kind: 'number', key: 'voltage', id: 'edit-voltage', label: '电动势 (V)', min: 0, max: 10000, step: 0.1, unit: 'V', defaultValue: 6 }),
        Object.freeze({ kind: 'number', key: 'internalResistance', id: 'edit-internal-resistance', label: '内阻 (Ω)', min: 1e-9, max: 10000, step: 0.1, unit: 'Ω', defaultValue: 0.5 })
    ]),
    ACVoltageSource: Object.freeze([
        Object.freeze({ kind: 'number', key: 'rmsVoltage', id: 'edit-rms-voltage', label: '有效值 (V)', min: 0, max: 10000, step: 0.1, unit: 'V', defaultValue: 12 }),
        Object.freeze({ kind: 'number', key: 'frequency', id: 'edit-frequency', label: '频率 (Hz)', min: 0, max: 1e6, step: 0.1, unit: 'Hz', defaultValue: 50 }),
        Object.freeze({ kind: 'number', key: 'phase', id: 'edit-phase', label: '相位 (°)', min: -36000, max: 36000, step: 1, unit: '°', defaultValue: 0 }),
        Object.freeze({ kind: 'number', key: 'offset', id: 'edit-offset', label: '偏置 (V)', min: -1e6, max: 1e6, step: 0.1, unit: 'V', defaultValue: 0 }),
        Object.freeze({ kind: 'number', key: 'internalResistance', id: 'edit-internal-resistance', label: '内阻 (Ω)', min: 1e-9, max: 10000, step: 0.1, unit: 'Ω', defaultValue: 0.5 })
    ]),
    Resistor: Object.freeze([
        Object.freeze({ kind: 'number', key: 'resistance', id: 'edit-resistance', label: '电阻值 (Ω)', min: 1e-9, max: 1e12, step: 1, unit: 'Ω', defaultValue: 100 })
    ]),
    Ammeter: Object.freeze([
        Object.freeze({ kind: 'number', key: 'resistance', id: 'edit-resistance', label: '内阻 (Ω)', min: 0, max: 1e12, step: 0.01, unit: 'Ω', defaultValue: 0, hint: '设为 0 表示理想电流表' }),
        Object.freeze({ kind: 'number', key: 'range', id: 'edit-range', label: '量程 (A)', min: 0.001, max: 1e9, step: 0.1, unit: 'A', defaultValue: 3 })
    ]),
    Voltmeter: Object.freeze([
        Object.freeze({ kind: 'number', key: 'resistance', id: 'edit-resistance', label: '内阻 (Ω)', min: 0, max: 1e12, step: 100, unit: 'Ω', defaultValue: Infinity, placeholder: '留空表示无穷大', hint: '留空或填 0 表示理想电压表（无穷大内阻）' }),
        Object.freeze({ kind: 'number', key: 'range', id: 'edit-range', label: '量程 (V)', min: 0.001, max: 1e9, step: 1, unit: 'V', defaultValue: 15 })
    ]),
    Motor: Object.freeze([
        Object.freeze({ kind: 'number', key: 'resistance', id: 'edit-resistance', label: '电枢电阻 (Ω)', min: 1e-9, max: 1e6, step: 0.1, unit: 'Ω', defaultValue: 5 }),
        Object.freeze({ kind: 'number', key: 'torqueConstant', id: 'edit-torque-constant', label: '转矩常数 (N·m/A)', min: 0, max: 1000, step: 0.01, unit: 'N·m/A', defaultValue: 0.1 }),
        Object.freeze({ kind: 'number', key: 'emfConstant', id: 'edit-emf-constant', label: '反电动势常数 (V·s/rad)', min: 0, max: 1000, step: 0.01, unit: 'V·s/rad', defaultValue: 0.1 }),
        Object.freeze({ kind: 'number', key: 'inertia', id: 'edit-inertia', label: '转动惯量 (kg·m²)', min: 1e-9, max: 1000, step: 0.001, unit: 'kg·m²', defaultValue: 0.01 }),
        Object.freeze({ kind: 'number', key: 'loadTorque', id: 'edit-load-torque', label: '负载转矩 (N·m)', min: 0, max: 1000, step: 0.01, unit: 'N·m', defaultValue: 0.01 })
    ]),
    BlackBox: Object.freeze([
        Object.freeze({ kind: 'number', key: 'boxWidth', id: 'edit-box-width', label: '宽度 (px)', min: 80, max: 5000, step: 10, unit: 'px', defaultValue: 180 }),
        Object.freeze({ kind: 'number', key: 'boxHeight', id: 'edit-box-height', label: '高度 (px)', min: 60, max: 5000, step: 10, unit: 'px', defaultValue: 110 }),
        Object.freeze({ kind: 'select', key: 'viewMode', id: 'edit-box-mode', label: '显示模式', defaultValue: 'transparent', hint: '隐藏模式下会遮挡盒内电路，但电学计算不变。', options: [
            Object.freeze({ value: 'transparent', label: '透明（观察内部）' }),
            Object.freeze({ value: 'opaque', label: '隐藏（黑箱）' })
        ] })
    ]),
    Diode: Object.freeze([
        Object.freeze({ kind: 'number', key: 'forwardVoltage', id: 'edit-forward-voltage', label: '正向压降 (V)', min: 0, max: 1000, step: 0.1, unit: 'V', defaultValue: 0.7 }),
        Object.freeze({ kind: 'number', key: 'onResistance', id: 'edit-on-resistance', label: '导通电阻 (Ω)', min: 1e-9, max: 1e9, step: 0.1, unit: 'Ω', defaultValue: 1 }),
        Object.freeze({ kind: 'number', key: 'offResistance', id: 'edit-off-resistance', label: '截止电阻 (Ω)', min: 1, max: 1e15, step: 1000, unit: 'Ω', defaultValue: 1e9 })
    ]),
    LED: Object.freeze([
        Object.freeze({ kind: 'number', key: 'forwardVoltage', id: 'edit-forward-voltage', label: '正向压降 (V)', min: 0, max: 1000, step: 0.1, unit: 'V', defaultValue: 2 }),
        Object.freeze({ kind: 'number', key: 'onResistance', id: 'edit-on-resistance', label: '导通电阻 (Ω)', min: 1e-9, max: 1e9, step: 0.1, unit: 'Ω', defaultValue: 2 }),
        Object.freeze({ kind: 'number', key: 'offResistance', id: 'edit-off-resistance', label: '截止电阻 (Ω)', min: 1, max: 1e15, step: 1000, unit: 'Ω', defaultValue: 1e9 }),
        Object.freeze({ kind: 'number', key: 'ratedCurrent', id: 'edit-rated-current', label: '额定电流 If (mA)', min: 0.1, max: 100000, step: 0.1, unit: 'mA', defaultValue: 0.02, displayScale: 1000 })
    ]),
    Thermistor: Object.freeze([
        Object.freeze({ kind: 'number', key: 'resistanceAt25', id: 'edit-r25', label: 'R25 (Ω)', min: 1e-9, max: 1e15, step: 1, unit: 'Ω', defaultValue: 1000 }),
        Object.freeze({ kind: 'number', key: 'beta', id: 'edit-beta', label: 'Beta 常数 (K)', min: 1, max: 1e6, step: 10, unit: 'K', defaultValue: 3950 }),
        Object.freeze({ kind: 'number', key: 'temperatureC', id: 'edit-temperature-c', label: '温度 (°C)', min: -100, max: 300, step: 1, unit: '°C', defaultValue: 25 })
    ]),
    Photoresistor: Object.freeze([
        Object.freeze({ kind: 'number', key: 'resistanceDark', id: 'edit-resistance-dark', label: '暗态电阻 Rdark (Ω)', min: 1e-9, max: 1e15, step: 100, unit: 'Ω', defaultValue: 100000 }),
        Object.freeze({ kind: 'number', key: 'resistanceLight', id: 'edit-resistance-light', label: '亮态电阻 Rlight (Ω)', min: 1e-9, max: 1e15, step: 1, unit: 'Ω', defaultValue: 500 }),
        Object.freeze({ kind: 'slider', key: 'lightLevel', id: 'edit-light-level', valueId: 'light-level-value', label: '光照强度', min: 0, max: 100, step: 1, defaultValue: 0.5, displayScale: 100 })
    ]),
    Relay: Object.freeze([
        Object.freeze({ kind: 'number', key: 'coilResistance', id: 'edit-coil-resistance', label: '线圈电阻 (Ω)', min: 1e-9, max: 1e15, step: 1, unit: 'Ω', defaultValue: 200 }),
        Object.freeze({ kind: 'number', key: 'pullInCurrent', id: 'edit-pullin-current', label: '吸合电流 (mA)', min: 0.1, max: 1e6, step: 0.1, unit: 'mA', defaultValue: 0.02, displayScale: 1000 }),
        Object.freeze({ kind: 'number', key: 'dropOutCurrent', id: 'edit-dropout-current', label: '释放电流 (mA)', min: 0.1, max: 1e6, step: 0.1, unit: 'mA', defaultValue: 0.01, displayScale: 1000 }),
        Object.freeze({ kind: 'number', key: 'contactOnResistance', id: 'edit-contact-on-resistance', label: '触点导通电阻 (Ω)', min: 1e-9, max: 1e9, step: 0.001, unit: 'Ω', defaultValue: 1e-3 }),
        Object.freeze({ kind: 'number', key: 'contactOffResistance', id: 'edit-contact-off-resistance', label: '触点断开电阻 (Ω)', min: 1, max: 1e15, step: 1000, unit: 'Ω', defaultValue: 1e12 })
    ]),
    Rheostat: Object.freeze([
        Object.freeze({ kind: 'number', key: 'minResistance', id: 'edit-min-resistance', label: '最小电阻 (Ω)', min: 0, max: 1e12, step: 1, unit: 'Ω', defaultValue: 0 }),
        Object.freeze({ kind: 'number', key: 'maxResistance', id: 'edit-max-resistance', label: '最大电阻 (Ω)', min: 0.001, max: 1e12, step: 1, unit: 'Ω', defaultValue: 100 }),
        Object.freeze({ kind: 'slider', key: 'position', id: 'edit-position', valueId: 'position-value', label: '滑块位置', min: 0, max: 100, step: 1, defaultValue: 0.5, displayScale: 100 })
    ]),
    Bulb: Object.freeze([
        Object.freeze({ kind: 'number', key: 'resistance', id: 'edit-resistance', label: '灯丝电阻 (Ω)', min: 1e-9, max: 1e12, step: 1, unit: 'Ω', defaultValue: 50 }),
        Object.freeze({ kind: 'number', key: 'ratedPower', id: 'edit-rated-power', label: '额定功率 (W)', min: 0.001, max: 1e9, step: 0.1, unit: 'W', defaultValue: 5 })
    ]),
    Capacitor: Object.freeze([
        Object.freeze({ kind: 'number', key: 'capacitance', id: 'edit-capacitance', label: '电容值 (μF)', min: 0.001, max: 1e12, step: 100, unit: 'μF', defaultValue: 0.001, displayScale: 1e6 }),
        Object.freeze({ kind: 'select', key: 'integrationMethod', id: 'edit-integration-method', label: '积分方法', defaultValue: 'auto', hint: '自动模式会在含开关场景回退为后向欧拉。', options: [
            Object.freeze({ value: 'auto', label: '自动（默认梯形法）' }),
            Object.freeze({ value: 'trapezoidal', label: '梯形法' }),
            Object.freeze({ value: 'backward-euler', label: '后向欧拉' })
        ] })
    ]),
    Inductor: Object.freeze([
        Object.freeze({ kind: 'number', key: 'inductance', id: 'edit-inductance', label: '电感值 (H)', min: 1e-9, max: 1e12, step: 0.01, unit: 'H', defaultValue: 0.1 }),
        Object.freeze({ kind: 'number', key: 'initialCurrent', id: 'edit-initial-current', label: '初始电流 (A)', min: -1e6, max: 1e6, step: 0.01, unit: 'A', defaultValue: 0 }),
        Object.freeze({ kind: 'select', key: 'integrationMethod', id: 'edit-integration-method', label: '积分方法', defaultValue: 'auto', hint: '自动模式会在含开关场景回退为后向欧拉。', options: [
            Object.freeze({ value: 'auto', label: '自动（默认梯形法）' }),
            Object.freeze({ value: 'trapezoidal', label: '梯形法' }),
            Object.freeze({ value: 'backward-euler', label: '后向欧拉' })
        ] })
    ]),
    ParallelPlateCapacitor: Object.freeze([
        Object.freeze({ kind: 'number', key: 'plateArea', id: 'edit-plate-area', label: '极板面积 A (cm²)', min: 0.01, max: 1e12, step: 1, unit: 'cm²', defaultValue: 0.01, displayScale: 10000 }),
        Object.freeze({ kind: 'number', key: 'plateDistance', id: 'edit-plate-distance', label: '极板间距 d (mm)', min: 0.001, max: 1e9, step: 0.1, unit: 'mm', defaultValue: 0.001, displayScale: 1000 }),
        Object.freeze({ kind: 'number', key: 'dielectricConstant', id: 'edit-dielectric-constant', label: '相对介电常数 εr', min: 1, max: 1e9, step: 0.1, defaultValue: 1 }),
        Object.freeze({ kind: 'checkbox', key: 'explorationMode', id: 'edit-exploration-mode', label: '探索模式（可拖动极板）', defaultValue: false })
    ]),
    SPDTSwitch: Object.freeze([
        Object.freeze({ kind: 'select', key: 'position', id: 'edit-spdt-position', label: '拨杆位置', defaultValue: 'a', options: [
            Object.freeze({ value: 'a', label: '上掷 (A)' }),
            Object.freeze({ value: 'b', label: '下掷 (B)' })
        ] }),
        Object.freeze({ kind: 'number', key: 'onResistance', id: 'edit-on-resistance', label: '导通电阻 (Ω)', min: 1e-9, max: 1e9, step: 0.001, unit: 'Ω', defaultValue: 1e-9 }),
        Object.freeze({ kind: 'number', key: 'offResistance', id: 'edit-off-resistance', label: '断开支路电阻 (Ω)', min: 1, max: 1e15, step: 1000, unit: 'Ω', defaultValue: 1e12, hint: '数值越大越接近理想断开' })
    ]),
    Fuse: Object.freeze([
        Object.freeze({ kind: 'number', key: 'ratedCurrent', id: 'edit-rated-current', label: '额定电流 (A)', min: 0.001, max: 1e9, step: 0.1, unit: 'A', defaultValue: 3 }),
        Object.freeze({ kind: 'number', key: 'i2tThreshold', id: 'edit-i2t-threshold', label: '熔断阈值 I²t (A²·s)', min: 1e-9, max: 1e12, step: 0.1, unit: 'A²·s', defaultValue: 1 }),
        Object.freeze({ kind: 'number', key: 'coldResistance', id: 'edit-cold-resistance', label: '正常电阻 (Ω)', min: 1e-9, max: 1e9, step: 0.01, unit: 'Ω', defaultValue: 0.05 }),
        Object.freeze({ kind: 'number', key: 'blownResistance', id: 'edit-blown-resistance', label: '熔断电阻 (Ω)', min: 1, max: 1e15, step: 1000, unit: 'Ω', defaultValue: 1e12 }),
        Object.freeze({ kind: 'checkbox', key: 'blown', id: 'edit-fuse-blown', label: '已熔断', defaultValue: false, hint: '取消勾选会复位保险丝并清空 I²t 累计值。' })
    ])
});

export function getComponentPropertyDialogFields(component) {
    const type = String(component?.type || '');
    const schema = DIALOG_FIELD_SCHEMAS[type];
    if (!schema) return [];

    return schema.map((field) => {
        if (field.kind === 'select') {
            const current = component?.[field.key];
            const allowed = (field.options || []).map((option) => option.value);
            const value = allowed.includes(current) ? current : String(field.defaultValue ?? allowed[0] ?? '');
            return { ...field, value };
        }
        if (field.kind === 'checkbox') {
            return { ...field, value: !!component?.[field.key] };
        }
        if (field.kind === 'slider') {
            const stored = readNumericField(field, component);
            const scale = Number(field.displayScale) || 1;
            const display = stored * scale;
            return {
                ...field,
                value: display,
                displayValue: `${Math.round(display)}%`
            };
        }

        if (type === 'BlackBox' && field.key === 'boxWidth') {
            return { ...field, value: Math.max(80, component?.boxWidth || field.defaultValue) };
        }
        if (type === 'BlackBox' && field.key === 'boxHeight') {
            return { ...field, value: Math.max(60, component?.boxHeight || field.defaultValue) };
        }
        if (type === 'Voltmeter' && field.key === 'resistance') {
            return {
                ...field,
                value: component?.resistance === Infinity ? '' : readNumericField(field, component)
            };
        }

        const stored = readNumericField(field, component);
        const scale = Number(field.displayScale);
        const value = Number.isFinite(scale) && scale !== 0 ? stored * scale : stored;
        return { ...field, value };
    });
}

function readCheckboxValue(field, readFieldValue, readCheckbox) {
    if (typeof readCheckbox === 'function') {
        return !!readCheckbox(field.id, !!field.defaultValue);
    }
    if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
        const element = document.getElementById(field.id);
        if (element && typeof element.checked === 'boolean') {
            return element.checked;
        }
    }
    const raw = String(readFieldValue(field.id, field.defaultValue ? 'true' : 'false')).trim().toLowerCase();
    return raw === 'true' || raw === '1' || raw === 'on' || raw === 'yes';
}

function parseDisplayNumber(field, raw, safeParseFloat) {
    const scale = Number(field.displayScale);
    const hasScale = Number.isFinite(scale) && scale !== 0 && scale !== 1;
    const displayDefault = hasScale ? Number(field.defaultValue) * scale : field.defaultValue;
    const parsed = safeParseFloat(raw, displayDefault, field.min ?? null, field.max ?? null);
    if (!Number.isFinite(parsed)) return field.defaultValue;
    return hasScale ? parsed / scale : parsed;
}

export function applyComponentPropertyDialogChanges({ component, readFieldValue, safeParseFloat, readCheckbox }) {
    const comp = component;
    if (!comp || typeof readFieldValue !== 'function' || typeof safeParseFloat !== 'function') {
        return false;
    }

    const fields = DIALOG_FIELD_SCHEMAS[comp.type];
    if (!fields) return false;

    for (const field of fields) {
        if (field.kind === 'checkbox') {
            comp[field.key] = readCheckboxValue(field, readFieldValue, readCheckbox);
            continue;
        }
        if (field.kind === 'select') {
            const raw = String(readFieldValue(field.id, field.defaultValue ?? ''));
            const allowed = (field.options || []).map((option) => option.value);
            comp[field.key] = allowed.includes(raw) ? raw : (field.defaultValue ?? allowed[0] ?? '');
            continue;
        }
        if (comp.type === 'Voltmeter' && field.key === 'resistance') {
            const rawResistance = String(readFieldValue(field.id)).trim();
            if (rawResistance === '' || Number(rawResistance) === 0) {
                comp.resistance = Infinity;
            } else {
                comp.resistance = safeParseFloat(rawResistance, 0, field.min, field.max);
            }
            continue;
        }

        const stored = parseDisplayNumber(field, readFieldValue(field.id), safeParseFloat);
        if (field.key === 'boxWidth' || field.key === 'boxHeight') {
            comp[field.key] = Math.round(stored);
        } else {
            comp[field.key] = stored;
        }
    }

    if (comp.type === 'Capacitor') {
        comp._dynamicHistoryReady = false;
    }
    if (comp.type === 'Inductor') {
        comp.prevCurrent = Number.isFinite(comp.initialCurrent) ? comp.initialCurrent : 0;
        comp.prevVoltage = 0;
        comp._dynamicHistoryReady = false;
    }
    if (comp.type === 'Fuse' && !comp.blown) {
        comp.i2tAccum = 0;
    }
    if (comp.type === 'Rheostat') {
        const minR = Number.isFinite(comp.minResistance) ? comp.minResistance : 0;
        if (!Number.isFinite(comp.maxResistance) || comp.maxResistance < minR + 0.001) {
            comp.maxResistance = minR + 0.001;
        }
    }
    if ((comp.type === 'PowerSource' || comp.type === 'ACVoltageSource')
        && (!Number.isFinite(comp.internalResistance) || comp.internalResistance < 1e-9)) {
        comp.internalResistance = 1e-9;
    }
    return true;
}
