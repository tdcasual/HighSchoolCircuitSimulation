import { normalizeCanvasPoint, toCanvasInt } from '../../utils/CanvasCoords.js';

function isOrthogonalWire(wire) {
    if (!wire || !wire.a || !wire.b) return false;
    const a = normalizeCanvasPoint(wire.a);
    const b = normalizeCanvasPoint(wire.b);
    if (!a || !b) return false;
    return a.x === b.x || a.y === b.y;
}

export function showContextMenu(e, componentId) {
    this.hideContextMenu();

    const menu = document.createElement('div');
    menu.id = 'context-menu';
    menu.className = 'context-menu';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';

    const comp = this.circuit.getComponent(componentId);
    const menuItems = [
        { label: '编辑属性', action: () => this.showPropertyDialog(componentId) },
        { label: '旋转 (R)', action: () => this.rotateComponent(componentId) },
        { label: '复制', action: () => this.duplicateComponent(componentId) },
        { label: '删除 (Del)', action: () => this.deleteComponent(componentId), className: 'danger' }
    ];

    // 仪表：自主读数（右侧指针表盘）
    if (comp && (comp.type === 'Ammeter' || comp.type === 'Voltmeter')) {
        const enabled = !!comp.selfReading;
        menuItems.splice(1, 0, {
            label: enabled ? '关闭自主读数（右侧表盘）' : '开启自主读数（右侧表盘）',
            action: () => {
                this.runWithHistory('切换自主读数', () => {
                    comp.selfReading = !enabled;
                    this.app.observationPanel?.refreshDialGauges();
                    this.app.updateStatus(comp.selfReading ? '已开启自主读数：请在右侧“观察”查看表盘' : '已关闭自主读数');
                });
            }
        });
    }

    // 黑箱：快速切换显示模式
    if (comp && comp.type === 'BlackBox') {
        const isOpaque = comp.viewMode === 'opaque';
        menuItems.splice(1, 0, {
            label: isOpaque ? '设为透明（显示内部）' : '设为隐藏（黑箱）',
            action: () => {
                this.runWithHistory('切换黑箱显示模式', () => {
                    comp.viewMode = isOpaque ? 'transparent' : 'opaque';
                    this.renderer.render();
                    this.selectComponent(comp.id);
                    this.app.updateStatus(comp.viewMode === 'opaque' ? '黑箱已设为隐藏模式' : '黑箱已设为透明模式');
                });
            }
        });
    }

    menuItems.forEach((item) => {
        const menuItem = document.createElement('div');
        menuItem.className = 'context-menu-item' + (item.className ? ' ' + item.className : '');
        menuItem.textContent = item.label;
        menuItem.addEventListener('click', () => {
            item.action();
            this.hideContextMenu();
        });
        menu.appendChild(menuItem);
    });

    document.body.appendChild(menu);

    // 点击其他地方关闭菜单
    setTimeout(() => {
        document.addEventListener('click', this.hideContextMenuHandler);
    }, 0);
}

export function showWireContextMenu(e, wireId) {
    this.hideContextMenu();

    const menu = document.createElement('div');
    menu.id = 'context-menu';
    menu.className = 'context-menu';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';

    const wire = this.circuit.getWire(wireId);
    const canvas = this.screenToCanvas(e.clientX, e.clientY);

    // Decide which endpoint to keep fixed for "straighten" actions based on click proximity.
    let anchorEnd = 'a';
    if (wire && wire.a && wire.b) {
        const dA = Math.hypot(canvas.x - wire.a.x, canvas.y - wire.a.y);
        const dB = Math.hypot(canvas.x - wire.b.x, canvas.y - wire.b.y);
        anchorEnd = dA <= dB ? 'a' : 'b';
    }

    const straightenWire = (mode) => {
        this.runWithHistory(mode === 'horizontal' ? '导线水平拉直' : '导线垂直拉直', () => {
            const w = this.circuit.getWire(wireId);
            if (!w || !w.a || !w.b) return;
            const fixed = anchorEnd === 'a' ? w.a : w.b;
            const moveEnd = anchorEnd === 'a' ? 'b' : 'a';
            const moving = w[moveEnd];
            if (!moving) return;

            if (mode === 'horizontal') {
                w[moveEnd] = { x: toCanvasInt(moving.x), y: toCanvasInt(fixed.y) };
            } else if (mode === 'vertical') {
                w[moveEnd] = { x: toCanvasInt(fixed.x), y: toCanvasInt(moving.y) };
            }

            // Moving an endpoint manually detaches it from any terminal binding.
            const refKey = moveEnd === 'a' ? 'aRef' : 'bRef';
            delete w[refKey];

            this.renderer.refreshWire(wireId);
            this.circuit.rebuildNodes();
            this.updateStatus(mode === 'horizontal' ? '已水平拉直导线' : '已垂直拉直导线');
        });
    };

    const menuItems = [];
    if (isOrthogonalWire(wire)) {
        menuItems.push({ label: '在此处分割', action: () => this.splitWireAtPoint(wireId, canvas.x, canvas.y) });
    }
    if (wire) {
        menuItems.push(
            { label: '添加节点电压探针', action: () => this.addObservationProbeForWire(wireId, 'NodeVoltageProbe') },
            { label: '添加支路电流探针', action: () => this.addObservationProbeForWire(wireId, 'WireCurrentProbe') }
        );
    }
    menuItems.push(
        { label: '拉直为水平', action: () => straightenWire('horizontal') },
        { label: '拉直为垂直', action: () => straightenWire('vertical') },
        { label: '删除导线 (Del)', action: () => this.deleteWire(wireId), className: 'danger' }
    );

    menuItems.forEach((item) => {
        const menuItem = document.createElement('div');
        menuItem.className = 'context-menu-item' + (item.className ? ' ' + item.className : '');
        menuItem.textContent = item.label;
        menuItem.addEventListener('click', () => {
            item.action();
            this.hideContextMenu();
        });
        menu.appendChild(menuItem);
    });

    document.body.appendChild(menu);

    setTimeout(() => {
        document.addEventListener('click', this.hideContextMenuHandler);
    }, 0);
}

export function hideContextMenu() {
    const menu = document.getElementById('context-menu');
    if (menu) {
        menu.remove();
        document.removeEventListener('click', this.hideContextMenuHandler);
    }
}

export function showProbeContextMenu(e, probeId, wireId) {
    this.hideContextMenu();
    const probe = this.circuit.getObservationProbe(probeId);
    if (!probe) return;

    const menu = document.createElement('div');
    menu.id = 'context-menu';
    menu.className = 'context-menu';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';

    const menuItems = [
        { label: '重命名探针', action: () => this.renameObservationProbe(probeId) },
        { label: '加入观察图像', action: () => this.addProbePlot(probeId) },
        { label: '删除探针', action: () => this.deleteObservationProbe(probeId), className: 'danger' }
    ];
    if (wireId && wireId !== this.selectedWire) {
        menuItems.unshift({ label: '选中所属导线', action: () => this.selectWire(wireId) });
    }

    menuItems.forEach((item) => {
        const menuItem = document.createElement('div');
        menuItem.className = 'context-menu-item' + (item.className ? ` ${item.className}` : '');
        menuItem.textContent = item.label;
        menuItem.addEventListener('click', () => {
            item.action();
            this.hideContextMenu();
        });
        menu.appendChild(menuItem);
    });

    document.body.appendChild(menu);
    setTimeout(() => {
        document.addEventListener('click', this.hideContextMenuHandler);
    }, 0);
}
