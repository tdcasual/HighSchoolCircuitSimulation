# ADR: Observation Runtime Source of Truth

- Date: 2026-03-03
- Status: Accepted
- Owner: Runtime/UI

## Context

Observation UI recently moved from side-panel based `ObservationPanel` to floating-window `ChartWorkspace`.
The runtime entry already initializes `app.chartWorkspace`, while some tests and docs still reference `app.observationPanel`.
This mismatch causes false regressions and unstable release gates.

## Decision

`ChartWorkspace` is the only runtime source of truth for observation behavior.

- Runtime contract: `window.app.chartWorkspace` must exist after bootstrap.
- Bootstrap must not expose `window.app` when `createApp()` does not provide `chartWorkspace`.
- New E2E tests must assert behavior through `chartWorkspace` APIs and state.
- `ObservationPanel` code can remain as migration asset, but it is not a runtime contract target.

## Consequences

Positive:
- Removes dual-contract ambiguity in runtime and E2E.
- Makes regression gates align with actual production path.

Trade-off:
- Legacy test code depending on `app.observationPanel` must be migrated.
- Some historical docs need correction to avoid mixed terminology.

## Rollback

If `ChartWorkspace` proves insufficient for required mobile observation flows, introduce an explicit compatibility shim with documented lifecycle.
Do not silently switch contract targets in E2E or docs.
