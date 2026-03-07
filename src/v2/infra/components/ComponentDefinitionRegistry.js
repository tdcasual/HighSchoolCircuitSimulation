/**
 * ComponentDefinitionRegistry.js - canonical component definition source
 */

function clonePlainValue(value) {
    if (value == null) return value;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map((item) => clonePlainValue(item));
    }
    if (typeof value === 'object') {
        const output = {};
        for (const [key, nested] of Object.entries(value)) {
            output[key] = clonePlainValue(nested);
        }
        return output;
    }
    return undefined;
}

function freezeDefinition(type, definition) {
    return Object.freeze({
        type,
        displayName: definition.displayName,
        terminalCount: Number(definition.terminalCount) || 2,
        defaults: Object.freeze(clonePlainValue(definition.defaults || {}))
    });
}

const COMPONENT_DEFINITION_REGISTRY_INTERNAL = Object.freeze(Object.fromEntries(
    Object.entries({
        "Ground": {
            "type": "Ground",
            "displayName": "接地",
            "terminalCount": 1,
            "defaults": {
                "isReference": true
            }
        },
        "PowerSource": {
            "type": "PowerSource",
            "displayName": "电源",
            "terminalCount": 2,
            "defaults": {
                "voltage": 12,
                "internalResistance": 0.5
            }
        },
        "ACVoltageSource": {
            "type": "ACVoltageSource",
            "displayName": "交流电源",
            "terminalCount": 2,
            "defaults": {
                "rmsVoltage": 12,
                "frequency": 50,
                "phase": 0,
                "offset": 0,
                "internalResistance": 0.5
            }
        },
        "Resistor": {
            "type": "Resistor",
            "displayName": "定值电阻",
            "terminalCount": 2,
            "defaults": {
                "resistance": 100
            }
        },
        "Diode": {
            "type": "Diode",
            "displayName": "二极管",
            "terminalCount": 2,
            "defaults": {
                "forwardVoltage": 0.7,
                "onResistance": 1,
                "offResistance": 1000000000,
                "conducting": false
            }
        },
        "LED": {
            "type": "LED",
            "displayName": "发光二极管",
            "terminalCount": 2,
            "defaults": {
                "forwardVoltage": 2,
                "onResistance": 2,
                "offResistance": 1000000000,
                "ratedCurrent": 0.02,
                "color": "#ff4d6d",
                "conducting": false,
                "brightness": 0
            }
        },
        "Thermistor": {
            "type": "Thermistor",
            "displayName": "热敏电阻",
            "terminalCount": 2,
            "defaults": {
                "resistanceAt25": 1000,
                "beta": 3950,
                "temperatureC": 25
            }
        },
        "Photoresistor": {
            "type": "Photoresistor",
            "displayName": "光敏电阻",
            "terminalCount": 2,
            "defaults": {
                "resistanceDark": 100000,
                "resistanceLight": 500,
                "lightLevel": 0.5
            }
        },
        "Relay": {
            "type": "Relay",
            "displayName": "继电器",
            "terminalCount": 4,
            "defaults": {
                "coilResistance": 200,
                "pullInCurrent": 0.02,
                "dropOutCurrent": 0.01,
                "contactOnResistance": 0.001,
                "contactOffResistance": 1000000000000,
                "energized": false
            }
        },
        "Rheostat": {
            "type": "Rheostat",
            "displayName": "滑动变阻器",
            "terminalCount": 3,
            "defaults": {
                "minResistance": 0,
                "maxResistance": 100,
                "position": 0.5,
                "connectionMode": "none",
                "activeResistance": 0,
                "resistanceDirection": "disconnected"
            }
        },
        "Bulb": {
            "type": "Bulb",
            "displayName": "灯泡",
            "terminalCount": 2,
            "defaults": {
                "resistance": 50,
                "ratedPower": 5
            }
        },
        "Capacitor": {
            "type": "Capacitor",
            "displayName": "电容",
            "terminalCount": 2,
            "defaults": {
                "capacitance": 0.001,
                "integrationMethod": "auto",
                "prevCurrent": 0
            }
        },
        "Inductor": {
            "type": "Inductor",
            "displayName": "电感",
            "terminalCount": 2,
            "defaults": {
                "inductance": 0.1,
                "initialCurrent": 0,
                "prevCurrent": 0,
                "prevVoltage": 0,
                "integrationMethod": "auto"
            }
        },
        "ParallelPlateCapacitor": {
            "type": "ParallelPlateCapacitor",
            "displayName": "平行板电容",
            "terminalCount": 2,
            "defaults": {
                "plateArea": 0.01,
                "plateDistance": 0.001,
                "dielectricConstant": 1,
                "plateOffsetYPx": 0,
                "explorationMode": true,
                "capacitance": 8.854e-11,
                "integrationMethod": "auto",
                "prevCurrent": 0
            }
        },
        "Motor": {
            "type": "Motor",
            "displayName": "电动机",
            "terminalCount": 2,
            "defaults": {
                "resistance": 5,
                "torqueConstant": 0.1,
                "emfConstant": 0.1,
                "inertia": 0.01,
                "loadTorque": 0.01
            }
        },
        "Switch": {
            "type": "Switch",
            "displayName": "开关",
            "terminalCount": 2,
            "defaults": {
                "closed": false
            }
        },
        "SPDTSwitch": {
            "type": "SPDTSwitch",
            "displayName": "单刀双掷开关",
            "terminalCount": 3,
            "defaults": {
                "position": "a",
                "onResistance": 1e-9,
                "offResistance": 1000000000000
            }
        },
        "Fuse": {
            "type": "Fuse",
            "displayName": "保险丝",
            "terminalCount": 2,
            "defaults": {
                "ratedCurrent": 3,
                "i2tThreshold": 1,
                "i2tAccum": 0,
                "coldResistance": 0.05,
                "blownResistance": 1000000000000,
                "blown": false
            }
        },
        "Ammeter": {
            "type": "Ammeter",
            "displayName": "电流表",
            "terminalCount": 2,
            "defaults": {
                "resistance": 0,
                "range": 3,
                "selfReading": false
            }
        },
        "Voltmeter": {
            "type": "Voltmeter",
            "displayName": "电压表",
            "terminalCount": 2,
            "defaults": {
                "resistance": Infinity,
                "range": 15,
                "selfReading": false
            }
        },
        "BlackBox": {
            "type": "BlackBox",
            "displayName": "黑箱",
            "terminalCount": 2,
            "defaults": {
                "boxWidth": 180,
                "boxHeight": 110,
                "viewMode": "transparent"
            }
        }
    }).map(([type, definition]) => [type, freezeDefinition(type, definition)])
));

