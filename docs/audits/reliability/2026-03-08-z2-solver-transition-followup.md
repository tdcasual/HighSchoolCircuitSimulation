# Z2 Solver Transition Follow-up

- Date: 2026-03-08
- Area: `Z2`
- Scope: `PRJ-011`
- Status: `covered`

## Closed Item

### PRJ-011
- Outcome: adaptive timestep 现在按 outer step 决策一次，并使用该 step 中“最难”的 substep 结果作为缩放依据；AC 子步进不再在单个 outer step 内重复累加 easy-streak，从而避免切换点跳变。
- Root Cause: adaptive dt 之前在每个成功 substep 后都立即更新，AC 场景下一个 outer step 会被重复记作多个“easy solve”，导致 dt 放大速度远快于实际仿真推进节奏。
- Fix Location:
  - `src/core/services/CircuitSimulationLoopService.js`
  - `src/core/runtime/Circuit.js`
- Evidence:
  - `tests/circuit.acSubstep.spec.js`
  - `tests/circuit.adaptiveTimestep.spec.js`
  - `tests/solver.dynamicIntegration.spec.js`

## Verification

- `npm test -- tests/circuit.acSubstep.spec.js tests/circuit.adaptiveTimestep.spec.js tests/solver.dynamicIntegration.spec.js`
