export function isObservationTabActive() {
    const observationPage = document.getElementById('panel-observation');
    return !!(observationPage && observationPage.classList.contains('active'));
}

export function hideDialog() {
    document.getElementById('dialog-overlay').classList.add('hidden');
    this.editingComponent = null;
}

export function safeParseFloat(value, defaultValue, minValue = null, maxValue = null) {
    let result = parseFloat(value);
    if (!Number.isFinite(result)) {
        result = defaultValue;
    }
    if (minValue !== null && result < minValue) {
        result = minValue;
    }
    if (maxValue !== null && result > maxValue) {
        result = maxValue;
    }
    return result;
}

export function getBlackBoxContainedComponentIds(boxComp, options = {}) {
    if (!boxComp || boxComp.type !== 'BlackBox') return [];
    const includeBoxes = !!options.includeBoxes;
    const w = Math.max(80, boxComp.boxWidth || 180);
    const h = Math.max(60, boxComp.boxHeight || 110);
    const left = (boxComp.x || 0) - w / 2;
    const right = (boxComp.x || 0) + w / 2;
    const top = (boxComp.y || 0) - h / 2;
    const bottom = (boxComp.y || 0) + h / 2;

    const ids = [];
    for (const [id, comp] of this.circuit.components) {
        if (!comp || id === boxComp.id) continue;
        if (!includeBoxes && comp.type === 'BlackBox') continue;
        const x = comp.x || 0;
        const y = comp.y || 0;
        if (x >= left && x <= right && y >= top && y <= bottom) {
            ids.push(id);
        }
    }
    return ids;
}

export function updateStatus(text) {
    document.getElementById('status-text').textContent = text;
}
