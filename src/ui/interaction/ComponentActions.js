import { createComponent, ComponentNames } from '../../components/Component.js';
import { toCanvasInt } from '../../utils/CanvasCoords.js';

export function addComponent(type, x, y) {
    console.log('Adding component:', type, 'at', x, y);
    try {
        this.runWithHistory(`添加${ComponentNames[type] || type}`, () => {
            const comp = createComponent(type, toCanvasInt(x), toCanvasInt(y));
            console.log('Created component:', comp);
            this.circuit.addComponent(comp);
            const svgElement = this.renderer.addComponent(comp);
            console.log('Rendered SVG element:', svgElement);
            this.selectComponent(comp.id);
            this.app.observationPanel?.refreshComponentOptions();
            this.app.observationPanel?.refreshDialGauges();
            this.updateStatus(`已添加 ${ComponentNames[type]}`);
        });
    } catch (error) {
        console.error('Error adding component:', error);
        this.updateStatus(`添加失败: ${error.message}`);
    }
}

export function deleteComponent(id) {
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
}

export function deleteWire(id) {
    this.runWithHistory('删除导线', () => {
        this.circuit.removeWire(id);
        this.renderer.removeWire(id);
        this.clearSelection();
        this.app.observationPanel?.refreshComponentOptions();
        this.updateStatus('已删除导线');
    });
}

export function rotateComponent(id) {
    const comp = this.circuit.getComponent(id);
    if (comp) {
        this.runWithHistory('旋转元器件', () => {
            comp.rotation = ((comp.rotation || 0) + 90) % 360;
            this.renderer.refreshComponent(comp);
            this.renderer.updateConnectedWires(id);
            this.renderer.setSelected(id, true);
            this.circuit.rebuildNodes();
        });
    }
}

export function toggleSwitch(id) {
    const comp = this.circuit.getComponent(id);
    if (comp && (comp.type === 'Switch' || comp.type === 'SPDTSwitch')) {
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
                this.updateStatus(`开关已${comp.closed ? '闭合' : '断开'}`);
            } else {
                this.updateStatus(`单刀双掷开关已切换到 ${comp.position === 'b' ? '下掷' : '上掷'}`);
            }
        });
    }
}
