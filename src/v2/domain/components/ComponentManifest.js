const COMPONENT_MANIFEST_V2_INTERNAL = Object.freeze({
    Ground: Object.freeze({
        displayName: '接地',
        terminalCount: 1,
        defaults: Object.freeze({
            isReference: true
        })
    }),
    PowerSource: Object.freeze({
        displayName: '电源',
        terminalCount: 2,
        defaults: Object.freeze({
            voltage: 12,
            internalResistance: 0.5
        })
    }),
    ACVoltageSource: Object.freeze({
        displayName: '交流电源',
        terminalCount: 2,
        defaults: Object.freeze({
            rmsVoltage: 12,
            frequency: 50,
            phase: 0,
            offset: 0,
            internalResistance: 0.5
        })
    }),
    Resistor: Object.freeze({
        displayName: '定值电阻',
        terminalCount: 2,
        defaults: Object.freeze({
            resistance: 100
        })
    }),
    Diode: Object.freeze({
        displayName: '二极管',
        terminalCount: 2,
        defaults: Object.freeze({
            forwardVoltage: 0.7,
            onResistance: 1,
            offResistance: 1e9,
            conducting: false
        })
    }),
    LED: Object.freeze({
        displayName: '发光二极管',
        terminalCount: 2,
        defaults: Object.freeze({
            forwardVoltage: 2,
            onResistance: 2,
            offResistance: 1e9,
            ratedCurrent: 0.02,
            color: '#ff4d6d',
            conducting: false,
            brightness: 0
        })
    }),
    Thermistor: Object.freeze({
        displayName: '热敏电阻',
        terminalCount: 2,
        defaults: Object.freeze({
            resistanceAt25: 1000,
            beta: 3950,
            temperatureC: 25
        })
    }),
    Photoresistor: Object.freeze({
        displayName: '光敏电阻',
        terminalCount: 2,
        defaults: Object.freeze({
            resistanceDark: 100000,
            resistanceLight: 500,
            lightLevel: 0.5
        })
    }),
    Relay: Object.freeze({
        displayName: '继电器',
        terminalCount: 4,
        defaults: Object.freeze({
            coilResistance: 200,
            pullInCurrent: 0.02,
            dropOutCurrent: 0.01,
            contactOnResistance: 1e-3,
            contactOffResistance: 1e12,
            energized: false
        })
    }),
    Rheostat: Object.freeze({
        displayName: '滑动变阻器',
        terminalCount: 3,
        defaults: Object.freeze({
            minResistance: 0,
            maxResistance: 100,
            position: 0.5,
            connectionMode: 'none',
            activeResistance: 0,
            resistanceDirection: 'disconnected'
        })
    }),
    Bulb: Object.freeze({
        displayName: '灯泡',
        terminalCount: 2,
        defaults: Object.freeze({
            resistance: 50,
            ratedPower: 5
        })
    }),
    Capacitor: Object.freeze({
        displayName: '电容',
        terminalCount: 2,
        defaults: Object.freeze({
            capacitance: 0.001,
            integrationMethod: 'auto',
            prevCurrent: 0
        })
    }),
    Inductor: Object.freeze({
        displayName: '电感',
        terminalCount: 2,
        defaults: Object.freeze({
            inductance: 0.1,
            initialCurrent: 0,
            prevCurrent: 0,
            prevVoltage: 0,
            integrationMethod: 'auto'
        })
    }),
    ParallelPlateCapacitor: Object.freeze({
        displayName: '平行板电容',
        terminalCount: 2,
        defaults: Object.freeze({
            plateArea: 0.01,
            plateDistance: 0.001,
            dielectricConstant: 1,
            plateOffsetYPx: 0,
            explorationMode: true,
            capacitance: 8.854e-11,
            integrationMethod: 'auto',
            prevCurrent: 0
        })
    }),
    Motor: Object.freeze({
        displayName: '电动机',
        terminalCount: 2,
        defaults: Object.freeze({
            resistance: 5,
            torqueConstant: 0.1,
            emfConstant: 0.1,
            inertia: 0.01,
            loadTorque: 0.01
        })
    }),
    Switch: Object.freeze({
        displayName: '开关',
        terminalCount: 2,
        defaults: Object.freeze({
            closed: false
        })
    }),
    SPDTSwitch: Object.freeze({
        displayName: '单刀双掷开关',
        terminalCount: 3,
        defaults: Object.freeze({
            position: 'a',
            onResistance: 1e-9,
            offResistance: 1e12
        })
    }),
    Fuse: Object.freeze({
        displayName: '保险丝',
        terminalCount: 2,
        defaults: Object.freeze({
            ratedCurrent: 3,
            i2tThreshold: 1,
            i2tAccum: 0,
            coldResistance: 0.05,
            blownResistance: 1e12,
            blown: false
        })
    }),
    Ammeter: Object.freeze({
        displayName: '电流表',
        terminalCount: 2,
        defaults: Object.freeze({
            resistance: 0,
            range: 3,
            selfReading: false
        })
    }),
    Voltmeter: Object.freeze({
        displayName: '电压表',
        terminalCount: 2,
        defaults: Object.freeze({
            resistance: Infinity,
            range: 15,
            selfReading: false
        })
    }),
    BlackBox: Object.freeze({
        displayName: '黑箱',
        terminalCount: 2,
        defaults: Object.freeze({
            boxWidth: 180,
            boxHeight: 110,
            viewMode: 'transparent'
        })
    })
});

function cloneDefaults(defaults = {}) {
    const cloneValue = (value) => {
        if (value == null) return value;
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            return value;
        }
        if (Array.isArray(value)) {
            return value.map((item) => cloneValue(item));
        }
        if (typeof value === 'object') {
            const output = {};
            for (const [key, nested] of Object.entries(value)) {
                output[key] = cloneValue(nested);
            }
            return output;
        }
        return undefined;
    };
    return cloneValue(defaults);
}

export const COMPONENT_MANIFEST_V2 = COMPONENT_MANIFEST_V2_INTERNAL;

export function listComponentTypesV2() {
    return Object.keys(COMPONENT_MANIFEST_V2);
}

export function getComponentManifestV2(type) {
    const key = String(type || '');
    const manifest = COMPONENT_MANIFEST_V2[key];
    if (!manifest) {
        throw new Error(`Unknown component type: ${key}`);
    }
    return {
        ...manifest,
        defaults: cloneDefaults(manifest.defaults)
    };
}
