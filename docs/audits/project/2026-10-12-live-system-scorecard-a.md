# Live-system scorecard A — 2026-10-12

- Date: 2026-10-12
- Auditor: implementer (Grok), first pass
- Policy: **record-not-fix**. Eligible to change only after the second auditor confirms.
- HEAD: `49f0289d693cef5a4034e00e1dc895188f8c744d`
- Branch: `execute-plan/04d93759-pr-6-featruntime-default-solverbackendv2-with-same-subs`
- Dimensions: same 10-point live-system scale as `2026-10-10-architecture-audit.md` §11
- What is scored: the **running classroom object graph**, not the `src/v2/**` directory shape

## 1. Production path (live)

```
src/main.js
  → bootstrapV2({ AppClass: AppRuntimeV2 })
      injects createInjectedSolverBackend()   // DEFAULT_SOLVER_BACKEND_MODE = 'v2'
  → AppRuntimeV2
      Circuit + SimulationDriver(10ms) + Renderer + InteractionManager
      wrapSolverBackend(options.solverBackend)
  → CircuitSimulationLoopService.runStep
      mode v2: backend.solveFrame → on invalid, restoreStandby + V1 substep
                + commitStandbyFromCircuit
      live nodes: production NodeBuilder (Circuit.rebuildNodes)
      v2 nodes: NodeBuilderV2 inside TopologyCoordinatorV2 (snapshot, not live SOT)
```

Exclusive CI still holds: `src/app|ui|core|embed` contain neither `SolveCircuitV2` nor `runSimulationStepV2`.

## 2. Size / mixins (measured)

| File | Lines | Hard budget |
|---|---:|---:|
| `src/core/runtime/Circuit.js` | 1078 | 1400 |
| `src/core/simulation/MNASolver.js` | 485 | 650 |
| `src/v2/simulation/SolveCircuitV2.js` | 516 | 800 |
| `src/app/AppRuntimeV2.js` | 488 | 575 |
| `src/ui/Renderer.js` | 722 | (not in core-size list) |
| `src/ui/Interaction.js` | 29 | shell |
| `Object.assign(InteractionManagerClass.prototype` | **33** files under `src/ui/interaction/` | — |

## 3. Scorecard vs 2026-10-10

`综合` = mean of the first five dimensions (same arithmetic as 2026-10-10, which averaged to 5.6). 兼容性代价 is reported separately; **lower is better**.

| 维度 | 2026-10-10 | **A (this HEAD)** | Why the delta |
|---|---:|---:|---|
| 架构整洁度 | 5.5 | **6.2** | Wiring A is a real seam (bootstrap injects a duck-type backend; AppRuntimeV2 never imports `src/v2`). Default classroom solver is V2. Circuit remains a god object; 33 mixins remain; dual node SOT remains. |
| 健壮性 | 7.0 | **7.6** | Same-substep V1 fallback + `commitStandbyFromCircuit` (consecutive fallbacks chain). Stamp-parity / exclusive / P0 + P0-ext exist. `solveFrame` and the v2 branch of `runStep` still `catch (_)` and convert exceptions into `{valid:false}`, so stamp bugs can look like a quiet fallback. |
| 解耦程度 | 4.5 | **5.2** | Duck-type backend is a seam. ViewMap is produced. Production wrap **never calls** `Renderer.setViewMap` (only tests do). Adapter still copies I/V/P (and dynamics) onto live components; Renderer falls back to `comp`. |
| 可扩展性 | 5.0 | **5.5** | Adding a solver backend is now a factory + duck type. Component registry / schema cover most types. New interaction still means another mixin. Type-specific rheostat/AC/fuse logic still lives on Circuit. |
| 可维护性 | 6.0 | **6.1** | File-size budgets hold. Dual live kernels must stay in stamp parity until KD20. `2026-10-12-next-issues.md` still tells readers not to switch production to V2, and still claims TopologyCoordinatorV2 drops wires — both false on this HEAD. Adapter sunset comment claims `setViewMap` is wired. |
| 兼容性代价（越低越好） | 6.5 | **6.0** | Dual kernels are required tax (KD20). Exclusive stays closed. Embed without `solver=` still pins v1 (KD7). No schema migrator for v2-and-below (by design). |
| **综合** | **5.6** | **6.1** | (6.2+7.6+5.2+5.5+6.1)/5 = 6.12 → 6.1 |

This is **not** > 8.0. Inflating it without a mixin/kernel rewrite would be a non-goal.

