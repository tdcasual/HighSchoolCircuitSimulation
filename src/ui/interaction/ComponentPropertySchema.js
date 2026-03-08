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
        Object.freeze({ kind: 'number', key: 'voltage', id: 'edit-voltage', label: '电动势 (V)', min: 0, max: 10000, step: 0.1, unit: 'V', defaultValue: 12 }),
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
    BlackBox: Object.freeze([
        Object.freeze({ kind: 'number', key: 'boxWidth', id: 'edit-box-width', label: '宽度 (px)', min: 80, max: 5000, step: 10, unit: 'px', defaultValue: 180 }),
        Object.freeze({ kind: 'number', key: 'boxHeight', id: 'edit-box-height', label: '高度 (px)', min: 60, max: 5000, step: 10, unit: 'px', defaultValue: 110 }),
        Object.freeze({ kind: 'select', key: 'viewMode', id: 'edit-box-mode', label: '显示模式', defaultValue: 'transparent', hint: '隐藏模式下会遮挡盒内电路，但电学计算不变。', options: [
            Object.freeze({ value: 'transparent', label: '透明（观察内部）' }),
            Object.freeze({ value: 'opaque', label: '隐藏（黑箱）' })
        ] })
    ])
});

export function getComponentPropertyDialogFields(component) {
    const type = String(component?.type || '');
    const schema = DIALOG_FIELD_SCHEMAS[type];
    if (!schema) return [];

    return schema.map((field) => {
        if (field.kind === 'select') {
            return {
                ...field,
                value: component?.[field.key] === 'opaque' ? 'opaque' : String(field.defaultValue || 'transparent')
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

        return {
            ...field,
            value: readNumericField(field, component)
        };
    });
}

export function applyComponentPropertyDialogChanges({ component, readFieldValue, safeParseFloat }) {
    const comp = component;
    if (!comp || typeof readFieldValue !== 'function' || typeof safeParseFloat !== 'function') {
        return false;
    }

    switch (comp.type) {
        case 'PowerSource': {
            const [voltageField, resistanceField] = getComponentPropertyDialogFields(comp);
            comp.voltage = safeParseFloat(readFieldValue(voltageField.id), voltageField.defaultValue, voltageField.min, voltageField.max);
            comp.internalResistance = safeParseFloat(readFieldValue(resistanceField.id), resistanceField.defaultValue, resistanceField.min, resistanceField.max);
            return true;
        }
        case 'ACVoltageSource': {
            const [rmsField, frequencyField, phaseField, offsetField, resistanceField] = getComponentPropertyDialogFields(comp);
            comp.rmsVoltage = safeParseFloat(readFieldValue(rmsField.id), rmsField.defaultValue, rmsField.min, rmsField.max);
            comp.frequency = safeParseFloat(readFieldValue(frequencyField.id), frequencyField.defaultValue, frequencyField.min, frequencyField.max);
            comp.phase = safeParseFloat(readFieldValue(phaseField.id), phaseField.defaultValue, phaseField.min, phaseField.max);
            comp.offset = safeParseFloat(readFieldValue(offsetField.id), offsetField.defaultValue, offsetField.min, offsetField.max);
            comp.internalResistance = safeParseFloat(readFieldValue(resistanceField.id), resistanceField.defaultValue, resistanceField.min, resistanceField.max);
            return true;
        }
        case 'Resistor': {
            const [resistanceField] = getComponentPropertyDialogFields(comp);
            comp.resistance = safeParseFloat(readFieldValue(resistanceField.id), resistanceField.defaultValue, resistanceField.min, resistanceField.max);
            return true;
        }
        case 'Ammeter': {
            const [resistanceField, rangeField] = getComponentPropertyDialogFields(comp);
            comp.resistance = safeParseFloat(readFieldValue(resistanceField.id), resistanceField.defaultValue, resistanceField.min, resistanceField.max);
            comp.range = safeParseFloat(readFieldValue(rangeField.id), rangeField.defaultValue, rangeField.min, rangeField.max);
            return true;
        }
        case 'Voltmeter': {
            const [resistanceField, rangeField] = getComponentPropertyDialogFields(comp);
            const rawResistance = String(readFieldValue(resistanceField.id)).trim();
            comp.resistance = rawResistance === '' || Number(rawResistance) === 0
                ? Infinity
                : safeParseFloat(rawResistance, 0, resistanceField.min, resistanceField.max);
            comp.range = safeParseFloat(readFieldValue(rangeField.id), rangeField.defaultValue, rangeField.min, rangeField.max);
            return true;
        }
        case 'BlackBox': {
            const [widthField, heightField, modeField] = getComponentPropertyDialogFields(comp);
            comp.boxWidth = Math.round(safeParseFloat(readFieldValue(widthField.id), widthField.defaultValue, widthField.min, widthField.max));
            comp.boxHeight = Math.round(safeParseFloat(readFieldValue(heightField.id), heightField.defaultValue, heightField.min, heightField.max));
            comp.viewMode = readFieldValue(modeField.id) === 'opaque' ? 'opaque' : 'transparent';
            return true;
        }
        default:
            return false;
    }
}
