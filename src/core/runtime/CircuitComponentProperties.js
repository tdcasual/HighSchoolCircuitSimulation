function getAutoIntegrationProperties(comp, fields = []) {
    const result = {};
    for (const field of fields) {
        result[field] = comp[field];
    }
    result.integrationMethod = comp.integrationMethod || 'auto';
    return result;
}

export function getCircuitComponentProperties(comp = {}) {
    switch (comp.type) {
        case 'Ground':
            return {
                isReference: true
            };
        case 'PowerSource':
            return {
                voltage: comp.voltage,
                internalResistance: comp.internalResistance
            };
        case 'ACVoltageSource':
            return {
                rmsVoltage: comp.rmsVoltage,
                frequency: comp.frequency,
                phase: comp.phase,
                offset: comp.offset,
                internalResistance: comp.internalResistance
            };
        case 'Resistor':
            return { resistance: comp.resistance };
        case 'Thermistor':
            return {
                resistanceAt25: comp.resistanceAt25,
                beta: comp.beta,
                temperatureC: comp.temperatureC
            };
        case 'Photoresistor':
            return {
                resistanceDark: comp.resistanceDark,
                resistanceLight: comp.resistanceLight,
                lightLevel: comp.lightLevel
            };
        case 'Diode':
            return {
                forwardVoltage: comp.forwardVoltage,
                onResistance: comp.onResistance,
                offResistance: comp.offResistance
            };
        case 'LED':
            return {
                forwardVoltage: comp.forwardVoltage,
                onResistance: comp.onResistance,
                offResistance: comp.offResistance,
                ratedCurrent: comp.ratedCurrent,
                color: comp.color
            };
        case 'Rheostat':
            return {
                minResistance: comp.minResistance,
                maxResistance: comp.maxResistance,
                position: comp.position
            };
        case 'Bulb':
            return {
                resistance: comp.resistance,
                ratedPower: comp.ratedPower
            };
        case 'Capacitor':
            return getAutoIntegrationProperties(comp, ['capacitance']);
        case 'Inductor':
            return getAutoIntegrationProperties(comp, ['inductance', 'initialCurrent']);
        case 'ParallelPlateCapacitor':
            return getAutoIntegrationProperties(comp, [
                'plateArea',
                'plateDistance',
                'dielectricConstant',
                'plateOffsetYPx',
                'explorationMode',
                'capacitance'
            ]);
        case 'Motor':
            return {
                resistance: comp.resistance,
                torqueConstant: comp.torqueConstant,
                emfConstant: comp.emfConstant,
                inertia: comp.inertia,
                loadTorque: comp.loadTorque
            };
        case 'Switch':
            return { closed: comp.closed };
        case 'SPDTSwitch':
            return {
                position: comp.position === 'b' ? 'b' : 'a',
                onResistance: comp.onResistance,
                offResistance: comp.offResistance
            };
        case 'Relay':
            return {
                coilResistance: comp.coilResistance,
                pullInCurrent: comp.pullInCurrent,
                dropOutCurrent: comp.dropOutCurrent,
                contactOnResistance: comp.contactOnResistance,
                contactOffResistance: comp.contactOffResistance,
                energized: !!comp.energized
            };
        case 'Fuse':
            return {
                ratedCurrent: comp.ratedCurrent,
                i2tThreshold: comp.i2tThreshold,
                i2tAccum: comp.i2tAccum,
                coldResistance: comp.coldResistance,
                blownResistance: comp.blownResistance,
                blown: !!comp.blown
            };
        case 'Ammeter':
        case 'Voltmeter':
            return {
                resistance: comp.resistance,
                range: comp.range,
                selfReading: !!comp.selfReading
            };
        case 'BlackBox':
            return {
                boxWidth: comp.boxWidth,
                boxHeight: comp.boxHeight,
                viewMode: comp.viewMode === 'opaque' ? 'opaque' : 'transparent'
            };
        default:
            return {};
    }
}
