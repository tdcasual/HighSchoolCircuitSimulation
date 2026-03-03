export function updateTextIfChanged(element, nextText) {
    if (!element) return false;
    const normalizedText = nextText ?? '';
    if ((element.textContent || '') === normalizedText) return false;
    element.textContent = normalizedText;
    return true;
}

export function updateAttributeIfChanged(element, name, value) {
    if (!element) return false;
    const normalizedValue = value == null ? '' : String(value);
    let currentValue = null;
    try {
        currentValue = typeof element.getAttribute === 'function'
            ? element.getAttribute(name)
            : null;
    } catch (_) {
        currentValue = null;
    }
    if (currentValue === normalizedValue) return false;
    if (typeof element.setAttribute !== 'function') return false;
    try {
        element.setAttribute(name, normalizedValue);
        return true;
    } catch (_) {
        return false;
    }
}

export function updateTextAndStyle(element, text, fontSize = null, fontWeight = null) {
    let changed = updateTextIfChanged(element, text);
    if (fontSize !== null) {
        changed = updateAttributeIfChanged(element, 'font-size', fontSize) || changed;
    }
    if (fontWeight !== null) {
        changed = updateAttributeIfChanged(element, 'font-weight', fontWeight) || changed;
    }
    return changed;
}

export function computeDisplayRowGap(visibleDisplays) {
    if (!Array.isArray(visibleDisplays) || visibleDisplays.length === 0) {
        return 15;
    }
    const maxFontSize = visibleDisplays.reduce((maxSize, display) => {
        const fontSizeAttr = parseFloat(display.getAttribute('font-size') || '13');
        if (!Number.isFinite(fontSizeAttr)) {
            return maxSize;
        }
        return Math.max(maxSize, fontSizeAttr);
    }, 13);
    return Math.max(12, Math.round(maxFontSize + 2));
}
