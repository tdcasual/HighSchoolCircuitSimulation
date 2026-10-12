import { computeNtcThermistorResistance, computePhotoresistorResistance } from '../../utils/Physics.js';
import { resolveJunctionParameters } from './JunctionModelV2.js';

export const GMIN = 1e-12;
const PIVOT_EPSILON = 1e-15;

export function zeros(rows, cols) {
    return Array.from({ length: rows }, () => Array(cols).fill(0));
}

export function zeroVector(n) {
    return Array(n).fill(0);
}

export function factorize(A, options = {}) {
    const n = A.length;
    if (n === 0) {
        return { lu: [], pivot: [], n: 0, pivotEpsilon: PIVOT_EPSILON };
    }

    const pivotEpsilon = Number.isFinite(options.pivotEpsilon) ? options.pivotEpsilon : PIVOT_EPSILON;
    const lu = A.map((row) => [...row]);
    const pivot = Array.from({ length: n }, (_, idx) => idx);

    for (let col = 0; col < n; col++) {
        let maxRow = col;
        let maxVal = Math.abs(lu[col][col]);
        for (let row = col + 1; row < n; row++) {
            const val = Math.abs(lu[row][col]);
            if (val > maxVal) {
                maxVal = val;
                maxRow = row;
            }
        }
        if (maxVal < pivotEpsilon) return null;
        if (maxRow !== col) {
            [lu[col], lu[maxRow]] = [lu[maxRow], lu[col]];
            [pivot[col], pivot[maxRow]] = [pivot[maxRow], pivot[col]];
        }
        const pivotValue = lu[col][col];
        for (let row = col + 1; row < n; row++) {
            lu[row][col] /= pivotValue;
            const factor = lu[row][col];
            if (factor === 0) continue;
            for (let j = col + 1; j < n; j++) {
                lu[row][j] -= factor * lu[col][j];
            }
        }
    }

    return { lu, pivot, n, pivotEpsilon };
}

export function solveWithFactorization(factorization, b) {
    if (!factorization || !Array.isArray(factorization.lu) || !Array.isArray(factorization.pivot)) {
        return null;
    }
    const n = factorization.n;
    if (n === 0) return [];

    const lu = factorization.lu;
    const pivot = factorization.pivot;
    const pivotEpsilon = Number.isFinite(factorization.pivotEpsilon)
        ? factorization.pivotEpsilon
        : PIVOT_EPSILON;
    const y = new Array(n).fill(0);
    const x = new Array(n).fill(0);

    for (let i = 0; i < n; i++) {
        const rhs = b[pivot[i]] ?? 0;
        let sum = rhs;
        for (let j = 0; j < i; j++) {
            sum -= lu[i][j] * y[j];
        }
        y[i] = sum;
    }

    for (let i = n - 1; i >= 0; i--) {
        let sum = y[i];
        for (let j = i + 1; j < n; j++) {
            sum -= lu[i][j] * x[j];
        }
        const pivotValue = lu[i][i];
        if (Math.abs(pivotValue) < pivotEpsilon) return null;
        x[i] = sum / pivotValue;
    }

    for (let i = 0; i < n; i++) {
        if (!Number.isFinite(x[i])) x[i] = 0;
    }
    return x;
}

export function stampResistor(A, i1, i2, resistance) {
    let normalizedResistance = resistance;
    if (normalizedResistance <= 0) normalizedResistance = 1e-9;
    const conductance = 1 / normalizedResistance;
    if (i1 >= 0) A[i1][i1] += conductance;
    if (i2 >= 0) A[i2][i2] += conductance;
    if (i1 >= 0 && i2 >= 0) {
        A[i1][i2] -= conductance;
        A[i2][i1] -= conductance;
    }
}

export function stampCurrentSource(z, iFrom, iTo, current) {
    if (!Number.isFinite(current) || Math.abs(current) < 1e-18) return;
    if (iFrom >= 0) z[iFrom] -= current;
    if (iTo >= 0) z[iTo] += current;
}

export function stampVoltageSource(A, z, i1, i2, voltage, vsIndex, nodeCount) {
    if (!Number.isInteger(vsIndex) || vsIndex < 0) return;
    const equationRow = nodeCount - 1 + vsIndex;
    if (equationRow < 0 || equationRow >= A.length || !A[equationRow]) return;
    if (i1 >= 0) A[equationRow][i1] = 1;
    if (i2 >= 0) A[equationRow][i2] = -1;
    if (i1 >= 0) A[i1][equationRow] = 1;
    if (i2 >= 0) A[i2][equationRow] = -1;
    z[equationRow] = voltage;
}

export function stampSeriesVoltageSource(A, z, i1, i2, voltage, seriesR, vsIndex, nodeCount) {
    if (!Number.isInteger(vsIndex) || vsIndex < 0) return;
    const equationRow = nodeCount - 1 + vsIndex;
    if (equationRow < 0 || equationRow >= A.length || !A[equationRow]) return;
    const r = Math.max(Number(seriesR) || 0, 1e-12);
    if (i1 >= 0) A[equationRow][i1] = 1;
    if (i2 >= 0) A[equationRow][i2] = -1;
    A[equationRow][equationRow] = -r;
    if (i1 >= 0) A[i1][equationRow] = 1;
    if (i2 >= 0) A[i2][equationRow] = -1;
    z[equationRow] = voltage;
}

export function applyGmin(A, nodeCount, gmin = GMIN) {
    if (!(gmin > 0)) return;
    for (let i = 0; i < nodeCount - 1; i++) {
        if (A[i]) A[i][i] += gmin;
    }
}

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
        case 'Relay': {
            const relayState = simulationState && comp.id ? simulationState.get(comp.id) : null;
            const energized = typeof relayState?.energized === 'boolean'
                ? relayState.energized
                : !!comp.energized;
            return [
                `Rcoil:${formatMatrixKeyNumber(comp.coilResistance ?? 200)}`,
                `Ion:${formatMatrixKeyNumber(comp.pullInCurrent ?? 0.02)}`,
                `Ioff:${formatMatrixKeyNumber(comp.dropOutCurrent ?? 0.01)}`,
                `Ron:${formatMatrixKeyNumber(comp.contactOnResistance ?? 1e-3)}`,
                `Roff:${formatMatrixKeyNumber(comp.contactOffResistance ?? 1e12)}`,
                `en:${energized ? 1 : 0}`
            ];
        }
        case 'Fuse': {
            const fuseState = simulationState && comp.id ? simulationState.get(comp.id) : null;
            const blown = !!(fuseState?.blown || comp.blown);
            return [
                `blown:${blown ? 1 : 0}`,
                `Rcold:${formatMatrixKeyNumber(comp.coldResistance ?? 0.05)}`,
                `Rblown:${formatMatrixKeyNumber(comp.blownResistance ?? 1e12)}`
            ];
        }
        case 'Ammeter':
            return [`R:${formatMatrixKeyNumber(comp.resistance ?? 0)}`];
        case 'Voltmeter':
            return [`R:${formatMatrixKeyNumber(comp.resistance ?? Infinity)}`];
        default:
            return [];
    }
}

export function buildSystemMatrixCacheKey(options = {}) {
    const {
        nodeCount = 0,
        voltageSourceCount = 0,
        gmin = GMIN,
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