export const COMPONENT_DEFINITION_REGISTRY = COMPONENT_DEFINITION_REGISTRY_INTERNAL;

export function listComponentDefinitionTypes() {
    return Object.keys(COMPONENT_DEFINITION_REGISTRY);
}

export function getComponentDefinition(type) {
    const key = String(type || '');
    const definition = COMPONENT_DEFINITION_REGISTRY[key];
    if (!definition) return null;
    return {
        type: definition.type,
        displayName: definition.displayName,
        terminalCount: definition.terminalCount,
        defaults: clonePlainValue(definition.defaults)
    };
}

export function requireComponentDefinition(type) {
    const definition = getComponentDefinition(type);
    if (!definition) {
        throw new Error(`Unknown component type: ${String(type || '')}`);
    }
    return definition;
}

export function buildComponentDefaultsMap() {
    const defaults = {};
    for (const type of listComponentDefinitionTypes()) {
        defaults[type] = getComponentDefinition(type).defaults;
    }
    return defaults;
}

export function buildComponentDisplayNameMap() {
    const names = {};
    for (const type of listComponentDefinitionTypes()) {
        names[type] = COMPONENT_DEFINITION_REGISTRY[type].displayName;
    }
    return names;
}

export function buildComponentTerminalCountMap() {
    const terminalCounts = {};
    for (const type of listComponentDefinitionTypes()) {
        terminalCounts[type] = COMPONENT_DEFINITION_REGISTRY[type].terminalCount;
    }
    return terminalCounts;
}
