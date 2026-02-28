# Observation UI Audit (v2)

## Scope

- Observation state schema migration (`ui.mode`, `collapsedCards`, `showGaugeSection`)
- Basic/Advanced mode switch and quick presets (`U-t`, `I-t`, `P-t`)
- Plot card interaction extraction and chart touch interaction (hold-to-freeze)
- Mobile hardening: phone-mode control collapse and sticky top controls
- Render lifecycle deduplication and touch regression script

## Verified Behaviors

- Backward-compatible state normalization keeps legacy saves readable.
- Mode/preset toolbar renders in panel and round-trips via panel JSON state.
- Plot control events are centralized through `ObservationPlotCardController`.
- Touch long-press freezes chart readout and second tap can resume interaction.
- In phone layout + basic mode, plot controls default to collapsed.
- `requestRender` avoids duplicate RAF scheduling during batched updates.

## Regression Evidence

### Unit tests

```bash
npm test -- tests/observationState.spec.js \
  tests/observationMath.spec.js \
  tests/observationSources.spec.js \
  tests/observationPanel.quickBind.spec.js \
  tests/observationPanel.sampleCache.spec.js \
  tests/observationPanel.uxMode.spec.js \
  tests/observationPlotCardController.spec.js \
  tests/observationChartInteraction.spec.js \
  tests/observationPanel.mobileUx.spec.js \
  tests/observationPanel.renderLifecycle.spec.js
```

### Mobile touch E2E

```bash
node scripts/e2e/observation-touch-regression.mjs
```

Artifacts (on CI failure): `output/e2e/observation-touch`.

## Notes

- Card collapse override is session-level; persisted card IDs may become stale after full panel reconstruction.
- Quick preset source selection prefers selected component, then selected-wire probe.
