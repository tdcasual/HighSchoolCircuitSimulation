/**
 * ObservationSources.js - 观察量来源与取值
 * 负责把“轴选择（组件/量）”转成数值；尽量保持纯函数，便于测试与复用。
 */

import { ComponentNames } from '../../components/Component.js';
import { computeOverlapFractionFromOffsetPx } from '../../utils/Physics.js';

export const TIME_SOURCE_ID = '__time__';

export const QuantityIds = /** @type {const} */ ({
    Time: 't',
    Current: 'I',
    Voltage: 'U',
    Power: 'P',
    Resistance: 'R',
    Capacitance: 'C',
    Charge: 'Q',
    PlateDistance: 'd',
    ElectricField: 'E',
    EffectiveArea: 'Aeff',
    OverlapFraction: 'overlap',
    DielectricConstant: 'epsilonR',
    MotorSpeedRpm: 'rpm',
    MotorBackEmf: 'backEmf',
    SwitchClosed: 'closed',
    BulbBrightness: 'brightness',
    SourceEmf: 'emf',
    SourceInternalResistance: 'rInternal'
});

const baseQuantityDefs = [
    { id: QuantityIds.Current, label: '电流 I (A)', unit: 'A' },
    { id: QuantityIds.Voltage, label: '电压 U (V)', unit: 'V' },
    { id: QuantityIds.Power, label: '功率 P (W)', unit: 'W' }
];

export function getSourceOptions(circuit) {
    const options = [{ id: TIME_SOURCE_ID, label: '时间 t (s)' }];
    if (!circuit || !circuit.components) return options;

    for (const comp of circuit.components.values()) {
        const label = comp.label ? `${comp.label} (${comp.id})` : comp.id;
        const typeName = ComponentNames[comp.type] || comp.type;
        options.push({
            id: comp.id,
            label: `${label} · ${typeName}`
        });
    }
    return options;
}

export function getQuantitiesForSource(sourceId, circuit) {
    if (sourceId === TIME_SOURCE_ID) {
        return [{ id: QuantityIds.Time, label: '时间 t', unit: 's' }];
    }

    const comp = circuit?.components?.get(sourceId);
    if (!comp) {
        return baseQuantityDefs.slice();
    }

    const list = baseQuantityDefs.slice();
    switch (comp.type) {
        case 'PowerSource':
            list.push({ id: QuantityIds.SourceEmf, label: '电动势 E', unit: 'V' });
            list.push({ id: QuantityIds.SourceInternalResistance, label: '内阻 r', unit: 'Ω' });
            break;
        case 'Resistor':
        case 'Bulb':
            list.push({ id: QuantityIds.Resistance, label: '电阻 R', unit: 'Ω' });
            if (comp.type === 'Bulb') {
                list.push({ id: QuantityIds.BulbBrightness, label: '亮度', unit: '' });
            }
            break;
        case 'Rheostat':
            list.push({ id: QuantityIds.Resistance, label: '接入电阻 R', unit: 'Ω' });
            break;
        case 'Capacitor':
            list.push({ id: QuantityIds.Capacitance, label: '电容 C', unit: 'F' });
            list.push({ id: QuantityIds.Charge, label: '电荷 Q', unit: 'C' });
            break;
        case 'ParallelPlateCapacitor':
            list.push({ id: QuantityIds.Capacitance, label: '电容 C', unit: 'F' });
            list.push({ id: QuantityIds.Charge, label: '电荷 Q', unit: 'C' });
            list.push({ id: QuantityIds.PlateDistance, label: '板间距 d', unit: 'm' });
            list.push({ id: QuantityIds.ElectricField, label: '电场强度 E', unit: 'V/m' });
            list.push({ id: QuantityIds.EffectiveArea, label: '有效面积 A_eff', unit: 'm²' });
            list.push({ id: QuantityIds.OverlapFraction, label: '重叠比例', unit: '' });
            list.push({ id: QuantityIds.DielectricConstant, label: '介电常数 εr', unit: '' });
            break;
        case 'Motor':
            list.push({ id: QuantityIds.MotorSpeedRpm, label: '转速', unit: 'rpm' });
            list.push({ id: QuantityIds.MotorBackEmf, label: '反电动势', unit: 'V' });
            break;
        case 'Switch':
            list.push({ id: QuantityIds.SwitchClosed, label: '开关(闭合=1)', unit: '' });
            break;
        default:
            break;
    }
    return list;
}

