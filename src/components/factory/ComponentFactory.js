/**
 * ComponentFactory.js - 组件实例工厂与 ID 计数器
 */

import { computeOverlapFractionFromOffsetPx, computeParallelPlateCapacitance } from '../../utils/Physics.js';
import {
    generateEntityId,
    resetEntityIdCounter,
    updateEntityIdCounterFromExisting
} from '../../utils/id/EntityIdCounter.js';
import { ComponentDefaults, getComponentTerminalCount } from '../catalog/ComponentCatalog.js';

/**
 * 生成唯一ID
 * @param {string} type - 元器件类型
 * @returns {string} 唯一ID
 */
export function generateId(type) {
    return generateEntityId(type);
}

/**
 * 重置ID计数器
 */
export function resetIdCounter() {
    resetEntityIdCounter();
}

/**
 * 根据现有ID更新计数器，防止ID冲突
 * @param {string[]} existingIds - 现有的ID列表
 */
export function updateIdCounterFromExisting(existingIds) {
    updateEntityIdCounterFromExisting(existingIds);
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
    const terminalCount = getComponentTerminalCount(type);

    const terminalExtensions = {};
    for (let i = 0; i < terminalCount; i++) {
        terminalExtensions[i] = { x: 0, y: 0 };
    }

    const hasExistingId = existingId !== null
        && existingId !== undefined
        && (typeof existingId !== 'string' || existingId.trim());
    const id = hasExistingId ? String(existingId) : generateId(type);
    const defaultDisplay = {
        current: true,
        voltage: false,
        power: false
    };

    if (type === 'Voltmeter') {
        defaultDisplay.current = false;
        defaultDisplay.voltage = true;
    }
    if (type === 'Switch' || type === 'SPDTSwitch' || type === 'Ground') {
        defaultDisplay.current = false;
        defaultDisplay.voltage = false;
        defaultDisplay.power = false;
    }
    if (type === 'BlackBox') {
        defaultDisplay.current = false;
        defaultDisplay.voltage = false;
        defaultDisplay.power = false;
    }

    const component = {
        id,
        type,
        label: null,
        x,
        y,
        rotation: 0,
        nodes: Array.from({ length: terminalCount }, () => -1),
        currentValue: 0,
        voltageValue: 0,
        powerValue: 0,
        display: defaultDisplay,
        terminalExtensions,
        ...defaults
    };

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
