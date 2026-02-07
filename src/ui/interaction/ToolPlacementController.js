import { ComponentNames } from '../../components/Component.js';
import { GRID_SIZE, snapToGrid } from '../../utils/CanvasCoords.js';

export function setPendingToolType(type, item = null) {
    if (!type) return;
    if (this.pendingToolType === type) {
        if (type === 'Wire' && this.isWiring) {
            this.cancelWiring();
        }
        this.clearPendingToolType();
        this.updateStatus('已取消工具放置模式');
        return;
    }

    this.pendingToolType = type;
    this.pendingToolItem = item;
    document.querySelectorAll('.tool-item.tool-item-pending').forEach((el) => el.classList.remove('tool-item-pending'));
    if (item) item.classList.add('tool-item-pending');
    this.updateStatus(`已选择 ${ComponentNames[type] || type}，点击画布放置`);
}

export function clearPendingToolType(options = {}) {
    this.pendingToolType = null;
    if (this.pendingToolItem) {
        this.pendingToolItem.classList.remove('tool-item-pending');
        this.pendingToolItem = null;
    }
    if (!options.silent) {
        document.querySelectorAll('.tool-item.tool-item-pending').forEach((el) => el.classList.remove('tool-item-pending'));
    }
}

export function placePendingToolAt(clientX, clientY) {
    if (!this.pendingToolType) return false;
    const canvas = this.screenToCanvas(clientX, clientY);
    const x = snapToGrid(canvas.x, GRID_SIZE);
    const y = snapToGrid(canvas.y, GRID_SIZE);
    if (this.pendingToolType === 'Wire') {
        this.addWireAt(x, y);
    } else {
        this.addComponent(this.pendingToolType, x, y);
    }
    this.clearPendingToolType({ silent: true });
    return true;
}
