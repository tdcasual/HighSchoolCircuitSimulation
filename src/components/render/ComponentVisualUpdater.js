import { clamp } from '../../utils/Physics.js';

function safeCall(fn, ...args) {
    if (typeof fn !== 'function') return undefined;
    try {
        return fn(...args);
    } catch (_) {
        return undefined;
    }
}

export function updateValueDisplayRuntime({
    g,
    comp,
    showCurrent,
    showVoltage,
    showPower,
    helpers = {}
}) {
    if (!g || !comp) return;
    const getValueDisplayElements = helpers.getValueDisplayElements;
    const setDisplayTextAndStyle = helpers.setDisplayTextAndStyle;
    const layoutValueDisplay = helpers.layoutValueDisplay;
    const formatValue = helpers.formatValue;
    const setElementAttributeIfChanged = helpers.setElementAttributeIfChanged;
    const safeToggleClass = helpers.safeToggleClass;

    const elements = safeCall(getValueDisplayElements, g) || {};
    const currentDisplay = elements.currentDisplay || null;
    const voltageDisplay = elements.voltageDisplay || null;
    const powerDisplay = elements.powerDisplay || null;

    if (comp.type === 'Ammeter') {
        if (currentDisplay) {
            if (showCurrent) {
                const reading = Math.abs(comp.currentValue || 0);
                safeCall(setDisplayTextAndStyle, currentDisplay, `${reading.toFixed(3)} A`, '14', '700');
            } else {
                safeCall(setDisplayTextAndStyle, currentDisplay, '', '13', '600');
            }
        }
        safeCall(setDisplayTextAndStyle, voltageDisplay, '');
        safeCall(setDisplayTextAndStyle, powerDisplay, '');
        safeCall(layoutValueDisplay, g, comp);
        return;
    }

    if (comp.type === 'Voltmeter') {
        if (voltageDisplay) {
            if (showVoltage) {
                const reading = Math.abs(comp.voltageValue || 0);
                safeCall(setDisplayTextAndStyle, voltageDisplay, `${reading.toFixed(3)} V`, '14', '700');
            } else {
                safeCall(setDisplayTextAndStyle, voltageDisplay, '', '13', '600');
            }
        }
        safeCall(setDisplayTextAndStyle, currentDisplay, '', '13', '600');
        safeCall(setDisplayTextAndStyle, powerDisplay, '');
        safeCall(layoutValueDisplay, g, comp);
        return;
    }

    if (comp.type === 'Switch' || comp.type === 'SPDTSwitch' || comp.type === 'Ground') {
        safeCall(setDisplayTextAndStyle, currentDisplay, '');
        safeCall(setDisplayTextAndStyle, voltageDisplay, '');
        safeCall(setDisplayTextAndStyle, powerDisplay, '');
        safeCall(layoutValueDisplay, g, comp);
        return;
    }

    if (currentDisplay) {
        const formattedCurrent = typeof formatValue === 'function'
            ? formatValue(comp.currentValue, 'A')
            : String(comp.currentValue ?? 0);
        safeCall(
            setDisplayTextAndStyle,
            currentDisplay,
            showCurrent ? `I = ${formattedCurrent}` : ''
        );
    }

    if (voltageDisplay) {
        if (comp.type === 'Rheostat' && showVoltage) {
            const parts = [];
            if (comp.voltageSegLeft !== undefined && comp.voltageSegLeft !== null) {
                const formatted = typeof formatValue === 'function'
                    ? formatValue(comp.voltageSegLeft, 'V')
                    : String(comp.voltageSegLeft);
                parts.push(`U₁=${formatted}`);
            }
            if (comp.voltageSegRight !== undefined && comp.voltageSegRight !== null) {
                const formatted = typeof formatValue === 'function'
                    ? formatValue(comp.voltageSegRight, 'V')
                    : String(comp.voltageSegRight);
                parts.push(`U₂=${formatted}`);
            }
            if (parts.length > 0) {
                safeCall(setDisplayTextAndStyle, voltageDisplay, parts.join('  '));
            } else {
                const formattedVoltage = typeof formatValue === 'function'
                    ? formatValue(comp.voltageValue, 'V')
                    : String(comp.voltageValue ?? 0);
                safeCall(setDisplayTextAndStyle, voltageDisplay, `U = ${formattedVoltage}`);
            }
        } else {
            const formattedVoltage = typeof formatValue === 'function'
                ? formatValue(comp.voltageValue, 'V')
                : String(comp.voltageValue ?? 0);
            safeCall(
                setDisplayTextAndStyle,
                voltageDisplay,
                showVoltage ? `U = ${formattedVoltage}` : ''
            );
        }
    }

    if (powerDisplay) {
        const formattedPower = typeof formatValue === 'function'
            ? formatValue(comp.powerValue, 'W')
            : String(comp.powerValue ?? 0);
        safeCall(
            setDisplayTextAndStyle,
            powerDisplay,
            showPower ? `P = ${formattedPower}` : ''
        );
    }
    safeCall(layoutValueDisplay, g, comp);

    if (comp.type === 'Bulb') {
        const glow = g.querySelector?.('.glow');
        if (glow) {
            const brightness = Math.min(1, comp.powerValue / comp.ratedPower);
            safeCall(setElementAttributeIfChanged, glow, 'fill', `rgba(255, 235, 59, ${brightness * 0.8})`);
            safeCall(safeToggleClass, g, 'on', brightness > 0.1);
        }
    }

    if (comp.type === 'LED') {
        const glow = g.querySelector?.('.led-glow');
        if (glow) {
            const color = comp.color || '#ff4d6d';
            const brightness = Math.max(0, Math.min(1, Number(comp.brightness) || 0));
            safeCall(setElementAttributeIfChanged, glow, 'fill', color);
            safeCall(setElementAttributeIfChanged, glow, 'fill-opacity', String(brightness * 0.85));
            safeCall(safeToggleClass, g, 'on', brightness > 0.05);
        }
    }

    if (comp.type === 'Capacitor') {
        const plates = g.querySelectorAll?.('.capacitor-plate') || [];
        const isCharged = Math.abs(comp.currentValue || 0) < 1e-6;
        plates.forEach((plate) => {
            safeCall(safeToggleClass, plate, 'charged', isCharged);
        });
    }
}

