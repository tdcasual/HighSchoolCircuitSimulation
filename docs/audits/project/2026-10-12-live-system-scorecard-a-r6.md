# Live-system scorecard A — V2 tick has no V1 fallback — 2026-10-12

- Auditor: implementer (Grok)
- Tree: working tree on `execute-plan/04d93759-pr-6-featruntime-default-solverbackendv2-with-same-subs`.
- Includes: previous R5 plus **invalid V2 substep stays invalid; loop no longer restoreStandby / setCircuit / commitV1Substep on the V2 arm**.
- Parent: `2026-10-12-live-system-scorecard-a-r5.md` (综合 **8.3**).
- Policy: record the live object graph. Do not invent a matching second-auditor score. Explicit `mode=v1` / shadow / embed pin still use V1.

## Scores

| 维度 | C10/C11 leftovers | **no V2→V1 fallback** |
|---|---:|---:|
| 架构整洁度 | 8.4 | **8.6** |
| 健壮性 | 8.0 | **7.8** |
| 解耦程度 | 8.2 | **8.4** |
| 可扩展性 | 8.4 | **8.4** |
| 可维护性 | 8.5 | **8.6** |
| 兼容性代价（越低越好） | 5.0 | **4.6** |
| **综合** | **8.3** | **8.4** |

综合 = (8.6+7.8+8.4+8.4+8.6)/5 = 8.36 → **8.4**

## Live evidence

- `CircuitSimulationLoopService` V2 arm: valid → advance simTime; invalid → `{valid:false, backendUsed:'v2'}` and `break`. No `restoreStandby`, no `context.solver`, no `commitV1Substep`.
- Shipped tests: invalid V2 leaves `circuit._solver === null`, `fallbackCount === 0`, `simTime` unadvanced for that substep; next wall-clock V2 success still solves 3V/8Ω at 0.3A.
- `mode === 'v1'` and `shadow` still `ensureSolverPrepared` + `commitV1Substep`. Embed without `solver=` still pins v1.
- `wrapSolverBackend` still calls `restoreStandby` on valid v2. Interaction is still one prototype.
- Shared stamps / LU / nodes / ViewMap readers unchanged from R5.

## Dimension judgments

- **架构整洁度 8.6:** Classroom default tick is one injected kernel. V1 remains a separate mode, not a silent twin on failure.
- **健壮性 7.8:** Losing same-substep recovery means a singular V2 substep stays invalid instead of finishing on V1. That is less defensive, and it is a real coverage loss.
- **解耦程度 8.4:** V2 fail path no longer mutates Circuit through `context.solver`. Remaining: wrap restoreStandby on success; Interaction shared `this`; dual NodeBuilder options.
- **可扩展性 8.4:** Unchanged stamp/LU table. Type switches in prepare/AI remain.
- **可维护性 8.6:** V2 loop arm is one success/fail pair. v1/shadow still share the same service file.
- **兼容性代价 4.6:** Soak fallback is gone. Explicit v1/shadow/embed remain.

## Explicit >8.0 judgment

**综合 8.4 is > 8.0.** Remaining debt is wrap standby on success, Interaction shared prototype, and explicit V1 mode.
