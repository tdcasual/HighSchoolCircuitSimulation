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
                    document.getElementById('edit-voltage').value, 12, 0, 10000
                );
                // 内阻不能为0，会导致矩阵奇异；最小设为极小值
                let internalR = this.safeParseFloat(
                    document.getElementById('edit-internal-resistance').value, 0.5, 0, 10000
                );
                // 如果用户输入0，使用极小值避免求解器奇异
                comp.internalResistance = internalR < 1e-9 ? 1e-9 : internalR;
                break;

            case 'ACVoltageSource':
                comp.rmsVoltage = this.safeParseFloat(
                    document.getElementById('edit-rms-voltage').value, 12, 0, 10000
                );
                comp.frequency = this.safeParseFloat(
                    document.getElementById('edit-frequency').value, 50, 0, 1e6
                );
                comp.phase = this.safeParseFloat(
                    document.getElementById('edit-phase').value, 0, -36000, 36000
                );
                comp.offset = this.safeParseFloat(
                    document.getElementById('edit-offset').value, 0, -1e6, 1e6
                );
                let acInternalR = this.safeParseFloat(
                    document.getElementById('edit-internal-resistance').value, 0.5, 0, 10000
                );
                comp.internalResistance = acInternalR < 1e-9 ? 1e-9 : acInternalR;
                break;
                
            case 'Resistor':
                // 电阻最小值为极小正数，避免除零
                comp.resistance = this.safeParseFloat(
                    document.getElementById('edit-resistance').value, 100, 1e-9, 1e12
                );
                break;

            case 'Diode':
                comp.forwardVoltage = this.safeParseFloat(
                    document.getElementById('edit-forward-voltage').value, 0.7, 0, 1000
                );
                comp.onResistance = this.safeParseFloat(
                    document.getElementById('edit-on-resistance').value, 1, 1e-9, 1e9
                );
                comp.offResistance = this.safeParseFloat(
                    document.getElementById('edit-off-resistance').value, 1e9, 1, 1e15
                );
                break;

            case 'LED':
                comp.forwardVoltage = this.safeParseFloat(
                    document.getElementById('edit-forward-voltage').value, 2, 0, 1000
                );
                comp.onResistance = this.safeParseFloat(
                    document.getElementById('edit-on-resistance').value, 2, 1e-9, 1e9
                );
                comp.offResistance = this.safeParseFloat(
                    document.getElementById('edit-off-resistance').value, 1e9, 1, 1e15
                );
                comp.ratedCurrent = this.safeParseFloat(
                    document.getElementById('edit-rated-current').value, 20, 0.1, 100000
                ) / 1000;
                break;

            case 'Thermistor':
                comp.resistanceAt25 = this.safeParseFloat(
                    document.getElementById('edit-r25').value, 1000, 1e-9, 1e15
                );
                comp.beta = this.safeParseFloat(
                    document.getElementById('edit-beta').value, 3950, 1, 1e6
                );
                comp.temperatureC = this.safeParseFloat(
                    document.getElementById('edit-temperature-c').value, 25, -100, 300
                );
                break;

            case 'Photoresistor':
                comp.resistanceDark = this.safeParseFloat(
                    document.getElementById('edit-resistance-dark').value, 100000, 1e-9, 1e15
                );
                comp.resistanceLight = this.safeParseFloat(
                    document.getElementById('edit-resistance-light').value, 500, 1e-9, 1e15
                );
                comp.lightLevel = this.safeParseFloat(
                    document.getElementById('edit-light-level').value, 50, 0, 100
                ) / 100;
                break;

            case 'Relay':
                comp.coilResistance = this.safeParseFloat(
                    document.getElementById('edit-coil-resistance').value, 200, 1e-9, 1e15
                );
                comp.pullInCurrent = this.safeParseFloat(
                    document.getElementById('edit-pullin-current').value, 20, 0.1, 1e6
                ) / 1000;
                comp.dropOutCurrent = this.safeParseFloat(
                    document.getElementById('edit-dropout-current').value, 10, 0.1, 1e6
                ) / 1000;
                comp.contactOnResistance = this.safeParseFloat(
                    document.getElementById('edit-contact-on-resistance').value, 1e-3, 1e-9, 1e9
                );
                comp.contactOffResistance = this.safeParseFloat(
                    document.getElementById('edit-contact-off-resistance').value, 1e12, 1, 1e15
                );
                break;
                
            case 'Rheostat':
                comp.minResistance = this.safeParseFloat(
                    document.getElementById('edit-min-resistance').value, 0, 0, 1e12
                );
                comp.maxResistance = this.safeParseFloat(
                    document.getElementById('edit-max-resistance').value, 100, comp.minResistance + 0.001, 1e12
                );
                comp.position = this.safeParseFloat(
                    document.getElementById('edit-position').value, 50, 0, 100
                ) / 100;
                break;
                
            case 'Bulb':
                comp.resistance = this.safeParseFloat(
                    document.getElementById('edit-resistance').value, 50, 1e-9, 1e12
                );
                comp.ratedPower = this.safeParseFloat(
                    document.getElementById('edit-rated-power').value, 5, 0.001, 1e9
                );
                break;
                
            case 'Capacitor':
                // 电容值以μF输入，转换为F
                const capValue = this.safeParseFloat(
                    document.getElementById('edit-capacitance').value, 1000, 0.001, 1e12
                );
                comp.capacitance = capValue / 1000000;
                comp.integrationMethod = document.getElementById('edit-integration-method')?.value || 'auto';
                comp._dynamicHistoryReady = false;
                break;

            case 'Inductor':
                comp.inductance = this.safeParseFloat(
                    document.getElementById('edit-inductance').value, 0.1, 1e-9, 1e12
                );
                comp.initialCurrent = this.safeParseFloat(
                    document.getElementById('edit-initial-current').value, 0, -1e6, 1e6
                );
                comp.prevCurrent = comp.initialCurrent;
                comp.prevVoltage = 0;
                comp.integrationMethod = document.getElementById('edit-integration-method')?.value || 'auto';
                comp._dynamicHistoryReady = false;
                break;

            case 'ParallelPlateCapacitor': {
                const areaCm2 = this.safeParseFloat(
                    document.getElementById('edit-plate-area').value,
                    (comp.plateArea || 0.01) * 10000,
                    0.01,
                    1e12
                );
                const distanceMm = this.safeParseFloat(
                    document.getElementById('edit-plate-distance').value,
                    (comp.plateDistance || 0.001) * 1000,
                    0.001,
                    1e9
                );
                comp.plateArea = areaCm2 / 10000;
                comp.plateDistance = distanceMm / 1000;
                comp.dielectricConstant = this.safeParseFloat(
                    document.getElementById('edit-dielectric-constant').value,
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
                    document.getElementById('edit-resistance').value, 5, 1e-9, 1e12
                );
                comp.loadTorque = this.safeParseFloat(
                    document.getElementById('edit-load-torque').value, 0.01, 0, 1e9
                );
                break;
                
            case 'Switch':
                // 检查哪个按钮被选中
                const switchClose = document.getElementById('switch-close');
                comp.closed = switchClose && switchClose.classList.contains('active');
                break;

            case 'SPDTSwitch':
                comp.position = document.getElementById('edit-spdt-position')?.value === 'b' ? 'b' : 'a';
                comp.onResistance = this.safeParseFloat(
                    document.getElementById('edit-on-resistance').value, 1e-9, 1e-9, 1e9
                );
                comp.offResistance = this.safeParseFloat(
                    document.getElementById('edit-off-resistance').value, 1e12, 1, 1e15
                );
                break;

            case 'Fuse': {
                comp.ratedCurrent = this.safeParseFloat(
                    document.getElementById('edit-rated-current').value, 3, 0.001, 1e9
                );
                comp.i2tThreshold = this.safeParseFloat(
                    document.getElementById('edit-i2t-threshold').value, 1, 1e-9, 1e12
                );
                comp.coldResistance = this.safeParseFloat(
                    document.getElementById('edit-cold-resistance').value, 0.05, 1e-9, 1e9
                );
                comp.blownResistance = this.safeParseFloat(
                    document.getElementById('edit-blown-resistance').value, 1e12, 1, 1e15
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
                    document.getElementById('edit-resistance').value, 0, 0, 1e12
                );
                comp.range = this.safeParseFloat(
                    document.getElementById('edit-range').value, 3, 0.001, 1e9
                );
                break;
                
            case 'Voltmeter':
                const voltmeterR = document.getElementById('edit-resistance').value;
                // 空值或0表示理想电压表（无穷大内阻）
                if (voltmeterR === '' || parseFloat(voltmeterR) <= 0) {
                    comp.resistance = Infinity;
                } else {
                    comp.resistance = this.safeParseFloat(voltmeterR, Infinity, 0, 1e12);
                }
                comp.range = this.safeParseFloat(
                    document.getElementById('edit-range').value, 15, 0.001, 1e9
                );
                break;

            case 'BlackBox': {
                comp.boxWidth = Math.round(this.safeParseFloat(
                    document.getElementById('edit-box-width').value,
                    comp.boxWidth || 180,
                    80,
                    5000
                ));
                comp.boxHeight = Math.round(this.safeParseFloat(
                    document.getElementById('edit-box-height').value,
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
        console.error('Error applying dialog changes:', error);
        this.updateStatus('更新失败：' + error.message);
    }
}
