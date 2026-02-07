import { createComponent, ComponentNames } from '../../components/Component.js';
import { toCanvasInt } from '../../utils/CanvasCoords.js';

function createSuccessResult(type, payload = undefined, message = null) {
    const result = { ok: true, type };
    if (payload !== undefined) result.payload = payload;
    if (message) result.message = message;
    return result;
}

function createFailureResult(type, error = null, message = null, payload = undefined, notified = false) {
    const result = { ok: false, type };
    if (payload !== undefined) result.payload = payload;
    if (message) result.message = message;
    if (error) result.error = error;
    if (notified) result.notified = true;
    return result;
}

export function addComponent(type, x, y) {
    console.log('Adding component:', type, 'at', x, y);
    let createdComponent = null;
    try {
        this.runWithHistory(`添加${ComponentNames[type] || type}`, () => {
            const comp = createComponent(type, toCanvasInt(x), toCanvasInt(y));
            createdComponent = comp;
            console.log('Created component:', comp);
            this.circuit.addComponent(comp);
            const svgElement = this.renderer.addComponent(comp);
            console.log('Rendered SVG element:', svgElement);
            this.selectComponent(comp.id);
            this.app.observationPanel?.refreshComponentOptions();
            this.app.observationPanel?.refreshDialGauges();
            this.updateStatus(`已添加 ${ComponentNames[type]}`);
        });
        return createSuccessResult(
            'component.added',
            {
                componentId: createdComponent?.id || null,
                componentType: type
            },
            `已添加 ${ComponentNames[type]}`
        );
    } catch (error) {
        console.error('Error adding component:', error);
        const message = `添加失败: ${error.message}`;
        this.updateStatus(message);
        return createFailureResult('component.add_failed', error, message, undefined, true);
    }
}

export function deleteComponent(id) {
    try {
        this.runWithHistory('删除元器件', () => {
            this.circuit.removeComponent(id);
            this.renderer.removeComponent(id);

            // Model C: wires are independent segments; deleting a component does not delete wires.
            this.renderer.renderWires();
            this.clearSelection();
            this.app.observationPanel?.refreshComponentOptions();
            this.app.observationPanel?.refreshDialGauges();
            this.updateStatus('已删除元器件');
        });
        return createSuccessResult('component.deleted', { componentId: id }, '已删除元器件');
    } catch (error) {
        const message = `删除失败: ${error.message}`;
        this.updateStatus(message);
        return createFailureResult('component.delete_failed', error, message, { componentId: id }, true);
    }
}

export function deleteWire(id) {
    try {
        this.runWithHistory('删除导线', () => {
            this.circuit.removeWire(id);
            this.renderer.removeWire(id);
            this.clearSelection();
            this.app.observationPanel?.refreshComponentOptions();
            this.updateStatus('已删除导线');
        });
        return createSuccessResult('wire.deleted', { wireId: id }, '已删除导线');
    } catch (error) {
        const message = `删除失败: ${error.message}`;
        this.updateStatus(message);
        return createFailureResult('wire.delete_failed', error, message, { wireId: id }, true);
    }
}

export function rotateComponent(id) {
    const comp = this.circuit.getComponent(id);
    if (!comp) {
        return createFailureResult('component.rotate_not_found', null, '未找到元器件', { componentId: id });
    }
    try {
        this.runWithHistory('旋转元器件', () => {
            comp.rotation = ((comp.rotation || 0) + 90) % 360;
            this.renderer.refreshComponent(comp);
            this.renderer.updateConnectedWires(id);
            this.renderer.setSelected(id, true);
            this.circuit.rebuildNodes();
        });
        return createSuccessResult('component.rotated', {
            componentId: id,
            rotation: comp.rotation
        });
    } catch (error) {
        const message = `旋转失败: ${error.message}`;
        this.updateStatus(message);
        return createFailureResult('component.rotate_failed', error, message, { componentId: id }, true);
    }
}

export function toggleSwitch(id) {
    const comp = this.circuit.getComponent(id);
    if (!comp || (comp.type !== 'Switch' && comp.type !== 'SPDTSwitch')) {
        return createFailureResult('switch.toggle_not_supported', null, '当前元器件不支持切换', { componentId: id });
    }
    try {
        let statusMessage = '';
        this.runWithHistory('切换开关', () => {
            if (comp.type === 'Switch') {
                comp.closed = !comp.closed;
            } else {
                comp.position = comp.position === 'b' ? 'a' : 'b';
            }
            this.renderer.refreshComponent(comp);
            this.renderer.setSelected(id, true);
            this.selectComponent(id);
            if (comp.type === 'Switch') {
                statusMessage = `开关已${comp.closed ? '闭合' : '断开'}`;
            } else {
                statusMessage = `单刀双掷开关已切换到 ${comp.position === 'b' ? '下掷' : '上掷'}`;
            }
            this.updateStatus(statusMessage);
        });
        if (comp.type === 'Switch') {
            return createSuccessResult('switch.toggled', {
                componentId: id,
                componentType: comp.type,
                closed: !!comp.closed
            }, statusMessage);
        }
        return createSuccessResult('switch.toggled', {
            componentId: id,
            componentType: comp.type,
            position: comp.position
        }, statusMessage);
    } catch (error) {
        const message = `切换失败: ${error.message}`;
        this.updateStatus(message);
        return createFailureResult('switch.toggle_failed', error, message, { componentId: id }, true);
    }
}

export function duplicateComponent(id) {
    const comp = this.circuit.getComponent(id);
    if (!comp) {
        return createFailureResult('component.duplicate_not_found', null, '未找到元器件', { sourceComponentId: id });
    }

    // 在原位置偏移一点创建新元器件
    const result = this.addComponent(comp.type, comp.x + 40, comp.y + 40);
    if (!result || result.ok !== true) {
        return createFailureResult(
            'component.duplicate_failed',
            result?.error || null,
            result?.message || '复制失败',
            { sourceComponentId: id }
        );
    }
    return createSuccessResult('component.duplicated', {
        sourceComponentId: id,
        componentId: result.payload?.componentId || null
    }, result.message || '已复制元器件');
}
