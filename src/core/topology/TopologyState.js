function normalizeReplacementByRemovedId(value = {}) {
    if (!value || typeof value !== 'object') {
        return {};
    }

    const normalized = {};
    for (const [removedId, replacementId] of Object.entries(value)) {
        const from = String(removedId || '').trim();
        const to = String(replacementId || '').trim();
        if (!from || !to) continue;
        normalized[from] = to;
    }
    return normalized;
}

export function getTopologyStateSnapshot(context = {}) {
    return Object.freeze({
        version: Number.isFinite(context?.topologyVersion) ? Number(context.topologyVersion) : 0,
        pending: !!((context?.topologyBatchDepth || 0) > 0 || context?.topologyRebuildPending),
        replacementByRemovedId: Object.freeze(normalizeReplacementByRemovedId(context?.topologyReplacementByRemovedId))
    });
}

export function setTopologyReplacementState(context, replacementByRemovedId = {}) {
    if (!context || typeof context !== 'object') return getTopologyStateSnapshot();
    context.topologyReplacementByRemovedId = normalizeReplacementByRemovedId(replacementByRemovedId);
    return getTopologyStateSnapshot(context);
}
