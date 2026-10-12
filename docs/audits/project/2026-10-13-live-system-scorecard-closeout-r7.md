# Closeout R7 — both 综合 > 8.0 still unmet

Date: 2026-10-13
Branch: `execute-plan/04d93759-pr-6-featruntime-default-solverbackendv2-with-same-subs`

## Honest pair

| Round | A (implementer) | B (Codex) |
|---|---:|---:|
| R5 (pushed `5e7ecda`) | 8.3 | 7.9 |
| R6 (no V2→V1 fallback) | 8.4 | 7.4 |
| R7 (wrap stop + ViewMap dynamics) | **8.5** | **6.2** |

Criterion 1 requires both 综合 **> 8.0**. It is unmet. Do not invent a matching 8.1.

## What landed

- Default V2 invalid substep stays invalid (`backendUsed:'v2'`), does not construct `MNASolver`, and feeds adaptive dt.
- `wrapSolverBackend` is mode-only; it does not restore standby onto live components.
- `resolveComponentViewRecord` overlays fuse/motor/relay/diode dynamics; named readers and serialize use it.
- Stale `SolveCircuitV2` tests-only header and AGENTS fallback text aligned.

Gates: `npm run check` 305/1477; `baseline:p0` 20; `baseline:p0:ext` 6; exclusive ok; Circuit 506/1400.

## Why Codex did not pass 8.0

B-R7 measured the R7 facts as true, then scored against the original 2026-10-10 shape: mutable Circuit aggregate, dual kernels, type switches, dual NodeBuilder wrappers, Interaction one prototype. Those are plan non-goals (KD20 keep V1; do not split Interaction; no god-object rewrite). User declined rewrite-or-waive twice.

B-R5 on a weaker tree was 7.9; B-R7 is 6.2 on a slimmer tree. That is an independent scale swing, not a license to rewrite the scorecard.

## Blocked outcome

Honest pair **A-R7 8.5 / B-R7 6.2**. Further slim production-path edits will not lift Codex 综合 above 8.0 while Interaction mixins and the V1 kernel remain. Stop.
