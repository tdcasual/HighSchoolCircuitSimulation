import { ComponentDefaults, getComponentTerminalCount } from '../../components/Component.js';

const SUPPORTED_COMPONENT_TYPES = new Set(Object.keys(ComponentDefaults));
const POWER_COMPONENT_TYPES = new Set(['PowerSource', 'ACVoltageSource']);

export class CircuitSchemaGateway {
    static validate(data) {
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

        const componentsById = new Map();
        let hasPowerSource = false;

        const requireTerminalRef = (ref, label) => {
            if (!ref) return true;
            if (ref.componentId === undefined || ref.componentId === null) {
                throw new Error(`${label} 缺少 componentId: ${JSON.stringify(ref)}`);
            }
            if (ref.terminalIndex === undefined || ref.terminalIndex === null) {
                throw new Error(`${label} 缺少 terminalIndex: ${JSON.stringify(ref)}`);
            }
            const componentId = String(ref.componentId);
            const boundComponent = componentsById.get(componentId);
            if (!boundComponent) {
                throw new Error(`${label}.componentId 不存在: ${componentId}`);
            }
            const idx = Number(ref.terminalIndex);
            if (!Number.isInteger(idx) || idx < 0) {
                throw new Error(`${label}.terminalIndex 非法: ${ref.terminalIndex}`);
            }
            const terminalCount = getComponentTerminalCount(boundComponent.type);
            if (idx >= terminalCount) {
                throw new Error(`${label}.terminalIndex 超出范围: ${ref.terminalIndex}`);
            }
            return true;
        };

        for (const comp of data.components) {
            if (!comp.id || !comp.type) {
                throw new Error(`组件缺少 id/type: ${JSON.stringify(comp)}`);
            }
            const type = String(comp.type);
            if (!SUPPORTED_COMPONENT_TYPES.has(type)) {
                throw new Error(`不支持的元器件类型: ${type}`);
            }
            const id = String(comp.id);
            if (componentsById.has(id)) {
                throw new Error(`组件 id 重复: ${id}`);
            }
            componentsById.set(id, { ...comp, type });
            if (POWER_COMPONENT_TYPES.has(type)) {
                hasPowerSource = true;
            }
        }

        if (!hasPowerSource) {
            throw new Error('至少需要一个电源元件（PowerSource 或 ACVoltageSource）');
        }

        for (const wire of data.wires) {
            if (!wire.a || !wire.b) {
                throw new Error(`导线必须使用 a/b 端点坐标: ${JSON.stringify(wire)}`);
            }
            requirePoint(wire.a, 'wire.a');
            requirePoint(wire.b, 'wire.b');
            if (Number(wire.a.x) === Number(wire.b.x) && Number(wire.a.y) === Number(wire.b.y)) {
                throw new Error(`导线起点与终点重合: ${JSON.stringify(wire)}`);
            }
            requireTerminalRef(wire.aRef, 'wire.aRef');
            requireTerminalRef(wire.bRef, 'wire.bRef');
        }

        return true;
    }
}
