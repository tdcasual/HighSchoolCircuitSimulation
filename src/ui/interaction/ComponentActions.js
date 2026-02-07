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
