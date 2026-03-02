function safeInvokeMethod(target, methodName, ...args) {
    const fn = target?.[methodName];
    if (typeof fn !== 'function') return undefined;
    try {
        return fn.apply(target, args);
    } catch (_) {
        return undefined;
    }
}

export function detectAlignment(draggedId, x, y) {
    const result = {
        snapX: null,
        snapY: null,
        guideLines: []
    };

    const threshold = this.snapThreshold;

    // 收集所有其他元器件的位置
    const otherPositions = [];
    for (const [id, comp] of this.circuit.components) {
        if (id !== draggedId) {
            otherPositions.push({ x: comp.x, y: comp.y, id });
        }
    }

    // 检测水平对齐（y相同）
    for (const other of otherPositions) {
        const diffY = Math.abs(y - other.y);
        if (diffY < threshold) {
            result.snapY = other.y;
            result.guideLines.push({
                type: 'horizontal',
                y: other.y,
                x1: Math.min(x, other.x) - 50,
                x2: Math.max(x, other.x) + 50
            });
            break;
        }
    }

    // 检测垂直对齐（x相同）
    for (const other of otherPositions) {
        const diffX = Math.abs(x - other.x);
        if (diffX < threshold) {
            result.snapX = other.x;
            result.guideLines.push({
                type: 'vertical',
                x: other.x,
                y1: Math.min(y, other.y) - 50,
                y2: Math.max(y, other.y) + 50
            });
            break;
        }
    }

    return result;
}

export function showAlignmentGuides(alignment) {
    // 获取或创建辅助线容器
    let guidesGroup = this.svg.querySelector('#alignment-guides');
    if (!guidesGroup) {
        guidesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        guidesGroup.id = 'alignment-guides';
        // 应用与其他图层相同的变换
        safeInvokeMethod(guidesGroup, 'setAttribute', 'transform',
            `translate(${this.viewOffset.x}, ${this.viewOffset.y}) scale(${this.scale})`
        );
        this.svg.appendChild(guidesGroup);
    }

    // 清除旧的辅助线
    guidesGroup.innerHTML = '';

    // 绘制新的辅助线
    for (const guide of alignment.guideLines) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        safeInvokeMethod(line, 'setAttribute', 'class', 'alignment-guide');

        if (guide.type === 'horizontal') {
            safeInvokeMethod(line, 'setAttribute', 'x1', guide.x1);
            safeInvokeMethod(line, 'setAttribute', 'y1', guide.y);
            safeInvokeMethod(line, 'setAttribute', 'x2', guide.x2);
            safeInvokeMethod(line, 'setAttribute', 'y2', guide.y);
        } else {
            safeInvokeMethod(line, 'setAttribute', 'x1', guide.x);
            safeInvokeMethod(line, 'setAttribute', 'y1', guide.y1);
            safeInvokeMethod(line, 'setAttribute', 'x2', guide.x);
            safeInvokeMethod(line, 'setAttribute', 'y2', guide.y2);
        }

        guidesGroup.appendChild(line);
    }
}

export function hideAlignmentGuides() {
    const guidesGroup = this.svg.querySelector('#alignment-guides');
    if (guidesGroup) {
        guidesGroup.innerHTML = '';
    }
}
