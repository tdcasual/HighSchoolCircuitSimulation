# PRJ-008 Batch Diagnostics Follow-up

## 基本信息

- Date: 2026-03-07
- Owner: Codex
- Scope: `PRJ-008 短路诊断 / 拓扑重建 / 仿真刷新顺序 follow-up`
- Related IDs: `PRJ-008`

## 审计目标

- 验证 topology batch 打开期间，runtime diagnostics 是否会偷偷 flush 拓扑重建。
- 避免在拓扑仍待刷新时输出基于陈旧 node graph 的 topology 诊断结论。
- 把这条开放项从“时序可能不一致”收敛到明确的 runtime contract。

## 本轮实现的 contract

在 `src/core/runtime/Circuit.js` 的 `collectRuntimeDiagnostics()` 中新增约束：

1. 当 `topologyBatchDepth > 0` 或 `topologyRebuildPending === true` 时，
2. runtime diagnostics 仍可基于 `results.meta`、short-circuit 状态等非 topology 信号构建结果，
3. 但会跳过 `validateSimulationTopology()`，
4. 并在返回 payload 中打上 `topologyValidationDeferred = true`。

这意味着：

- batch 期间不会为了诊断而提前 `rebuildNodes()`；
- UI / AI / 其他调用方如果读取到该标记，就知道 topology 结论尚未 final；
- `SINGULAR_MATRIX`、`SHORT_CIRCUIT` 这类基于结果/solver 信号的诊断仍可保留。

## 测试映射

- `tests/circuit.runtimeDiagnostics.spec.js`
  - 验证 batch 中调用 `collectRuntimeDiagnostics()` 不会 flush rebuild，且会返回 `topologyValidationDeferred = true`
- `tests/runtimeDiagnostics.pipeline.spec.js`
  - 验证 pipeline 会保留 collector 产出的 deferred marker 并挂到 `results.runtimeDiagnostics`
- `tests/circuit.topologyBatch.spec.js`
  - 保持 batch 生命周期与 pending rebuild 合同不变

## 新鲜验证

- `npm test -- tests/circuit.topologyBatch.spec.js tests/circuit.runtimeDiagnostics.spec.js tests/runtimeDiagnostics.pipeline.spec.js`

结果：通过。

## 结论

- 本工作树内，`PRJ-008` 可从 `seed-hypothesis` 收口为 `covered`。
- 这次收口不是证明“所有调用方都会等待拓扑结束”，而是把 runtime diagnostics 自身收紧为安全契约：
  - 不抢跑 rebuild
  - 不拿陈旧 topology 做最终判断
  - 明确告诉上层“拓扑校验已延后”
- 若后续要继续追更高层的一致性，只需围绕是否有调用方忽略 `topologyValidationDeferred` 做专项检查，而不必继续怀疑底层诊断顺序本身。
