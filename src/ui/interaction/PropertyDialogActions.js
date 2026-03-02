function readFieldValue(id, fallback = '') {
    const element = document.getElementById(id);
    if (!element || !('value' in element)) {
        return String(fallback ?? '');
    }
    return String(element.value ?? '');
}

function safeHasClass(element, className) {
    if (!element || !element.classList || typeof element.classList.contains !== 'function') return false;
    try {
        return element.classList.contains(className);
    } catch (_) {
        return false;
    }
}

export function applyDialogChanges() {
    if (!this.editingComponent) return;
    
    const comp = this.editingComponent;

    try {
        this.runWithHistory('修改属性', () => {
            switch (comp.type) {
            case 'Ground':
                break;

            case 'PowerSource':
                comp.voltage = this.safeParseFloat(
                    readFieldValue('edit-voltage'), 12, 0, 10000
                );
                // 内阻不能为0，会导致矩阵奇异；最小设为极小值
                let internalR = this.safeParseFloat(
                    readFieldValue('edit-internal-resistance'), 0.5, 0, 10000
                );
                // 如果用户输入0，使用极小值避免求解器奇异
                comp.internalResistance = internalR < 1e-9 ? 1e-9 : internalR;
                break;

            case 'ACVoltageSource':
                comp.rmsVoltage = this.safeParseFloat(
                    readFieldValue('edit-rms-voltage'), 12, 0, 10000
                );
                comp.frequency = this.safeParseFloat(
                    readFieldValue('edit-frequency'), 50, 0, 1e6
                );
                comp.phase = this.safeParseFloat(
                    readFieldValue('edit-phase'), 0, -36000, 36000
                );
                comp.offset = this.safeParseFloat(
                    readFieldValue('edit-offset'), 0, -1e6, 1e6
                );
                let acInternalR = this.safeParseFloat(
                    readFieldValue('edit-internal-resistance'), 0.5, 0, 10000
                );
                comp.internalResistance = acInternalR < 1e-9 ? 1e-9 : acInternalR;
                break;
                
            case 'Resistor':
                // 电阻最小值为极小正数，避免除零
                comp.resistance = this.safeParseFloat(
                    readFieldValue('edit-resistance'), 100, 1e-9, 1e12
                );
                break;

            case 'Diode':
                comp.forwardVoltage = this.safeParseFloat(
                    readFieldValue('edit-forward-voltage'), 0.7, 0, 1000
                );
                comp.onResistance = this.safeParseFloat(
                    readFieldValue('edit-on-resistance'), 1, 1e-9, 1e9
                );
                comp.offResistance = this.safeParseFloat(
                    readFieldValue('edit-off-resistance'), 1e9, 1, 1e15
                );
                break;

            case 'LED':
                comp.forwardVoltage = this.safeParseFloat(
                    readFieldValue('edit-forward-voltage'), 2, 0, 1000
                );
                comp.onResistance = this.safeParseFloat(
                    readFieldValue('edit-on-resistance'), 2, 1e-9, 1e9
                );
                comp.offResistance = this.safeParseFloat(
                    readFieldValue('edit-off-resistance'), 1e9, 1, 1e15
                );
                comp.ratedCurrent = this.safeParseFloat(
                    readFieldValue('edit-rated-current'), 20, 0.1, 100000
                ) / 1000;
                break;

            case 'Thermistor':
                comp.resistanceAt25 = this.safeParseFloat(
                    readFieldValue('edit-r25'), 1000, 1e-9, 1e15
                );
                comp.beta = this.safeParseFloat(
                    readFieldValue('edit-beta'), 3950, 1, 1e6
                );
                comp.temperatureC = this.safeParseFloat(
                    readFieldValue('edit-temperature-c'), 25, -100, 300
                );
                break;

            case 'Photoresistor':
                comp.resistanceDark = this.safeParseFloat(
                    readFieldValue('edit-resistance-dark'), 100000, 1e-9, 1e15
                );
                comp.resistanceLight = this.safeParseFloat(
                    readFieldValue('edit-resistance-light'), 500, 1e-9, 1e15
                );
                comp.lightLevel = this.safeParseFloat(
                    readFieldValue('edit-light-level'), 50, 0, 100
                ) / 100;
                break;

            case 'Relay':
                comp.coilResistance = this.safeParseFloat(
                    readFieldValue('edit-coil-resistance'), 200, 1e-9, 1e15
                );
                comp.pullInCurrent = this.safeParseFloat(
                    readFieldValue('edit-pullin-current'), 20, 0.1, 1e6
                ) / 1000;
                comp.dropOutCurrent = this.safeParseFloat(
                    readFieldValue('edit-dropout-current'), 10, 0.1, 1e6
                ) / 1000;
                comp.contactOnResistance = this.safeParseFloat(
                    readFieldValue('edit-contact-on-resistance'), 1e-3, 1e-9, 1e9
                );
                comp.contactOffResistance = this.safeParseFloat(
                    readFieldValue('edit-contact-off-resistance'), 1e12, 1, 1e15
                );
                break;
                
            case 'Rheostat':
                comp.minResistance = this.safeParseFloat(
                    readFieldValue('edit-min-resistance'), 0, 0, 1e12
                );
                comp.maxResistance = this.safeParseFloat(
                    readFieldValue('edit-max-resistance'), 100, comp.minResistance + 0.001, 1e12
                );
                comp.position = this.safeParseFloat(
                    readFieldValue('edit-position'), 50, 0, 100
                ) / 100;
                break;
                
            case 'Bulb':
                comp.resistance = this.safeParseFloat(
                    readFieldValue('edit-resistance'), 50, 1e-9, 1e12
                );
                comp.ratedPower = this.safeParseFloat(
                    readFieldValue('edit-rated-power'), 5, 0.001, 1e9
                );
                break;
                
            case 'Capacitor':
                // 电容值以μF输入，转换为F
                const capValue = this.safeParseFloat(
                    readFieldValue('edit-capacitance'), 1000, 0.001, 1e12
                );
                comp.capacitance = capValue / 1000000;
                comp.integrationMethod = document.getElementById('edit-integration-method')?.value || 'auto';
                comp._dynamicHistoryReady = false;
                break;

            case 'Inductor':
                comp.inductance = this.safeParseFloat(
                    readFieldValue('edit-inductance'), 0.1, 1e-9, 1e12
                );
                comp.initialCurrent = this.safeParseFloat(
                    readFieldValue('edit-initial-current'), 0, -1e6, 1e6
                );
                comp.prevCurrent = comp.initialCurrent;
                comp.prevVoltage = 0;
                comp.integrationMethod = document.getElementById('edit-integration-method')?.value || 'auto';
                comp._dynamicHistoryReady = false;
                break;

            case 'ParallelPlateCapacitor': {
                const areaCm2 = this.safeParseFloat(
                    readFieldValue('edit-plate-area'),
                    (comp.plateArea || 0.01) * 10000,
                    0.01,
                    1e12
                );
                const distanceMm = this.safeParseFloat(
                    readFieldValue('edit-plate-distance'),
                    (comp.plateDistance || 0.001) * 1000,
                    0.001,
                    1e9
                );
                comp.plateArea = areaCm2 / 10000;
                comp.plateDistance = distanceMm / 1000;
                comp.dielectricConstant = this.safeParseFloat(
                    readFieldValue('edit-dielectric-constant'),
                    comp.dielectricConstant ?? 1,
                    1,
                    1e9
                );
                const exploreEl = document.getElementById('edit-exploration-mode');
                comp.explorationMode = !!(exploreEl && exploreEl.checked);

                this.recomputeParallelPlateCapacitance(comp, { updateVisual: false });
                break;
            }
                
            case 'Motor':
                comp.resistance = this.safeParseFloat(
                    readFieldValue('edit-resistance'), 5, 1e-9, 1e12
                );
                comp.loadTorque = this.safeParseFloat(
                    readFieldValue('edit-load-torque'), 0.01, 0, 1e9
                );
                break;
                
            case 'Switch':
                // 检查哪个按钮被选中
                const switchClose = document.getElementById('switch-close');
                comp.closed = safeHasClass(switchClose, 'active');
                break;

            case 'SPDTSwitch':
                comp.position = document.getElementById('edit-spdt-position')?.value === 'b' ? 'b' : 'a';
                comp.onResistance = this.safeParseFloat(
                    readFieldValue('edit-on-resistance'), 1e-9, 1e-9, 1e9
                );
                comp.offResistance = this.safeParseFloat(
                    readFieldValue('edit-off-resistance'), 1e12, 1, 1e15
                );
                break;

            case 'Fuse': {
                comp.ratedCurrent = this.safeParseFloat(
                    readFieldValue('edit-rated-current'), 3, 0.001, 1e9
                );
                comp.i2tThreshold = this.safeParseFloat(
                    readFieldValue('edit-i2t-threshold'), 1, 1e-9, 1e12
                );
                comp.coldResistance = this.safeParseFloat(
                    readFieldValue('edit-cold-resistance'), 0.05, 1e-9, 1e9
                );
                comp.blownResistance = this.safeParseFloat(
                    readFieldValue('edit-blown-resistance'), 1e12, 1, 1e15
                );
                const blownChecked = !!document.getElementById('edit-fuse-blown')?.checked;
                if (!blownChecked) {
                    comp.i2tAccum = 0;
                }
                comp.blown = blownChecked;
                break;
            }
                
            case 'Ammeter':
                comp.resistance = this.safeParseFloat(
                    readFieldValue('edit-resistance'), 0, 0, 1e12
                );
                comp.range = this.safeParseFloat(
                    readFieldValue('edit-range'), 3, 0.001, 1e9
                );
                break;
                
            case 'Voltmeter':
                const voltmeterR = readFieldValue('edit-resistance');
                // 空值或0表示理想电压表（无穷大内阻）
                if (voltmeterR === '' || parseFloat(voltmeterR) <= 0) {
                    comp.resistance = Infinity;
                } else {
                    comp.resistance = this.safeParseFloat(voltmeterR, Infinity, 0, 1e12);
                }
                comp.range = this.safeParseFloat(
                    readFieldValue('edit-range'), 15, 0.001, 1e9
                );
                break;

            case 'BlackBox': {
                comp.boxWidth = Math.round(this.safeParseFloat(
                    readFieldValue('edit-box-width'),
                    comp.boxWidth || 180,
                    80,
                    5000
                ));
                comp.boxHeight = Math.round(this.safeParseFloat(
                    readFieldValue('edit-box-height'),
                    comp.boxHeight || 110,
                    60,
                    5000
                ));
                const mode = document.getElementById('edit-box-mode')?.value;
                comp.viewMode = mode === 'opaque' ? 'opaque' : 'transparent';
                break;
            }
        }

        this.circuit.markSolverCircuitDirty();

        // 刷新渲染
        if (comp.type === 'BlackBox') {
            // 黑箱会影响“内部元件/导线是否显示”，需要全量重绘
            this.renderer.render();
            this.selectComponent(comp.id);
        } else {
            this.renderer.refreshComponent(comp);
            this.renderer.setSelected(comp.id, true);
            // 更新连接到该元器件的导线
            this.renderer.updateConnectedWires(comp.id);
            this.updatePropertyPanel(comp);
        }
        
        this.hideDialog();
        this.updateStatus('属性已更新');
        });
    } catch (error) {
        if (this.logger && typeof this.logger.error === 'function') {
            this.logger.error('Error applying dialog changes:', error);
        }
        this.updateStatus('更新失败：' + error.message);
    }
}
