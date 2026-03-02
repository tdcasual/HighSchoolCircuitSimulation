export function createValueDisplayShape({
    g,
    comp,
    resolveValueDisplayAnchor,
    layoutValueDisplay
}) {
    if (!g || typeof document === 'undefined') return null;

    const valueGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    valueGroup.setAttribute('class', 'value-display-group');
    const anchor = typeof resolveValueDisplayAnchor === 'function'
        ? resolveValueDisplayAnchor(comp)
        : { x: 0, y: -14 };
    valueGroup.setAttribute('transform', `translate(${anchor.x}, ${anchor.y})`);

    const currentText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    currentText.setAttribute('class', 'value-display current-display');
    currentText.setAttribute('x', 0);
    currentText.setAttribute('y', 0);
    currentText.setAttribute('text-anchor', 'middle');
    currentText.setAttribute('font-size', '13');
    currentText.setAttribute('font-weight', '600');
    currentText.textContent = '';
    valueGroup.appendChild(currentText);

    const voltageText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    voltageText.setAttribute('class', 'value-display voltage-display');
    voltageText.setAttribute('x', 0);
    voltageText.setAttribute('y', 0);
    voltageText.setAttribute('text-anchor', 'middle');
    voltageText.setAttribute('font-size', '13');
    voltageText.setAttribute('font-weight', '600');
    voltageText.textContent = '';
    valueGroup.appendChild(voltageText);

    const powerText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    powerText.setAttribute('class', 'value-display power-display');
    powerText.setAttribute('x', 0);
    powerText.setAttribute('y', 0);
    powerText.setAttribute('text-anchor', 'middle');
    powerText.setAttribute('font-size', '13');
    powerText.setAttribute('font-weight', '600');
    powerText.textContent = '';
    valueGroup.appendChild(powerText);

    g.appendChild(valueGroup);
    g.__valueDisplayElements = {
        valueGroup,
        currentDisplay: currentText,
        voltageDisplay: voltageText,
        powerDisplay: powerText
    };
    valueGroup.__layoutSignature = '';

    if (typeof layoutValueDisplay === 'function') {
        layoutValueDisplay(g, comp);
    }

    return g.__valueDisplayElements;
}

export function readValueDisplayElements(g) {
    if (!g) return null;
    const cached = g.__valueDisplayElements;
    if (cached?.valueGroup && cached.currentDisplay && cached.voltageDisplay && cached.powerDisplay) {
        return cached;
    }
    const elements = {
        valueGroup: g.querySelector?.('.value-display-group') || null,
        currentDisplay: g.querySelector?.('.current-display') || null,
        voltageDisplay: g.querySelector?.('.voltage-display') || null,
        powerDisplay: g.querySelector?.('.power-display') || null
    };
    g.__valueDisplayElements = elements;
    return elements;
}
