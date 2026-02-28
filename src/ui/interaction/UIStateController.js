export const FIRST_RUN_GUIDE_DISMISSED_STORAGE_KEY = 'ui.first_run_guide_dismissed';

function resolveStorage(storage) {
    if (storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function') {
        return storage;
    }
    if (typeof localStorage !== 'undefined') {
        return localStorage;
    }
    return null;
}

export function isObservationTabActive() {
    const observationPage = document.getElementById('panel-observation');
    return !!(observationPage && observationPage.classList.contains('active'));
}

export function isFirstRunGuideDismissed(options = {}) {
    const key = String(options.key || FIRST_RUN_GUIDE_DISMISSED_STORAGE_KEY);
    const storage = resolveStorage(options.storage);
    if (!storage) return false;
    try {
        const raw = String(storage.getItem(key) || '').trim().toLowerCase();
        return raw === '1' || raw === 'true' || raw === 'yes';
    } catch (_) {
        return false;
    }
}

export function setFirstRunGuideDismissed(dismissed, options = {}) {
    const key = String(options.key || FIRST_RUN_GUIDE_DISMISSED_STORAGE_KEY);
    const storage = resolveStorage(options.storage);
    if (!storage) return false;
    try {
        storage.setItem(key, dismissed ? '1' : '0');
        return true;
    } catch (_) {
        return false;
    }
}

export function shouldShowFirstRunGuide(options = {}) {
    const enabled = options.enabled !== false;
    if (!enabled) return false;
    return !isFirstRunGuideDismissed(options);
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
