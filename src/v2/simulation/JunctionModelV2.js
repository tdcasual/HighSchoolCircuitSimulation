const THERMAL_VOLTAGE_300K = 0.025865;
const EXP_MAX = 80;
const EXP_MIN = -80;

function clampExpInput(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(EXP_MIN, Math.min(EXP_MAX, value));
}

function resolveForwardVoltage(comp) {
    if (Number.isFinite(comp?.forwardVoltage) && comp.forwardVoltage >= 0) {
        return comp.forwardVoltage;
    }
    return comp?.type === 'LED' ? 2.0 : 0.7;
}

function resolveSeriesResistance(comp) {
    const defaultRs = comp?.type === 'LED' ? 2 : 1;
    const raw = Number(comp?.onResistance);
    if (Number.isFinite(raw) && raw >= 0) return raw;
    return defaultRs;
}

function resolveIdealityFactor(comp) {
    const defaultN = comp?.type === 'LED' ? 2.2 : 1.8;
    const raw = Number(comp?.idealityFactor);
    if (Number.isFinite(raw) && raw > 0) return raw;
    return defaultN;
}

function resolveReferenceCurrent(comp) {
    const raw = Number(comp?.referenceCurrent);
    if (Number.isFinite(raw) && raw > 0) return raw;
    if (comp?.type === 'LED') {
        const rated = Number(comp?.ratedCurrent);
        if (Number.isFinite(rated) && rated > 0) return rated;
        return 0.02;
    }
    return 0.001;
}

function deriveSaturationCurrent({ comp, vScale, forwardVoltage, referenceCurrent }) {
    const explicit = Number(comp?.saturationCurrent);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    if (!(vScale > 0) || !(forwardVoltage >= 0) || !(referenceCurrent > 0)) return 1e-12;
    const expInput = clampExpInput(forwardVoltage / vScale);
    const denom = Math.exp(expInput) - 1;
    if (!(denom > 0)) return 1e-12;
    const derived = referenceCurrent / denom;
    return Math.max(1e-30, Math.min(1, derived));
}

export function resolveJunctionParameters(comp = {}) {
    const idealityFactor = resolveIdealityFactor(comp);
    const vScale = Math.max(1e-6, idealityFactor * THERMAL_VOLTAGE_300K);
    const forwardVoltage = resolveForwardVoltage(comp);
    const referenceCurrent = resolveReferenceCurrent(comp);
    const saturationCurrent = deriveSaturationCurrent({
        comp,
        vScale,
        forwardVoltage,
        referenceCurrent
    });
    const seriesResistance = Math.max(0, resolveSeriesResistance(comp));
    const gmin = Math.max(1e-12, saturationCurrent * 0.01);
    const vcritArg = vScale / (Math.SQRT2 * saturationCurrent);
    const vcrit = vScale * Math.log(Math.max(vcritArg, 1 + 1e-12));

    return {
        idealityFactor,
        vScale,
        forwardVoltage,
        referenceCurrent,
        saturationCurrent,
        seriesResistance,
        gmin,
        vcrit
    };
}

function evaluateShockleyCurrent(vDiode, params) {
    const { saturationCurrent, vScale } = params;
    const expInput = clampExpInput(vDiode / vScale);
    return saturationCurrent * (Math.exp(expInput) - 1);
}

function evaluateShockleyConductance(vDiode, params) {
    const { saturationCurrent, vScale } = params;
    const expInput = clampExpInput(vDiode / vScale);
    return (saturationCurrent / vScale) * Math.exp(expInput);
}

export function limitJunctionStep(vNew, vOld, params) {
    if (!Number.isFinite(vNew)) return 0;
    if (!Number.isFinite(vOld)) return vNew;

    const vScale = Math.max(1e-6, params?.vScale || THERMAL_VOLTAGE_300K);
    const vcrit = Number.isFinite(params?.vcrit) ? params.vcrit : 0.6145;
    let limited = vNew;

    if (limited > vcrit && Math.abs(limited - vOld) > 2 * vScale) {
        if (vOld > 0) {
            const arg = 1 + (limited - vOld) / vScale;
            limited = arg > 0 ? (vOld + vScale * Math.log(arg)) : vcrit;
        } else {
            const ratio = Math.max(limited / vScale, 1e-12);
            limited = vScale * Math.log(ratio);
        }
    }

    return Number.isFinite(limited) ? limited : vOld;
}

export function solveJunctionCurrent(totalVoltage, params, initialCurrent = 0) {
    const { seriesResistance } = params;
    if (!(seriesResistance > 0)) {
        return evaluateShockleyCurrent(totalVoltage, params);
    }

    let current = Number.isFinite(initialCurrent) ? initialCurrent : 0;
    const voltage = Number.isFinite(totalVoltage) ? totalVoltage : 0;

    for (let iter = 0; iter < 8; iter++) {
        const vDiode = voltage - current * seriesResistance;
        const iDiode = evaluateShockleyCurrent(vDiode, params);
        const gDiode = evaluateShockleyConductance(vDiode, params);
        const f = current - iDiode;
        if (Math.abs(f) < 1e-14) break;
        const df = 1 + seriesResistance * gDiode;
        if (!(Math.abs(df) > 1e-18)) break;
        const next = current - f / df;
        if (!Number.isFinite(next)) break;
        if (Math.abs(next - current) < 1e-14) {
            current = next;
            break;
        }
        current = next;
    }

    return Number.isFinite(current) ? current : 0;
}

export function linearizeJunctionAt(totalVoltage, params, initialCurrent = 0) {
    const voltage = Number.isFinite(totalVoltage) ? totalVoltage : 0;
    const current = solveJunctionCurrent(voltage, params, initialCurrent);
    const { seriesResistance, gmin } = params;
    const vDiode = voltage - current * seriesResistance;
    const gDiode = evaluateShockleyConductance(vDiode, params);

    let conductance = gDiode;
    if (seriesResistance > 0) {
        conductance = gDiode / (1 + seriesResistance * gDiode);
    }
    conductance += gmin;

    const branchCurrent = current + gmin * voltage;
    const currentOffset = branchCurrent - conductance * voltage;

    return {
        current,
        conductance,
        currentOffset,
        diodeVoltage: vDiode
    };
}

export function evaluateJunctionCurrent(totalVoltage, compOrParams, initialCurrent = 0) {
    const params = compOrParams?.saturationCurrent
        ? compOrParams
        : resolveJunctionParameters(compOrParams);
    return solveJunctionCurrent(totalVoltage, params, initialCurrent);
}
