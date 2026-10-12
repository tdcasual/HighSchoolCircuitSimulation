export const ACTIVE_SOURCE_TYPES = Object.freeze(['PowerSource', 'ACVoltageSource']);

export function isActiveSourceType(type) {
    return ACTIVE_SOURCE_TYPES.includes(type);
}
