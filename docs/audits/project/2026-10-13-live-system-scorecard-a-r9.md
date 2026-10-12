# Live-system scorecard A-R9 — V2 adaptive meta + leftover Circuit APIs

- Auditor: implementer (Grok)
- Tree: working tree on `execute-plan/04d93759-pr-6-featruntime-default-solverbackendv2-with-same-subs`.
- Parent: A-R8 综合 **8.7** / B-R8 综合 **7.8**.
- Policy: record the live object graph. Do not invent a matching second-auditor score.

B-R8 confirmed: classroom V2 `solveFrame` omitted `meta.iterations/maxIterations/converged`, so success-step adaptive grow had no kernel evidence; Circuit still constructed unused `ResultProjectionService` and `NetlistBuilder`.

## Scores

| 维度 | A-R8 | **A-R9** |
|---|---:|---:|
| 架构整洁度 | 8.9 | **9.0** |
| 健壮性 | 8.3 | **8.5** |
| 解耦程度 | 8.8 | **8.8** |
| 可扩展性 | 8.5 | **8.5** |
| 可维护性 | 8.8 | **8.9** |
| 兼容性代价（越低越好） | 3.6 | **3.5** |
| **综合** | **8.7** | **8.7** |

综合 = (9.0+8.5+8.8+8.5+8.9)/5 = 8.74 → **8.7**

## Live evidence

- `SolveCircuitV2` returns `meta: { converged, iterations, maxIterations }`. Factory copies `solveResult.meta` onto `solveFrame`.
- `tests/circuit.adaptiveTimestep.spec.js` drives shipped `createInjectedSolverBackend` (no mock frame): first step exposes `lastResults.meta.iterations > 0`; six easy linear steps grow `currentDt`.
- `Circuit.js` no longer imports or constructs `CircuitResultProjectionService` or `NetlistBuilder`. Classroom tick still does not write live I/U/P.
- Remaining: mutable Circuit document façade, dual NodeBuilder wrappers (v2 architecture CI), type switches, Interaction instance maps still `.call(this)`, V1 kernel on disk for tests/KD20.

## Explicit >8.0 judgment

**综合 8.7 is > 8.0.** Criterion 1 still needs the independent B score > 8.0 on this same tree.