## 4. Findings (record only)

### F1 — ViewMap is produced but not attached to Renderer

- Sev: Med
- Where: `src/app/simulation/ComponentViewAdapter.js` `wrapSolverBackend`; `src/ui/Renderer.js` `setViewMap` / `resolveValueDisplayRecord`
- Evidence: `rg setViewMap` hits the adapter **comment**, `Renderer.setViewMap`, and tests. Production wrap copies onto `comp.currentValue` then returns. `Renderer.viewMap` stays `null`; every classroom value display increments `viewMapFallbackCount`.
- `tests/app.componentViewAdapter.spec.js` asserts the **source string** contains `'Renderer.setViewMap'` (the comment), not that wrap calls it.
- Slim-fix candidate (if confirmed): in wrap, on valid v2, `runtime.renderer?.setViewMap?.(result.viewMap)`. Keep the adapter until other readers migrate. Do not delete the adapter this round.

### F2 — Project audit docs are stale vs default-on V2

- Sev: Low / docs
- Where: `docs/audits/project/2026-10-12-next-issues.md`, `docs/audits/project/README.md`
- Evidence: next-issues still says 「不把生产切到 SolveCircuitV2」, 「TopologyCoordinatorV2 丢导线」, 「N10 P0-ext as next」, diode Ron/Roff fork. Live: `DEFAULT_SOLVER_BACKEND_MODE = 'v2'`; `TopologyCoordinatorV2.buildNetlist` passes `wires` into `NodeBuilderV2`; `package.json` has `baseline:p0:ext`.
- Slim-fix candidate: refresh next-issues / README against this HEAD. Do not rewrite closed `top30.md` status cells.

### F3 — Dual node source of truth

- Sev: High-arch
- Live connectivity: production `NodeBuilder` via `Circuit.rebuildNodes`. V2 snapshot topology: `NodeBuilderV2`. Adapter is forbidden from copying nodes (correct). Until R2, two builders.
- This round: **wontfix** (R2; non-goal to rewrite Circuit).

### F4 — Circuit god object + 33 mixins

- Sev: High-arch
- Circuit 1078 lines still owns add/remove, IO, rheostat, diagnostics, JSON, simulation control. Interaction.js is a 29-line shell.
- This round: **wontfix** (explicit non-goal).

### F5 — Dual solver kernels / V1 fallback

- Sev: High-arch (intentional)
- Default V2 with same-substep V1 fallback is the KD20 soak contract. Deleting V1 is a non-goal.
- This round: **wontfix**.

### F6 — Swallowed V2 exceptions become a silent fallback

- Sev: Low
- `createInjectedSolverBackend.solveFrame` `catch (_)` → `emptySolveResult()`. `CircuitSimulationLoopService` v2 branch also `catch (_)` → `{valid:false}` then V1. Classroom keeps running; a stamp throw never surfaces.
- Slim-fix candidate: count + one logger call on the existing `fallbackCount` path. Do not add a second flag or a new helper file. Skip if that is extra defense without a failing test.

### F7 — Adapter sunset comment names `circuit.lastViewMap`, which is never assigned

- Sev: Low
- `lastViewMap` appears only in the adapter comment and the cutover design doc.
- Slim-fix: tell the truth in the comment; optional `circuit.lastViewMap = result.viewMap` only if a shipped reader needs it. Do not invent a reader.

### F8 — `bootstrapV2` `catch (_)` around `addEventListener`

- Sev: Low / noise
- `registerBootstrapV2` swallows DOM registration errors. Existing pattern; adding more guards would be over-defense.
- Likely **wontfix**.

## 5. What would be required for 综合 > 8 (out of scope)

An honest > 8.0 on these dimensions needs Circuit façade split (R2), mixin retirement, and a single node SOT. Slim production-path edits (wire `setViewMap`, refresh stale docs, maybe log swallowed fallbacks) can move 综合 by a few tenths, not from 6.1 to 8.1.

If the second auditor agrees, this first pass should stay blocked on criterion 1 rather than invent 8.1.

## 6. Non-findings (do not “fix”)

- Exclusive CI forbidding `SolveCircuitV2` in production dirs — working as designed (Wiring A).
- Embed without `solver=` pinning v1 — KD7.
- SimulationDriver 10ms — non-goal.
- Linear bulb — M5, non-goal.
- Catch-all in `SafeStorage` / markdown sanitize / pointer capture — host APIs; not this audit’s production solver path.
