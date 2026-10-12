export const SHADOW_REL_TOL = 1e-3;
export const SHADOW_ABS_TOL = 1e-6;
export const SHADOW_SAMPLE_EVERY_N = 5;

function collectKeys(record) {
    if (record instanceof Map) {
        return Array.from(record.keys(), String);
    }
    if (record && typeof record === 'object') {
        return Object.keys(record);
    }
    return [];
}

function readKeyedValue(record, key) {
    if (record instanceof Map) {
        if (record.has(key)) return { present: true, value: record.get(key) };
        const asString = String(key);
        if (record.has(asString)) return { present: true, value: record.get(asString) };
        return { present: false, value: undefined };
    }
    if (record && typeof record === 'object') {
        if (Object.prototype.hasOwnProperty.call(record, key)) {
            return { present: true, value: record[key] };
        }
        const asString = String(key);
        if (Object.prototype.hasOwnProperty.call(record, asString)) {
            return { present: true, value: record[asString] };
        }
    }
    return { present: false, value: undefined };
}

function numericMismatch(left, right, relTol, absTol) {
    if (!Number.isFinite(left) || !Number.isFinite(right)) return true;
    const absolute = Math.abs(left - right);
    const scale = Math.max(Math.abs(left), Math.abs(right));
    const relative = scale === 0 ? 0 : absolute / scale;
    return relative > relTol && absolute > absTol;
}

function pushMismatch(mismatches, path, left, right) {
    mismatches.push({ path, left, right });
}

function compareNumericKeyed(kind, leftRecord, rightRecord, relTol, absTol, mismatches) {
    const keys = new Set([...collectKeys(leftRecord), ...collectKeys(rightRecord)]);
    for (const key of keys) {
        const left = readKeyedValue(leftRecord, key);
        const right = readKeyedValue(rightRecord, key);
        if (!left.present || !right.present) {
            pushMismatch(mismatches, `${kind}.${key}`, left.present ? left.value : undefined, right.present ? right.value : undefined);
            continue;
        }
        if (numericMismatch(left.value, right.value, relTol, absTol)) {
            pushMismatch(mismatches, `${kind}.${key}`, left.value, right.value);
        }
    }
}

function compareTerminalVoltages(leftRecord, rightRecord, relTol, absTol, mismatches) {
    const keys = new Set([...collectKeys(leftRecord), ...collectKeys(rightRecord)]);
    for (const key of keys) {
        const left = readKeyedValue(leftRecord, key);
        const right = readKeyedValue(rightRecord, key);
        const leftList = Array.isArray(left.value) ? left.value : null;
        const rightList = Array.isArray(right.value) ? right.value : null;
        if (!left.present || !right.present || !leftList || !rightList) {
            pushMismatch(mismatches, `terminalVoltages.${key}`, left.present ? left.value : undefined, right.present ? right.value : undefined);
            continue;
        }
        if (leftList.length !== rightList.length) {
            pushMismatch(mismatches, `terminalVoltages.${key}.length`, leftList.length, rightList.length);
            continue;
        }
        for (let index = 0; index < leftList.length; index += 1) {
            const leftValue = leftList[index];
            const rightValue = rightList[index];
            const leftPresent = leftValue !== undefined && leftValue !== null;
            const rightPresent = rightValue !== undefined && rightValue !== null;
            if (!leftPresent && !rightPresent) continue;
            if (!leftPresent || !rightPresent || numericMismatch(leftValue, rightValue, relTol, absTol)) {
                pushMismatch(mismatches, `terminalVoltages.${key}.${index}`, leftValue, rightValue);
            }
        }
    }
}

export function compareSolveSnapshots(left = {}, right = {}, options = {}) {
    const relTol = Number.isFinite(Number(options.relTol)) ? Number(options.relTol) : SHADOW_REL_TOL;
    const absTol = Number.isFinite(Number(options.absTol)) ? Number(options.absTol) : SHADOW_ABS_TOL;
    const mismatches = [];
    compareNumericKeyed('currents', left.currents, right.currents, relTol, absTol, mismatches);
    compareTerminalVoltages(left.terminalVoltages, right.terminalVoltages, relTol, absTol, mismatches);
    return {
        mismatchCount: mismatches.length,
        mismatches
    };
}