export function updateParallelPlateCapacitorVisualRuntime({
    g,
    comp,
    helpers = {}
}) {
    if (!g || !comp) return;
    const setElementAttributeIfChanged = helpers.setElementAttributeIfChanged;
    const plateLengthPx = 24;
    const halfLen = plateLengthPx / 2;
    const plateWidth = 4;
    const pxPerMm = 10;
    const minGapPx = 6;
    const maxGapPx = 30;

    const distanceMm = (comp.plateDistance ?? 0.001) * 1000;
    const gapPx = clamp(distanceMm * pxPerMm, minGapPx, maxGapPx);
    const offsetY = clamp(comp.plateOffsetYPx ?? 0, -plateLengthPx, plateLengthPx);

    const leftX = -gapPx / 2;
    const rightX = gapPx / 2;

    const leftConn = g.querySelector?.('.ppc-connector-left');
    if (leftConn) {
        safeCall(setElementAttributeIfChanged, leftConn, 'x2', String(leftX));
    }
    const rightConn = g.querySelector?.('.ppc-connector-right');
    if (rightConn) {
        safeCall(setElementAttributeIfChanged, rightConn, 'x1', String(rightX));
    }

    const leftPlate = g.querySelector?.('.ppc-plate-left');
    if (leftPlate) {
        safeCall(setElementAttributeIfChanged, leftPlate, 'x', String(leftX - plateWidth / 2));
        safeCall(setElementAttributeIfChanged, leftPlate, 'y', String(-halfLen));
    }

    const rightPlate = g.querySelector?.('.ppc-plate-right');
    if (rightPlate) {
        safeCall(setElementAttributeIfChanged, rightPlate, 'x', String(rightX - plateWidth / 2));
        safeCall(setElementAttributeIfChanged, rightPlate, 'y', String(-halfLen + offsetY));
        if (comp.explorationMode) {
            rightPlate.style.pointerEvents = 'all';
            rightPlate.style.cursor = 'grab';
        } else {
            rightPlate.style.pointerEvents = 'none';
            rightPlate.style.cursor = '';
        }
    }

    const label = g.querySelector?.('.ppc-label');
    if (label && !comp.label) {
        const C = comp.capacitance || 0;
        let text;
        if (Math.abs(C) >= 1e-3) {
            text = `${(C * 1e3).toFixed(0)}mF`;
        } else if (Math.abs(C) >= 1e-6) {
            text = `${(C * 1e6).toFixed(1)}μF`;
        } else if (Math.abs(C) >= 1e-9) {
            text = `${(C * 1e9).toFixed(1)}nF`;
        } else {
            text = `${(C * 1e12).toFixed(1)}pF`;
        }
        label.textContent = text;
    }
}
