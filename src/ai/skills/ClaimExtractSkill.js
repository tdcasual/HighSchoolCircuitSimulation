/**
 * ClaimExtractSkill.js
 * Extract numeric claims (current/voltage/power) from LLM answer text.
 */

function normalizeToken(value) {
    return String(value || '').trim().toUpperCase();
}

function buildComponentIndex(circuit) {
    const index = [];
    if (!circuit || !(circuit.components instanceof Map)) {
        return index;
    }
    for (const component of circuit.components.values()) {
        if (!component) continue;
        const tokens = [component.label, component.id]
            .map(token => String(token || '').trim())
            .filter(Boolean);
        for (const token of tokens) {
            index.push({
                token,
                normalizedToken: normalizeToken(token),
                id: component.id || '',
                label: component.label || component.id || '',
                type: component.type || ''
            });
        }
    }
    return index.sort((left, right) => right.normalizedToken.length - left.normalizedToken.length);
}

function findComponentInContext(contextText, componentIndex = []) {
    const normalizedContext = normalizeToken(contextText);
    for (const component of componentIndex) {
        if (!component.normalizedToken) continue;
        if (normalizedContext.includes(component.normalizedToken)) {
            return component;
        }
    }
    return null;
}

function resolveUnit(rawUnit = '') {
    const unit = String(rawUnit || '').trim();
    switch (unit) {
        case 'mA':
            return { quantity: 'current', unit: 'A', scale: 1 / 1000 };
        case 'A':
            return { quantity: 'current', unit: 'A', scale: 1 };
        case 'mV':
            return { quantity: 'voltage', unit: 'V', scale: 1 / 1000 };
        case 'V':
            return { quantity: 'voltage', unit: 'V', scale: 1 };
        case 'mW':
            return { quantity: 'power', unit: 'W', scale: 1 / 1000 };
        case 'W':
            return { quantity: 'power', unit: 'W', scale: 1 };
        default:
            return null;
    }
}

export const ClaimExtractSkill = {
    name: 'claim_extract',

    run(input = {}, _context = {}) {
        const answer = String(input.answer || '').trim();
        if (!answer) return [];

        const componentIndex = buildComponentIndex(input.circuit);
        const claims = [];
        const pattern = /(-?\d+(?:\.\d+)?)\s*(mA|A|mV|V|mW|W)\b/g;
        let match;
        while ((match = pattern.exec(answer)) !== null) {
            const rawValue = Number(match[1]);
            if (!Number.isFinite(rawValue)) continue;
            const resolved = resolveUnit(match[2]);
            if (!resolved) continue;

            const start = Math.max(0, match.index - 40);
            const end = Math.min(answer.length, pattern.lastIndex + 24);
            const snippet = answer.slice(start, end);
            const component = findComponentInContext(snippet, componentIndex);
            claims.push({
                id: `claim_${claims.length + 1}`,
                quantity: resolved.quantity,
                value: rawValue * resolved.scale,
                unit: resolved.unit,
                rawValue,
                rawUnit: String(match[2]),
                snippet: snippet.trim(),
                component: component ? {
                    id: component.id,
                    label: component.label,
                    type: component.type,
                    token: component.token
                } : null
            });
            if (claims.length >= 24) break;
        }
        return claims;
    }
};