export function evaluateSourceQuantity(circuit, sourceId, quantityId) {
    if (sourceId === TIME_SOURCE_ID) {
        return Number.isFinite(circuit?.simTime) ? circuit.simTime : 0;
    }

    const comp = circuit?.components?.get(sourceId);
    if (!comp) return null;

    switch (quantityId) {
        case QuantityIds.Current:
            return Number.isFinite(comp.currentValue) ? comp.currentValue : 0;
        case QuantityIds.Voltage:
            return Number.isFinite(comp.voltageValue) ? comp.voltageValue : 0;
        case QuantityIds.Power:
            return Number.isFinite(comp.powerValue) ? comp.powerValue : 0;
        case QuantityIds.Resistance: {
            if (comp.type === 'Rheostat') {
                // 尽量使用电路已计算的 activeResistance，缺失时按位置估算
                if (Number.isFinite(comp.activeResistance)) return comp.activeResistance;
                const minR = comp.minResistance ?? 0;
                const maxR = comp.maxResistance ?? 100;
                const position = comp.position == null ? 0.5 : Math.min(Math.max(comp.position, 0), 1);
                const total = maxR - minR;
                const rLeft = minR + total * position;
                const rRight = maxR - total * position;
                switch (comp.connectionMode) {
                    case 'left-slider':
                    case 'all':
                        return rLeft;
                    case 'right-slider':
                        return rRight;
                    case 'left-right':
                        return maxR;
                    default:
                        return 0;
                }
            }
            if (Number.isFinite(comp.resistance)) return comp.resistance;
            return null;
        }
        case QuantityIds.Capacitance:
            return Number.isFinite(comp.capacitance) ? comp.capacitance : null;
        case QuantityIds.Charge:
            if (Number.isFinite(comp.prevCharge)) return comp.prevCharge;
            if (Number.isFinite(comp.capacitance) && Number.isFinite(comp.prevVoltage)) {
                return comp.capacitance * comp.prevVoltage;
            }
            return null;
        case QuantityIds.PlateDistance:
            return Number.isFinite(comp.plateDistance) ? comp.plateDistance : null;
        case QuantityIds.ElectricField: {
            const d = Number.isFinite(comp.plateDistance) ? comp.plateDistance : null;
            if (!d || d <= 0) return null;
            const u = Number.isFinite(comp.voltageValue) ? Math.abs(comp.voltageValue) : 0;
            return u / d;
        }
        case QuantityIds.EffectiveArea: {
            const a = Number.isFinite(comp.plateArea) ? comp.plateArea : null;
            if (!a || a <= 0) return null;
            const overlapFraction = computeOverlapFractionFromOffsetPx(comp.plateOffsetYPx || 0, 24);
            return a * overlapFraction;
        }
        case QuantityIds.OverlapFraction:
            return computeOverlapFractionFromOffsetPx(comp.plateOffsetYPx || 0, 24);
        case QuantityIds.DielectricConstant:
            return Number.isFinite(comp.dielectricConstant) ? comp.dielectricConstant : null;
        case QuantityIds.MotorSpeedRpm: {
            const omega = Number.isFinite(comp.speed) ? comp.speed : 0;
            return omega * 60 / (2 * Math.PI);
        }
        case QuantityIds.MotorBackEmf:
            return Number.isFinite(comp.backEmf) ? comp.backEmf : 0;
        case QuantityIds.SwitchClosed:
            return comp.closed ? 1 : 0;
        case QuantityIds.BulbBrightness:
            return Number.isFinite(comp.brightness) ? comp.brightness : 0;
        case QuantityIds.SourceEmf:
            return Number.isFinite(comp.voltage) ? comp.voltage : null;
        case QuantityIds.SourceInternalResistance:
            return Number.isFinite(comp.internalResistance) ? comp.internalResistance : null;
        default:
            return null;
    }
}
