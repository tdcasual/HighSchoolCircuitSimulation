/**
 * NumericCheckSkill.js
 * Compare extracted numeric claims against current circuit simulation values.
 */

const TOLERANCE_BY_QUANTITY = Object.freeze({
    current: { abs: 0.02, rel: 0.08 },
    voltage: { abs: 0.05, rel: 0.05 },
    power: { abs: 0.1, rel: 0.1 }
});

function normalizeToken(value) {
    return String(value || '').trim().toUpperCase();
}

function buildMeasurementIndex(circuit) {
    const byToken = new Map();
    if (!circuit || !(circuit.components instanceof Map)) {
        return byToken;
    }
    for (const component of circuit.components.values()) {
        if (!component) continue;
        const measurement = {
            id: component.id || '',
            label: component.label || component.id || '',
            type: component.type || '',
            current: Math.abs(Number(component.currentValue || 0)),
            voltage: Math.abs(Number(component.voltageValue || 0)),
            power: Math.abs(Number(component.powerValue || 0))
        };
        const tokens = [component.label, component.id]
            .map(token => normalizeToken(token))
            .filter(Boolean);
        for (const token of tokens) {
            if (!byToken.has(token)) {
                byToken.set(token, measurement);
            }
        }
    }
    return byToken;
}

function getTolerance(quantity, actualValue) {
    const policy = TOLERANCE_BY_QUANTITY[quantity] || { abs: 0.05, rel: 0.08 };
    return Math.max(policy.abs, Math.abs(actualValue || 0) * policy.rel);
}

export const NumericCheckSkill = {
    name: 'numeric_check',

    run(input = {}, _context = {}) {
        const claims = Array.isArray(input.claims) ? input.claims : [];
        if (claims.length === 0) return [];

        const byToken = buildMeasurementIndex(input.circuit);
        const checks = [];
        for (const claim of claims) {
            const quantity = String(claim?.quantity || '').trim();
            const unit = String(claim?.unit || '').trim();
            const expectedValue = Math.abs(Number(claim?.value || 0));
            const token = normalizeToken(claim?.component?.token || claim?.component?.label || claim?.component?.id);
            const measurement = token ? byToken.get(token) : null;
            if (!measurement) {
                checks.push({
                    claimId: claim?.id || '',
                    quantity,
                    unit,
                    expectedValue,
                    status: 'unmapped',
                    reason: '找不到对应元件'
                });
                continue;
            }

            const actualValue = Number(measurement[quantity]);
            if (!Number.isFinite(actualValue)) {
                checks.push({
                    claimId: claim?.id || '',
                    quantity,
                    unit,
                    expectedValue,
                    component: measurement,
                    status: 'missing-data',
                    reason: '元件数值不可用'
                });
                continue;
            }

            const delta = Math.abs(expectedValue - actualValue);
            const tolerance = getTolerance(quantity, actualValue);
            checks.push({
                claimId: claim?.id || '',
                quantity,
                unit,
                expectedValue,
                actualValue,
                delta,
                tolerance,
                component: measurement,
                status: delta <= tolerance ? 'verified' : 'mismatch'
            });
        }
        return checks;
    }
};
