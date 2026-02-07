import { SVGRenderer } from '../../components/Component.js';
import { computeOverlapFractionFromOffsetPx, computeParallelPlateCapacitance } from '../../utils/Physics.js';
import { createElement, clearElement } from '../../utils/SafeDOM.js';

export function createMeterSelfReadingControl(comp) {
    const group = createElement('div', { className: 'form-group meter-self-reading-group' });
    group.appendChild(createElement('label', { textContent: '自主读数（右侧表盘）' }));

    const row = createElement('div', { className: 'meter-self-reading-row' });
    const enabled = !!comp.selfReading;
    const toggleBtn = createElement('button', {
        className: 'display-chip' + (enabled ? ' active' : ''),
        textContent: enabled ? '已开启' : '已关闭',
        attrs: {
            type: 'button',
            'aria-pressed': enabled ? 'true' : 'false'
        }
    });
    const openObservationBtn = createElement('button', {
        className: 'plot-clear-btn',
        textContent: '打开观察页',
        attrs: { type: 'button' }
    });

    const syncToggleState = () => {
        const isEnabled = !!comp.selfReading;
        toggleBtn.classList.toggle('active', isEnabled);
        toggleBtn.setAttribute('aria-pressed', isEnabled ? 'true' : 'false');
        toggleBtn.textContent = isEnabled ? '已开启' : '已关闭';
    };

    toggleBtn.addEventListener('click', () => {
        this.runWithHistory('切换自主读数', () => {
            comp.selfReading = !comp.selfReading;
            this.app.observationPanel?.refreshDialGauges();
            syncToggleState();
            this.app.updateStatus(comp.selfReading ? '已开启自主读数：请在右侧“观察”查看表盘' : '已关闭自主读数');
        });
    });

    openObservationBtn.addEventListener('click', () => {
        if (typeof this.activateSidePanelTab === 'function') {
            this.activateSidePanelTab('observation');
        }
        this.app.observationPanel?.refreshComponentOptions?.();
        this.app.observationPanel?.refreshDialGauges?.();
        this.app.observationPanel?.requestRender?.({ onlyIfActive: false });
    });

    row.appendChild(toggleBtn);
    row.appendChild(openObservationBtn);
    group.appendChild(row);
    group.appendChild(createElement('p', {
        className: 'hint',
        textContent: '开启后会在“观察”页显示独立指针表盘。'
    }));
    return group;
}

/**
 * 仅更新属性面板里的“实时测量”等动态值，避免每帧重建 DOM 导致闪烁/输入框失焦
 */
export function updateSelectedComponentReadouts(comp) {
    if (!comp) return;

    const currentEl = document.getElementById('measure-current');
    const voltageEl = document.getElementById('measure-voltage');
    const powerEl = document.getElementById('measure-power');

    if (currentEl) currentEl.textContent = `${(comp.currentValue || 0).toFixed(4)} A`;
    if (voltageEl) voltageEl.textContent = `${(comp.voltageValue || 0).toFixed(4)} V`;
    if (powerEl) powerEl.textContent = `${(comp.powerValue || 0).toFixed(4)} W`;

    // 仪表读数行（如果存在）
    const ammeterReading = document.querySelector('.ammeter-reading');
    if (ammeterReading && comp.type === 'Ammeter') {
        ammeterReading.textContent = `${(Math.abs(comp.currentValue) || 0).toFixed(3)} A`;
    }
    const voltmeterReading = document.querySelector('.voltmeter-reading');
    if (voltmeterReading && comp.type === 'Voltmeter') {
        voltmeterReading.textContent = `${(Math.abs(comp.voltageValue) || 0).toFixed(3)} V`;
    }

    // 特殊组件的动态字段
    if (comp.type === 'Rheostat') {
        this.updateRheostatPanelValues(comp);
    }
    if (comp.type === 'ParallelPlateCapacitor') {
        this.updateParallelPlateCapacitorPanelValues(comp);
    }
}

/**
 * 仅更新滑动变阻器属性面板的动态值（避免闪烁）
 */
export function updateRheostatPanelValues(comp) {
    if (!comp || comp.type !== 'Rheostat') return;

    // 重新计算接入电路的电阻
    this.circuit.calculateRheostatActiveResistance(comp);

    const currentREl = document.getElementById('rheostat-current-r');
    const positionEl = document.getElementById('rheostat-position');

    const directionText = {
        'slider-right-increase': '→增大',
        'slider-right-decrease': '→减小',
        fixed: '固定',
        parallel: '并联',
        disconnected: '-'
    };

    if (currentREl && positionEl) {
        clearElement(currentREl);
        currentREl.appendChild(document.createTextNode(`${(comp.activeResistance || 0).toFixed(1)} Ω `));
        const small = createElement('small', { textContent: directionText[comp.resistanceDirection] || '' });
        currentREl.appendChild(small);

        positionEl.textContent = `${(comp.position * 100).toFixed(0)}%`;
    }
}

