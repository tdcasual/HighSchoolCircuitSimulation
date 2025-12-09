/**
 * Basic circuit JSON validation helper.
 * Throws informative errors when structure is invalid.
 * Used by AI image→JSON pipeline to guard against malformed output.
 */
export function validateCircuitJSON(data) {
    if (!data || typeof data !== 'object') {
        throw new Error('返回结果不是对象');
    }
    if (!Array.isArray(data.components) || data.components.length === 0) {
        throw new Error('组件列表缺失或为空');
    }
    if (!Array.isArray(data.wires) || data.wires.length === 0) {
        throw new Error('导线列表缺失或为空');
    }

    for (const comp of data.components) {
        if (!comp.id || !comp.type) {
            throw new Error(`组件缺少 id/type: ${JSON.stringify(comp)}`);
        }
        if (!comp.label) {
            // 不强制报错，但推荐有 label；可后续自动填充
        }
    }

    for (const wire of data.wires) {
        if (!wire.start || !wire.end) {
            throw new Error(`导线缺少端点: ${JSON.stringify(wire)}`);
        }
        if (wire.start.componentId === undefined || wire.end.componentId === undefined) {
            throw new Error(`导线端点缺少 componentId: ${JSON.stringify(wire)}`);
        }
        if (wire.start.terminalIndex === undefined || wire.end.terminalIndex === undefined) {
            throw new Error(`导线端点缺少 terminalIndex: ${JSON.stringify(wire)}`);
        }
        const ti = [wire.start.terminalIndex, wire.end.terminalIndex];
        ti.forEach((idx) => {
            if (!Number.isInteger(idx) || idx < 0 || idx > 2) {
                throw new Error(`terminalIndex 非法: ${idx}`);
            }
        });
    }

    return true;
}
