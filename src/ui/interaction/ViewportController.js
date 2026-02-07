export function screenToCanvas(clientX, clientY) {
    const rect = this.svg.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;

    // 应用逆变换：先减去平移，再除以缩放
    const canvasX = (screenX - this.viewOffset.x) / this.scale;
    const canvasY = (screenY - this.viewOffset.y) / this.scale;

    return { x: canvasX, y: canvasY };
}

export function startPanning(e) {
    this.isPanning = true;
    this.panStart = {
        x: e.clientX - this.viewOffset.x,
        y: e.clientY - this.viewOffset.y
    };
    this.svg.style.cursor = 'grabbing';
}

export function updateViewTransform() {
    this.svg.querySelector('#layer-grid')?.parentElement;
    // 应用变换到所有图层的父容器，或者直接应用到各图层
    const layers = ['#layer-grid', '#layer-wires', '#layer-components', '#layer-ui'];
    layers.forEach(selector => {
        const layer = this.svg.querySelector(selector);
        if (layer) {
            layer.setAttribute('transform',
                `translate(${this.viewOffset.x}, ${this.viewOffset.y}) scale(${this.scale})`
            );
        }
    });

    // 更新对齐辅助线组的变换
    const guidesGroup = this.svg.querySelector('#alignment-guides');
    if (guidesGroup) {
        guidesGroup.setAttribute('transform',
            `translate(${this.viewOffset.x}, ${this.viewOffset.y}) scale(${this.scale})`
        );
    }

    // 更新缩放百分比显示
    const zoomLevel = document.getElementById('zoom-level');
    if (zoomLevel) {
        zoomLevel.textContent = `${Math.round(this.scale * 100)}%`;
    }
}

export function resetView() {
    this.scale = 1;
    // Center the current circuit content in the viewport for a nicer reset.
    const bounds = this.getCircuitBounds();
    if (bounds) {
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;
        const rect = this.svg.getBoundingClientRect();
        const screenCenterX = rect.width / 2;
        const screenCenterY = rect.height / 2;
        this.viewOffset = {
            x: screenCenterX - centerX * this.scale,
            y: screenCenterY - centerY * this.scale
        };
    } else {
        this.viewOffset = { x: 0, y: 0 };
    }
    this.updateViewTransform();
    this.updateStatus('视图已重置');
}

/**
 * 计算当前电路在“画布坐标系”中的包围盒，用于居中/适配视图。
 * @returns {{minX:number,minY:number,maxX:number,maxY:number}|null}
 */
export function getCircuitBounds() {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const expand = (x, y) => {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
    };

    for (const comp of this.circuit.getAllComponents()) {
        if (!comp) continue;
        expand(comp.x || 0, comp.y || 0);
    }

    for (const wire of this.circuit.getAllWires()) {
        if (!wire) continue;
        if (wire.a) expand(wire.a.x, wire.a.y);
        if (wire.b) expand(wire.b.x, wire.b.y);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
        return null;
    }

    // Add a bit of padding so we don't center too tightly.
    const pad = 80;
    return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
}

export function onWheel(e) {
    e.preventDefault();

    const rect = this.svg.getBoundingClientRect();
    // 鼠标在SVG中的位置
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // 统一 deltaY 的量级（trackpad/pinch 与滚轮差异很大）
    let deltaY = Number(e.deltaY) || 0;
    if (e.deltaMode === 1) deltaY *= 16;     // lines -> px
    if (e.deltaMode === 2) deltaY *= 800;    // pages -> px (rough)
    // pinch gesture in Chromium often sets ctrlKey=true; reduce sensitivity to avoid huge jumps
    if (e.ctrlKey) deltaY *= 0.25;

    const minScale = 0.1;
    const maxScale = 4;
    const zoomIntensity = 0.0015; // smaller = less sensitive

    // Exponential mapping feels smooth and consistent across devices.
    const zoomFactor = Math.exp(-deltaY * zoomIntensity);
    const newScale = Math.min(Math.max(this.scale * zoomFactor, minScale), maxScale);

    if (Math.abs(newScale - this.scale) < 1e-9) return;

    // 计算缩放前鼠标位置对应的画布坐标
    const canvasX = (mouseX - this.viewOffset.x) / this.scale;
    const canvasY = (mouseY - this.viewOffset.y) / this.scale;

    // 更新缩放
    this.scale = newScale;

    // 调整偏移，使鼠标位置保持不变
    this.viewOffset.x = mouseX - canvasX * this.scale;
    this.viewOffset.y = mouseY - canvasY * this.scale;

    this.updateViewTransform();
}
