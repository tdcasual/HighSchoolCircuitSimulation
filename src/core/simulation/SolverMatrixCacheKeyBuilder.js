import { computeNtcThermistorResistance, computePhotoresistorResistance } from '../../utils/Physics.js';
import { resolveJunctionParameters } from './JunctionModel.js';

function formatMatrixKeyNumber(value) {
    if (!Number.isFinite(value)) {
        if (value === Infinity) return 'inf';
        if (value === -Infinity) return '-inf';
        return 'nan';
    }
    return Number(value).toPrecision(12);
}

function buildComponentCacheKeyParts(comp, options = {}) {
    const {
        simulationState = null,
        resolveDynamicIntegrationMethod = () => 'backward-euler'
    } = options;

    switch (comp.type) {
        case 'Resistor':
        case 'Bulb':
            return [`R:${formatMatrixKeyNumber(comp.resistance ?? 0)}`];
        case 'Thermistor':
            return [
                `R25:${formatMatrixKeyNumber(comp.resistanceAt25 ?? 1000)}`,
                `beta:${formatMatrixKeyNumber(comp.beta ?? 3950)}`,
                `tempC:${formatMatrixKeyNumber(comp.temperatureC ?? 25)}`,
                `R:${formatMatrixKeyNumber(computeNtcThermistorResistance(comp))}`
            ];
        case 'Photoresistor':
            return [
                `Rdark:${formatMatrixKeyNumber(comp.resistanceDark ?? 100000)}`,
                `Rlight:${formatMatrixKeyNumber(comp.resistanceLight ?? 500)}`,
                `light:${formatMatrixKeyNumber(comp.lightLevel ?? 0.5)}`,
                `R:${formatMatrixKeyNumber(computePhotoresistorResistance(comp))}`
            ];
        case 'Diode':
        case 'LED': {
            const state = simulationState && comp.id ? simulationState.get(comp.id) : null;
            const junctionVoltage = Number.isFinite(state?.junctionVoltage)
                ? state.junctionVoltage
                : (Number.isFinite(comp.junctionVoltage) ? comp.junctionVoltage : 0);
            const junctionCurrent = Number.isFinite(state?.junctionCurrent)
                ? state.junctionCurrent
                : (Number.isFinite(comp.junctionCurrent) ? comp.junctionCurrent : 0);
            const params = resolveJunctionParameters(comp);
            return [
                `n:${formatMatrixKeyNumber(params.idealityFactor)}`,
                `is:${formatMatrixKeyNumber(params.saturationCurrent)}`,
                `rs:${formatMatrixKeyNumber(params.seriesResistance)}`,
                `vj:${formatMatrixKeyNumber(junctionVoltage)}`,
                `ij:${formatMatrixKeyNumber(junctionCurrent)}`
            ];
        }
        case 'Rheostat':
            return [
                `minR:${formatMatrixKeyNumber(comp.minResistance ?? 0)}`,
                `maxR:${formatMatrixKeyNumber(comp.maxResistance ?? 0)}`,
                `pos:${formatMatrixKeyNumber(comp.position ?? 0.5)}`,
                `mode:${comp.connectionMode || 'none'}`
            ];
        case 'PowerSource':
        case 'ACVoltageSource':
            return [`rInt:${formatMatrixKeyNumber(comp.internalResistance ?? 0)}`];
        case 'Capacitor':
        case 'ParallelPlateCapacitor':
            return [
                `C:${formatMatrixKeyNumber(comp.capacitance ?? 0)}`,
                `method:${resolveDynamicIntegrationMethod(comp)}`
            ];
        case 'Inductor':
            return [
                `L:${formatMatrixKeyNumber(comp.inductance ?? 0)}`,
                `method:${resolveDynamicIntegrationMethod(comp)}`
            ];
        case 'Motor':
            return [`R:${formatMatrixKeyNumber(comp.resistance ?? 0)}`];
        case 'Switch':
            return [`closed:${comp.closed ? 1 : 0}`];
        case 'SPDTSwitch':
            return [
                `pos:${comp.position === 'b' ? 'b' : 'a'}`,
                `ron:${formatMatrixKeyNumber(comp.onResistance ?? 1e-9)}`,
                `roff:${formatMatrixKeyNumber(comp.offResistance ?? 1e12)}`
            ];
        case 'Relay':
            return [
                `Rcoil:${formatMatrixKeyNumber(comp.coilResistance ?? 200)}`,
                `Ion:${formatMatrixKeyNumber(comp.pullInCurrent ?? 0.02)}`,
                `Ioff:${formatMatrixKeyNumber(comp.dropOutCurrent ?? 0.01)}`,
                `Ron:${formatMatrixKeyNumber(comp.contactOnResistance ?? 1e-3)}`,
                `Roff:${formatMatrixKeyNumber(comp.contactOffResistance ?? 1e12)}`,
                `en:${comp.energized ? 1 : 0}`
            ];
        case 'Fuse':
            return [
                `blown:${comp.blown ? 1 : 0}`,
                `Rcold:${formatMatrixKeyNumber(comp.coldResistance ?? 0.05)}`,
                `Rblown:${formatMatrixKeyNumber(comp.blownResistance ?? 1e12)}`
            ];
        case 'Ammeter':
            return [`R:${formatMatrixKeyNumber(comp.resistance ?? 0)}`];
        case 'Voltmeter':
            return [`R:${formatMatrixKeyNumber(comp.resistance ?? Infinity)}`];
        default:
            return [];
    }
}

function buildSystemMatrixCacheKey(options = {}) {
    const {
        nodeCount = 0,
        voltageSourceCount = 0,
        gmin = 1e-12,
        dt = 0.001,
        hasConnectedSwitch = false,
        components = [],
        simulationState = null,
        resolveDynamicIntegrationMethod = () => 'backward-euler'
    } = options;

    const keyParts = [
        `nodes:${nodeCount}`,
        `vs:${voltageSourceCount}`,
        `gmin:${formatMatrixKeyNumber(gmin)}`,
        `dt:${formatMatrixKeyNumber(dt)}`,
        `switch:${hasConnectedSwitch ? 1 : 0}`
    ];

    for (const comp of components) {
        if (!comp) continue;

        const nodesPart = Array.isArray(comp.nodes)
            ? comp.nodes.map((nodeIdx) => (Number.isInteger(nodeIdx) ? String(nodeIdx) : 'x')).join(',')
            : '';

        keyParts.push(
            `id:${comp.id}`,
            `type:${comp.type}`,
            `short:${comp._isShorted ? 1 : 0}`,
            `n:${nodesPart}`,
            `vsIdx:${comp.vsIndex ?? 'x'}`,
            ...buildComponentCacheKeyParts(comp, {
                simulationState,
                resolveDynamicIntegrationMethod
            })
        );
    }

    return keyParts.join('|');
}

export { buildSystemMatrixCacheKey };
