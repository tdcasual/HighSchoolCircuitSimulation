# Live-system scorecard A — leftover assign + production adapter gone — 2026-10-12

- Auditor: implementer (Grok)
- Tree: working tree on `execute-plan/04d93759-pr-6-featruntime-default-solverbackendv2-with-same-subs`.
- Includes: previous R4 (wrap-stop, shared LU, lazy V1) plus **one production Interaction install site** and **`applyViewMapToComponents` removed from `src/`**.
- Parent: `2026-10-12-live-system-scorecard-a-r4.md` (综合 **8.2**).
- Policy: record the live object graph. Do not invent a matching second-auditor score. V1 kernel remains (KD20).

## Scores

| 维度 | wrap-stop + shared LU + lazy V1 | **C10/C11 leftovers** |
|---|---:|---:|
| 架构整洁度 | 8.3 | **8.4** |
| 健壮性 | 8.0 | **8.0** |
| 解耦程度 | 8.1 | **8.2** |
| 可扩展性 | 8.4 | **8.4** |
| 可维护性 | 8.4 | **8.5** |
| 兼容性代价（越低越好） | 5.2 | **5.0** |
| **综合** | **8.2** | **8.3** |

综合 = (8.4+8.0+8.2+8.4+8.5)/5 = 8.30 → **8.3**

## Live evidence

- `Circuit.js` **502** lines. `_solver` lazy. `Object.assign(InteractionManagerClass.prototype` **0**.
- Under `src/ui/interaction`, the only file that imports `assignInteractionMethods.js` (besides the helper) is `interactionMethodMaps.js`. WireSearch and Placement export maps only.
- `src/app/simulation/ComponentViewAdapter.js` exports `wrapSolverBackend` only. It does not contain `applyViewMapToComponents`. Shipped wrap test: live seed `currentValue` 9 stays 9. Copy helper lives in `tests/helpers/`.
- Shared stamps / junction / union-find / LU / cache-key unchanged from R4.
- V2 hot path skips V1 prepare and does not construct `MNASolver`. Fallback still restoreStandby → V1 substep.
- Named readers prefer `resolveComponentViewRecord`. Missing record still returns the live component.
- Interaction is still one prototype with shared `this`.

## Dimension judgments

- **架构整洁度 8.4:** Production tick is injected V2 + shared math/stamps/nodes + one Interaction install site + no live ViewMap copier. Circuit is still a mutable-document façade; V1 fallback branch remains in the loop service.
- **健壮性 8.0:** Same-substep fallback unchanged. Removing the unused copier does not add a failure mode.
- **解耦程度 8.2:** V2 success path does not stamp V1, construct V1, or copy ViewMap. Remaining: fallback mutates Circuit via `context.solver`; Interaction shared `this`; live NodeBuilder still writes `wire.nodeIndex`.
- **可扩展性 8.4:** Unchanged stamp/LU single table. Device-type switches remain in step init, topology, and AI copy.
- **可维护性 8.5:** Dead per-file installers and the unused production copier are gone. Circuit 502 / 1400. Bundle still under hard limit from R4.
- **兼容性代价 5.0:** Soak still keeps the V1 kernel and wrap restoreStandby. The display copier is no longer a production API.

## Explicit >8.0 judgment

**综合 8.3 is > 8.0.** This does not delete V1. Remaining debt is KD20 dual kernel (lazy), Interaction shared prototype, and dual node-wrapper options.