/**
 * 根据平行板电容的物理参数重算电容值，并可选更新图形/面板。
 * 注意：不修改 prevCharge（用于保持“断开后 Q 近似守恒”的演示效果）。
 */
export function recomputeParallelPlateCapacitance(comp, options = {}) {
    if (!comp || comp.type !== 'ParallelPlateCapacitor') return;

    const plateLengthPx = 24;
    const overlapFraction = computeOverlapFractionFromOffsetPx(comp.plateOffsetYPx || 0, plateLengthPx);
    const C = computeParallelPlateCapacitance({
        plateArea: comp.plateArea,
        plateDistance: comp.plateDistance,
        dielectricConstant: comp.dielectricConstant,
        overlapFraction
    });
    comp.capacitance = C;

    if (options.updateVisual) {
        const g = this.renderer.componentElements.get(comp.id);
        if (g) {
            SVGRenderer.updateParallelPlateCapacitorVisual(g, comp);
        } else {
            this.renderer.refreshComponent(comp);
        }
    }

    if (options.updatePanel) {
        this.updateParallelPlateCapacitorPanelValues(comp);
    }
}

/**
 * 仅更新平行板电容在属性面板中的动态字段
 */
export function updateParallelPlateCapacitorPanelValues(comp) {
    if (!comp || comp.type !== 'ParallelPlateCapacitor') return;

    const plateLengthPx = 24;
    const overlapFraction = computeOverlapFractionFromOffsetPx(comp.plateOffsetYPx || 0, plateLengthPx);
    const distanceMm = (comp.plateDistance || 0) * 1000;
    const areaCm2 = (comp.plateArea || 0) * 10000;
    const effAreaCm2 = areaCm2 * overlapFraction;

    const voltage = Math.abs(comp.voltageValue || 0);
    const field = comp.plateDistance ? voltage / comp.plateDistance : 0; // V/m
    const charge = Math.abs(comp.prevCharge ?? (comp.capacitance || 0) * (comp.prevVoltage || 0));

    const capEl = document.getElementById('ppc-readout-capacitance');
    const distanceEl = document.getElementById('ppc-readout-distance');
    const overlapEl = document.getElementById('ppc-readout-overlap');
    const areaEl = document.getElementById('ppc-readout-area');
    const fieldEl = document.getElementById('ppc-readout-field');
    const chargeEl = document.getElementById('ppc-readout-charge');

    const formatCap = (C) => {
        if (!Number.isFinite(C)) return '0 F';
        const absC = Math.abs(C);
        if (absC >= 1e-3) return `${(C * 1e3).toFixed(3)} mF`;
        if (absC >= 1e-6) return `${(C * 1e6).toFixed(3)} μF`;
        if (absC >= 1e-9) return `${(C * 1e9).toFixed(3)} nF`;
        return `${(C * 1e12).toFixed(3)} pF`;
    };

    const formatCharge = (Q) => {
        if (!Number.isFinite(Q)) return '0 C';
        const absQ = Math.abs(Q);
        if (absQ >= 1e-3) return `${(Q * 1e3).toFixed(3)} mC`;
        if (absQ >= 1e-6) return `${(Q * 1e6).toFixed(3)} μC`;
        if (absQ >= 1e-9) return `${(Q * 1e9).toFixed(3)} nC`;
        return `${(Q * 1e12).toFixed(3)} pC`;
    };

    const formatField = (E) => {
        if (!Number.isFinite(E)) return '0 V/m';
        const absE = Math.abs(E);
        if (absE >= 1e6) return `${(E / 1e6).toFixed(3)} MV/m`;
        if (absE >= 1e3) return `${(E / 1e3).toFixed(3)} kV/m`;
        return `${E.toFixed(3)} V/m`;
    };

    if (capEl) capEl.textContent = formatCap(comp.capacitance || 0);
    if (distanceEl) distanceEl.textContent = `${distanceMm.toFixed(3)} mm`;
    if (overlapEl) overlapEl.textContent = `${(overlapFraction * 100).toFixed(1)}%`;
    if (areaEl) areaEl.textContent = `${effAreaCm2.toFixed(2)} cm²`;
    if (fieldEl) fieldEl.textContent = formatField(field);
    if (chargeEl) chargeEl.textContent = formatCharge(charge);

    // 输入框（如果存在）也同步当前值，避免拖动时显示滞后
    const distanceInput = document.getElementById('ppc-input-distance');
    if (distanceInput && document.activeElement !== distanceInput) {
        distanceInput.value = distanceMm.toFixed(3);
    }
}
