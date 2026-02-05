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

    const requirePoint = (pt, label) => {
        if (!pt || typeof pt !== 'object') {
            throw new Error(`${label} 不是坐标点: ${JSON.stringify(pt)}`);
        }
        const x = Number(pt.x);
        const y = Number(pt.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            throw new Error(`${label} 坐标非法: ${JSON.stringify(pt)}`);
        }
        return true;
    };

    const requireTerminalRef = (ref, label) => {
        if (!ref) return true;
        if (ref.componentId === undefined || ref.componentId === null) {
            throw new Error(`${label} 缺少 componentId: ${JSON.stringify(ref)}`);
        }
        if (ref.terminalIndex === undefined || ref.terminalIndex === null) {
            throw new Error(`${label} 缺少 terminalIndex: ${JSON.stringify(ref)}`);
        }
        const idx = Number(ref.terminalIndex);
        if (!Number.isInteger(idx) || idx < 0 || idx > 2) {
            throw new Error(`${label}.terminalIndex 非法: ${ref.terminalIndex}`);
        }
        return true;
    };

    for (const comp of data.components) {
        if (!comp.id || !comp.type) {
            throw new Error(`组件缺少 id/type: ${JSON.stringify(comp)}`);
        }
        if (!comp.label) {
            // 不强制报错，但推荐有 label；可后续自动填充
        }
    }

    for (const wire of data.wires) {
        // v2: explicit endpoints (canvas-space points)
        if (wire.a && wire.b) {
            requirePoint(wire.a, 'wire.a');
            requirePoint(wire.b, 'wire.b');
            requireTerminalRef(wire.aRef, 'wire.aRef');
            requireTerminalRef(wire.bRef, 'wire.bRef');
            continue;
        }

        // legacy: terminal references
        const start = wire.start || (wire.startComponentId != null
            ? { componentId: wire.startComponentId, terminalIndex: wire.startTerminalIndex }
            : null);
        const end = wire.end || (wire.endComponentId != null
            ? { componentId: wire.endComponentId, terminalIndex: wire.endTerminalIndex }
            : null);

        if (!start || !end) {
            throw new Error(`导线缺少端点: ${JSON.stringify(wire)}`);
        }
        if (start.componentId === undefined || end.componentId === undefined) {
            throw new Error(`导线端点缺少 componentId: ${JSON.stringify(wire)}`);
        }
        if (start.terminalIndex === undefined || end.terminalIndex === undefined) {
            throw new Error(`导线端点缺少 terminalIndex: ${JSON.stringify(wire)}`);
        }
        const ti = [start.terminalIndex, end.terminalIndex];
        ti.forEach((idx) => {
            if (!Number.isInteger(idx) || idx < 0 || idx > 2) {
                throw new Error(`terminalIndex 非法: ${idx}`);
            }
        });
    }

    return true;
}
