# ADR: Interaction Mode Runtime Source of Truth

- Date: 2026-03-03
- Status: Accepted
- Owner: Runtime/UI

## Context

Interaction mode state historically mixed two paths:

1. runtime root flags (`interaction.*`)
2. mode store state (`interactionModeStore.context`)

The dual path caused compatibility burden and hidden fallback behavior.

## Decision

`interactionModeStore.context` is the only runtime source of truth for interaction mode.

- Runtime must not read mode fields from root interaction object when store is unavailable.
- Runtime must not mirror mode-context fields back to root interaction object.
- Root interaction object keeps only transient drag/session flags that are not mode state.

Canonical wire-mode context keys:

- `pendingTool`
- `mobileMode`
- `wireModeSticky`
- `wiringActive`

## Decommission Scope (Physically Removed Code)

The following legacy runtime mode fields are decommissioned and removed from runtime
initialization/seed/writeback paths:

- `pendingToolType`
- `mobileInteractionMode`
- `stickyWireTool`
- `isWiring`

No compatibility shim is retained for these fields in production runtime paths.

## Consequences

Positive:

- Removes dual-state ambiguity and compatibility tax.
- Makes mode behavior fully deterministic via store snapshots.
- Enables strict CI guardrails for regression prevention.

Trade-off:

- Any code path reintroducing root-field fallback is a contract violation and must fail CI.

## Rollback

If severe regression occurs, rollback by commit revert only.
Do not reintroduce root-field fallback logic as a hotfix path.
