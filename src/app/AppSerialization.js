function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function safeInvokeMethod(target, methodName, ...args) {
    const fn = target?.[methodName];
    if (typeof fn !== 'function') return undefined;
    try {
        return fn.apply(target, args);
    } catch (_) {
        return undefined;
    }
}

export function buildAppSaveData({
    circuit = null,
    exerciseBoard = null,
    observationPanel = null
} = {}) {
    const serialized = safeInvokeMethod(circuit, 'toJSON');
    const data = isPlainObject(serialized)
        ? serialized
        : {
            components: [],
            wires: []
        };

    data.meta = isPlainObject(data.meta) ? data.meta : {};

    const exerciseBoardData = safeInvokeMethod(exerciseBoard, 'toJSON');
    if (exerciseBoardData !== undefined) {
        data.meta.exerciseBoard = exerciseBoardData;
    }

    const observationData = safeInvokeMethod(observationPanel, 'toJSON');
    if (observationData !== undefined) {
        data.meta.observation = observationData;
    }

    return data;
}

export function restoreAppMetaFromSaveData({
    exerciseBoard = null,
    observationPanel = null,
    data = null
} = {}) {
    const meta = isPlainObject(data?.meta) ? data.meta : {};
    safeInvokeMethod(exerciseBoard, 'fromJSON', meta.exerciseBoard);
    safeInvokeMethod(observationPanel, 'fromJSON', meta.observation);
}
