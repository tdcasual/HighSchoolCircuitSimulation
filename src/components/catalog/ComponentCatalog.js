/**
 * ComponentCatalog.js - 组件元数据目录
 * 从 canonical component definition registry 派生默认参数、显示名和端子数量映射。
 */

import {
    buildComponentDefaultsMap,
    buildComponentDisplayNameMap,
    buildComponentTerminalCountMap
} from '../ComponentDefinitionRegistry.js';

export const ComponentDefaults = buildComponentDefaultsMap();

export const ComponentNames = buildComponentDisplayNameMap();

const COMPONENT_TERMINAL_COUNT = Object.freeze(buildComponentTerminalCountMap());

export function getComponentTerminalCount(type) {
    return COMPONENT_TERMINAL_COUNT[type] || 2;
}
