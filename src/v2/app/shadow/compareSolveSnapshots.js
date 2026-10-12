export const SHADOW_REL_TOL = 1e-3;
export const SHADOW_ABS_TOL = 1e-6;
export const SHADOW_SAMPLE_EVERY_N = 5;

function numericMismatch(left, right) {
    if (!Number.isFinite(left) || !Number.isFinite(right)) return true;
    const absolute = Math.abs(left - right);
    const scale = Math.max(Math.abs(left), Math.abs(right));
    const relative = scale === 0 ? 0 : absolute / scale;
    return relative > SHADOW_REL_TOL && absolute > SHADOW_ABS_TOL;
}

function asPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value;
}

function compareTerminalVoltages(leftRecord, rightRecord, mismatches) {
    const keys = new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)]);
    for (const key of keys) {
        const leftPresent = Object.prototype.hasOwnProperty.call(leftRecord, key);
        const rightPresent = Object.prototype.hasOwnProperty.call(rightRecord, key);
        const leftList = leftPresent && Array.isArray(leftRecord[key]) ? leftRecord[key] : null;
        const rightList = rightPresent && Array.isArray(rightRecord[key]) ? rightRecord[key] : null;
        if (!leftPresent || !rightPresent || !leftList || !rightList) {
            mismatches.push({
                path: `terminalVoltages.${key}`,
                left: leftPresent ? leftRecord[key] : undefined,
                right: rightPresent ? rightRecord[key] : undefined
            });
            continue;
        }
        if (leftList.length !== rightList.length) {
            mismatches.push({
                path: `terminalVoltages.${key}.length`,
                left: leftList.length,
                right: rightList.length
            });
            continue;
        }
        for (let index = 0; index < leftList.length; index += 1) {
            const leftValue = leftList[index];
            const rightValue = rightList[index];
            const leftHas = leftValue !== undefined && leftValue !== null;
            const rightHas = rightValue !== undefined && rightValue !== null;
            if (!leftHas && !rightHas) continue;
            if (!leftHas || !rightHas || numericMismatch(leftValue, rightValue)) {
                mismatches.push({
                    path: `terminalVoltages.${key}.${index}`,
                    left: leftValue,
                    right: rightValue
                });
            }
        }
    }
}

export function compareSolveSnapshots(left = {}, right = {}) {
    const mismatches = [];
    const leftCurrents = asPlainObject(left.currents);
    const rightCurrents = asPlainObject(right.currents);
    const currentKeys = new Set([...Object.keys(leftCurrents), ...Object.keys(rightCurrents)]);
    for (const key of currentKeys) {
        const leftPresent = Object.prototype.hasOwnProperty.call(leftCurrents, key);
        const rightPresent = Object.prototype.hasOwnProperty.call(rightCurrents, key);
        if (!leftPresent || !rightPresent) {
            mismatches.push({
                path: `currents.${key}`,
                left: leftPresent ? leftCurrents[key] : undefined,
                right: rightPresent ? rightCurrents[key] : undefined
            });
            continue;
        }
        if (numericMismatch(leftCurrents[key], rightCurrents[key])) {
            mismatches.push({
                path: `currents.${key}`,
                left: leftCurrents[key],
                right: rightCurrents[key]
            });
        }
    }
    compareTerminalVoltages(
        asPlainObject(left.terminalVoltages),
        asPlainObject(right.terminalVoltages),
        mismatches
    );
    return {
        mismatchCount: mismatches.length,
        mismatches
    };
}
