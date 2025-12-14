/**
 * Physics.js - 物理与演示相关的小工具（无副作用，可测试）
 */

export const EPSILON_0 = 8.854187817e-12; // 真空介电常数 (F/m)

export function clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
}

/**
 * 由“单个极板在局部坐标系的纵向偏移”估算重叠比例（0..1）。
 * 两极板长度为 plateLengthPx，偏移为 0 时重叠为 1，偏移达到 plateLengthPx 时重叠为 0。
 */
export function computeOverlapFractionFromOffsetPx(offsetPx, plateLengthPx) {
    const length = Math.max(1, plateLengthPx);
    const overlapPx = Math.max(0, length - Math.abs(offsetPx || 0));
    return clamp(overlapPx / length, 0, 1);
}

/**
 * 平行板电容：C = ε0 εr A / d
 * @param {Object} params
 * @param {number} params.plateArea - 板面积 (m^2)
 * @param {number} params.plateDistance - 板间距 (m)
 * @param {number} params.dielectricConstant - 相对介电常数 εr
 * @param {number} [params.overlapFraction=1] - 0..1 的有效重叠比例
 * @returns {number} 电容 (F)
 */
export function computeParallelPlateCapacitance(params) {
    const area = Math.max(0, params?.plateArea ?? 0);
    const distance = Math.max(1e-12, params?.plateDistance ?? 0);
    const erRaw = params?.dielectricConstant ?? 1;
    const er = Math.max(1e-6, Number.isFinite(erRaw) ? erRaw : 1);
    const overlapFraction = clamp(params?.overlapFraction ?? 1, 0, 1);
    return EPSILON_0 * er * (area * overlapFraction) / distance;
}

