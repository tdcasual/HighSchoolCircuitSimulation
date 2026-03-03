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
- Legacy `ObservationPanel` module is removed from runtime/test paths and must not be reintroduced.

## Consequences

Positive:
- Removes dual-contract ambiguity in runtime and E2E.
- Makes regression gates align with actual production path.

Trade-off:
- Any test or script that depends on `app.observationPanel` is a contract violation and must fail CI.
- Some historical docs need correction to avoid mixed terminology.

## Rollback

If `ChartWorkspace` proves insufficient for required mobile observation flows, introduce an explicit compatibility shim with documented lifecycle.
Do not silently switch contract targets in E2E or docs.
