# Wire Interaction Audit Workspace

This folder contains executable artifacts for the wire-interaction bug audit.

## Scope

- Domain: wire creation/snap/drag/release behavior
- Inputs: mouse, touch, pen
- View transforms: zoom/pan combinations
- Output: Top-20 prioritized findings (`WIR-###`) + regression mapping

## Severity Model

- `P0`: blocks core wiring workflow or causes high-probability misconnection
- `P1`: major usability degradation in common workflows
- `P2`: workaround exists, medium efficiency loss
- `P3`: low-frequency edge case

## Score Formula

`Score = Impact(1-5) × Frequency(1-5) × Unavoidable(1-3)`

- `Score >= 45`: Top20 candidate
- `25 <= Score < 45`: backlog candidate

## Artifacts

- `matrix.md`: exploration matrix and execution order
- `top20.md`: prioritized finding ledger
- `backlog.md`: non-Top20 findings
- `automation-map.md`: finding-to-test mapping

## Daily Runbook

1. Pick a matrix slice (`device × transform × stage × target × transition`).
2. Reproduce and capture evidence.
3. Record expected vs actual behavior.
4. Assign root-cause class and severity.
5. Score and place in Top20 or backlog.
6. Update automation mapping for P0/P1 items.

## Quality Gate (finding acceptance)

A finding is valid only if it has:

1. deterministic reproduction steps
2. expected and actual behavior
3. root-cause class (one of five)
4. severity and score
5. suggested fix location (file + function)
