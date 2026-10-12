import {
    IDEAL_SOURCE_RESISTANCE_EPS,
    registerDefaultStamps,
    resolveSourceInstantVoltage
} from '../../utils/registerDefaultStamps.js';

export { IDEAL_SOURCE_RESISTANCE_EPS, resolveSourceInstantVoltage };

export class StampRegistryV2 {
    constructor() {
        this.byType = new Map();
    }

    register(type, handlers) {
        if (!type) return;
        this.byType.set(type, handlers || {});
    }

    get(type) {
        return this.byType.get(type) || null;
    }
}

export const DefaultStampRegistryV2 = new StampRegistryV2();
registerDefaultStamps(DefaultStampRegistryV2);
