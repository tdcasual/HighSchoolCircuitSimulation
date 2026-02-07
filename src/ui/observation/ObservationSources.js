/**
 * ObservationSources.js - 观察量来源与取值
 * 负责把“轴选择（组件/量）”转成数值；尽量保持纯函数，便于测试与复用。
 */

import { ComponentNames } from '../../components/Component.js';
import {
    computeNtcThermistorResistance,
    computeOverlapFractionFromOffsetPx,
    computePhotoresistorResistance
} from '../../utils/Physics.js';

export const TIME_SOURCE_ID = '__time__';
export const PROBE_SOURCE_PREFIX = '__probe__:';

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
    SwitchRoute: 'route',
    BulbBrightness: 'brightness',
    SourceEmf: 'emf',
    SourceInternalResistance: 'rInternal'
});

const baseQuantityDefs = [
    { id: QuantityIds.Current, label: '电流 I (A)', unit: 'A' },
    { id: QuantityIds.Voltage, label: '电压 U (V)', unit: 'V' },
    { id: QuantityIds.Power, label: '功率 P (W)', unit: 'W' }
];

function toProbeSourceId(probeId) {
    return `${PROBE_SOURCE_PREFIX}${probeId}`;
}

function parseProbeSourceId(sourceId) {
    if (typeof sourceId !== 'string') return null;
    if (!sourceId.startsWith(PROBE_SOURCE_PREFIX)) return null;
    const probeId = sourceId.slice(PROBE_SOURCE_PREFIX.length).trim();
    return probeId || null;
}

function getProbeTypeLabel(type) {
    if (type === 'NodeVoltageProbe') return '节点电压探针';
    if (type === 'WireCurrentProbe') return '支路电流探针';
    return '探针';
}

function resolveObservationProbe(circuit, sourceId) {
    if (!circuit || typeof circuit.getObservationProbe !== 'function') return null;
    const prefixedId = parseProbeSourceId(sourceId);
    if (prefixedId) {
        return circuit.getObservationProbe(prefixedId) || null;
    }
    if (circuit.components?.get?.(sourceId)) return null;
    return circuit.getObservationProbe(sourceId) || null;
}

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

    const probes = typeof circuit.getAllObservationProbes === 'function'
        ? circuit.getAllObservationProbes()
        : [];
    for (const probe of probes) {
        if (!probe?.id || !probe?.type) continue;
        const typeLabel = getProbeTypeLabel(probe.type);
        const probeLabel = probe.label?.trim() || probe.id;
        const wireExists = !!circuit.getWire?.(probe.wireId);
        const wireLabel = wireExists ? probe.wireId : `${probe.wireId}（导线不存在）`;
        options.push({
            id: toProbeSourceId(probe.id),
            label: `${probeLabel} · ${typeLabel} · ${wireLabel}`
        });
    }
    return options;
}

export function getQuantitiesForSource(sourceId, circuit) {
    if (sourceId === TIME_SOURCE_ID) {
        return [{ id: QuantityIds.Time, label: '时间 t', unit: 's' }];
    }

    const probe = resolveObservationProbe(circuit, sourceId);
    if (probe) {
        if (probe.type === 'NodeVoltageProbe') {
            return [{ id: QuantityIds.Voltage, label: '节点电压 U', unit: 'V' }];
        }
        if (probe.type === 'WireCurrentProbe') {
            return [{ id: QuantityIds.Current, label: '支路电流 I', unit: 'A' }];
        }
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
        case 'Fuse':
            list.push({ id: QuantityIds.Resistance, label: '等效电阻 R', unit: 'Ω' });
            break;
        case 'Diode':
            list.push({ id: QuantityIds.Resistance, label: '等效电阻 R', unit: 'Ω' });
            break;
        case 'Thermistor':
            list.push({ id: QuantityIds.Resistance, label: '当前电阻 R', unit: 'Ω' });
            break;
        case 'Photoresistor':
            list.push({ id: QuantityIds.Resistance, label: '当前电阻 R', unit: 'Ω' });
            break;
        case 'LED':
            list.push({ id: QuantityIds.Resistance, label: '等效电阻 R', unit: 'Ω' });
            list.push({ id: QuantityIds.BulbBrightness, label: '亮度', unit: '' });
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
        case 'SPDTSwitch':
            list.push({ id: QuantityIds.SwitchRoute, label: '拨杆(上掷=0,下掷=1)', unit: '' });
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

    const probe = resolveObservationProbe(circuit, sourceId);
    if (probe) {
        const wire = circuit?.getWire?.(probe.wireId);
        const results = circuit?.lastResults;
        if (!wire) return null;

        if (probe.type === 'NodeVoltageProbe') {
            if (quantityId !== QuantityIds.Voltage) return null;
            if (!results?.valid) return 0;
            const nodeIndex = Number.isFinite(wire.nodeIndex) ? wire.nodeIndex : -1;
            if (nodeIndex < 0) return 0;
            const nodeVoltage = results.voltages?.[nodeIndex];
            return Number.isFinite(nodeVoltage) ? nodeVoltage : 0;
        }

        if (probe.type === 'WireCurrentProbe') {
            if (quantityId !== QuantityIds.Current) return null;
            if (!results?.valid || typeof circuit?.getWireCurrentInfo !== 'function') return 0;
            const info = circuit.getWireCurrentInfo(wire, results);
            if (!info) return 0;
            const magnitude = Number.isFinite(info.current) ? info.current : 0;
            const flowDirection = Number.isFinite(info.flowDirection) ? info.flowDirection : 0;
            return flowDirection * magnitude;
        }
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
            if (comp.type === 'Fuse') {
                const cold = Number.isFinite(comp.coldResistance) ? comp.coldResistance : 0.05;
                const blown = Number.isFinite(comp.blownResistance) ? comp.blownResistance : 1e12;
                return comp.blown ? blown : cold;
            }
            if (comp.type === 'Diode') {
                if (comp.conducting) return Number.isFinite(comp.onResistance) ? comp.onResistance : 1;
                return Number.isFinite(comp.offResistance) ? comp.offResistance : 1e9;
            }
            if (comp.type === 'Thermistor') {
                return computeNtcThermistorResistance(comp);
            }
            if (comp.type === 'Photoresistor') {
                return computePhotoresistorResistance(comp);
            }
            if (comp.type === 'LED') {
                if (comp.conducting) return Number.isFinite(comp.onResistance) ? comp.onResistance : 2;
                return Number.isFinite(comp.offResistance) ? comp.offResistance : 1e9;
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
        case QuantityIds.SwitchRoute:
            return comp.position === 'b' ? 1 : 0;
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
