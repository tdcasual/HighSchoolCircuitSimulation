/**
 * ComponentValueDisplayRenderer.js - 数值显示编排与更新
 */

export function addValueDisplay({
    g,
    comp,
    createValueDisplayShape,
    resolveValueDisplayAnchor,
    layoutValueDisplay
}) {
    return createValueDisplayShape({
        g,
        comp,
        resolveValueDisplayAnchor,
        layoutValueDisplay: (target, targetComp) => layoutValueDisplay(target, targetComp)
    });
}

export function layoutValueDisplay({
    g,
    comp,
    getValueDisplayElements,
    valueDisplayStackOrder,
    resolveValueDisplayAnchor,
    resolveValueDisplayRowGap,
    setElementAttributeIfChanged,
    computeValueDisplayRowOffsets
}) {
    const elements = getValueDisplayElements(g);
    const valueGroup = elements?.valueGroup;
    if (!valueGroup) return;

    const displays = {
        power: elements.powerDisplay,
        voltage: elements.voltageDisplay,
        current: elements.currentDisplay
    };
    const visibleRows = [];
    const visibleDisplays = [];
    for (const row of valueDisplayStackOrder) {
        const display = displays[row];
        if (!display) continue;
        if ((display.textContent || '').trim().length > 0) {
            visibleRows.push(row);
            visibleDisplays.push(display);
        }
    }

    const anchor = resolveValueDisplayAnchor(comp);
    const rowGap = resolveValueDisplayRowGap(visibleDisplays);
    const layoutSignature = `${anchor.x},${anchor.y}|${visibleRows.join(',')}|${rowGap}`;
    if (valueGroup.__layoutSignature === layoutSignature) {
        return;
    }
    valueGroup.__layoutSignature = layoutSignature;
    setElementAttributeIfChanged(valueGroup, 'transform', `translate(${anchor.x}, ${anchor.y})`);
    const rowOffsets = computeValueDisplayRowOffsets(visibleRows, rowGap);
    for (const row of valueDisplayStackOrder) {
        const display = displays[row];
        if (!display) continue;
        setElementAttributeIfChanged(display, 'y', rowOffsets[row] ?? 0);
    }
}

export function updateValueDisplay({
    g,
    comp,
    showCurrent,
    showVoltage,
    showPower,
    updateValueDisplayRuntime,
    getValueDisplayElements,
    setDisplayTextAndStyle,
    layoutValueDisplay,
    formatValue,
    setElementAttributeIfChanged,
    safeToggleClass
}) {
    return updateValueDisplayRuntime({
        g,
        comp,
        showCurrent,
        showVoltage,
        showPower,
        helpers: {
            getValueDisplayElements: (node) => getValueDisplayElements(node),
            setDisplayTextAndStyle: (...args) => setDisplayTextAndStyle(...args),
            layoutValueDisplay: (target, targetComp) => layoutValueDisplay(target, targetComp),
            formatValue: (value, unit) => formatValue(value, unit),
            setElementAttributeIfChanged: (...args) => setElementAttributeIfChanged(...args),
            safeToggleClass
        }
    });
}

export function formatValue(value, unit) {
    if (value === undefined || value === null || isNaN(value)) return `0 ${unit}`;

    const absValue = Math.abs(value);
    if (absValue >= 1000) {
        return `${(value / 1000).toFixed(2)} k${unit}`;
    }
    if (absValue >= 1) {
        return `${value.toFixed(3)} ${unit}`;
    }
    if (absValue >= 0.001) {
        return `${(value * 1000).toFixed(2)} m${unit}`;
    }
    if (absValue >= 0.000001) {
        return `${(value * 1000000).toFixed(2)} μ${unit}`;
    }
    return `0 ${unit}`;
}
