export const ObservationUIModes = Object.freeze({
    Basic: 'basic',
    Advanced: 'advanced'
});

export function normalizeObservationUI(raw = {}) {
    const mode = raw?.mode === ObservationUIModes.Advanced
        ? ObservationUIModes.Advanced
        : ObservationUIModes.Basic;
    const collapsedCards = Array.isArray(raw?.collapsedCards)
        ? raw.collapsedCards.filter((id) => typeof id === 'string' && id.trim())
        : [];
    return {
        mode,
        collapsedCards,
        showGaugeSection: raw?.showGaugeSection !== false
    };
}
