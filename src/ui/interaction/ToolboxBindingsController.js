import { GRID_SIZE, snapToGrid } from '../../utils/CanvasCoords.js';

const VALID_TOOL_TYPES = Object.freeze([
    'Ground',
    'PowerSource',
    'ACVoltageSource',
    'Resistor',
    'Diode',
    'LED',
    'Thermistor',
    'Photoresistor',
    'Rheostat',
    'Bulb',
    'Capacitor',
    'Inductor',
    'ParallelPlateCapacitor',
    'Motor',
    'Switch',
    'SPDTSwitch',
    'Relay',
    'Fuse',
    'Ammeter',
    'Voltmeter',
    'BlackBox',
    'Wire'
]);

function logDebug(context, ...args) {
    if (context?.logger && typeof context.logger.debug === 'function') {
        context.logger.debug(...args);
    }
}

function logWarn(context, ...args) {
    if (context?.logger && typeof context.logger.warn === 'function') {
        context.logger.warn(...args);
    }
}

function safeInvokeMethod(target, methodName, ...args) {
    const fn = target?.[methodName];
    if (typeof fn !== 'function') return undefined;
    try {
        return fn.apply(target, args);
    } catch (_) {
        return undefined;
    }
}

function safeAddClass(node, className) {
    safeInvokeMethod(node?.classList, 'add', className);
}

function safeRemoveClass(node, className) {
    safeInvokeMethod(node?.classList, 'remove', className);
}

/**
 * 工具箱拖放事件
 */
export function bindToolboxEvents() {
    const toolItems = document.querySelectorAll('.tool-item');

    // 标记是否正在从工具箱拖放
    this.isToolboxDrag = false;

    toolItems.forEach((item) => {
        // 开始拖动
        safeInvokeMethod(item, 'addEventListener', 'dragstart', (e) => {
            const type = item.dataset.type;
            if (!type || !VALID_TOOL_TYPES.includes(type)) {
                logWarn(this, 'Invalid component type:', type);
                e.preventDefault();
                return;
            }
            // 使用特定的 MIME 类型避免与其他拖放混淆
            e.dataTransfer.setData('application/x-circuit-component', type);
            e.dataTransfer.effectAllowed = 'copy';
            safeAddClass(item, 'dragging');
            this.isToolboxDrag = true;
            logDebug(this, 'Toolbox drag started:', type);
        });

        // 结束拖动
        safeInvokeMethod(item, 'addEventListener', 'dragend', () => {
            safeRemoveClass(item, 'dragging');
            this.isToolboxDrag = false;
        });

        // 触屏/笔记本平板模式：点击工具后在画布点击放置
        safeInvokeMethod(item, 'addEventListener', 'click', (e) => {
            const type = item.dataset.type;
            if (!type || !VALID_TOOL_TYPES.includes(type)) return;
            e.preventDefault();
            e.stopPropagation();
            this.setPendingToolType(type, item);
        });
    });

    // 只绑定到 SVG 画布，不绑定到 container（避免双重触发）
    const handleDragOver = (e) => {
        // 只接受工具箱的拖放
        if (e.dataTransfer.types.includes('application/x-circuit-component')) {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'copy';
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();

        // 如果正在拖动画布上的元器件，不创建新元器件
        if (this.isDraggingComponent) {
            logDebug(this, 'Ignoring drop: dragging existing component');
            return;
        }

        // 只接受工具箱的拖放
        const type = e.dataTransfer.getData('application/x-circuit-component');
        logDebug(this, 'Drop event, type:', type);

        // 验证类型
        if (!type || !VALID_TOOL_TYPES.includes(type)) {
            logWarn(this, 'Invalid component type, ignoring drop:', type);
            return;
        }

        // 计算相对于SVG的位置（考虑缩放和平移）
        const rect = safeInvokeMethod(this.svg, 'getBoundingClientRect') || {};
        const left = Number.isFinite(rect?.left) ? rect.left : 0;
        const top = Number.isFinite(rect?.top) ? rect.top : 0;
        const screenX = e.clientX - left;
        const screenY = e.clientY - top;
        // 转换为画布坐标
        const canvasX = (screenX - this.viewOffset.x) / this.scale;
        const canvasY = (screenY - this.viewOffset.y) / this.scale;
        const x = snapToGrid(canvasX, GRID_SIZE);
        const y = snapToGrid(canvasY, GRID_SIZE);

        if (type === 'Wire') {
            if (typeof this.addWireAt === 'function') {
                this.addWireAt(x, y);
            } else {
                logWarn(this, 'Missing addWireAt delegate, skipping wire drop');
            }
        } else {
            this.addComponent(type, x, y);
        }
        this.clearPendingToolType({ silent: true });
    };

    // 只绑定到 SVG 元素
    safeInvokeMethod(this.svg, 'addEventListener', 'dragover', handleDragOver);
    safeInvokeMethod(this.svg, 'addEventListener', 'drop', handleDrop);
}
