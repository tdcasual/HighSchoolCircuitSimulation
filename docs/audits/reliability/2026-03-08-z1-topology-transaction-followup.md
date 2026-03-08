# Z1 Topology Transaction Follow-up

- Date: 2026-03-08
- Area: `Z1`
- Scope: `PRJ-005`, `PRJ-006`
- Status: `covered`

## Closed Items

### PRJ-005
- Outcome: `Circuit.compactWires()` 现在在批外自动包裹 topology batch，确保 compaction / rebuild / publish 一次性提交。
- Root Cause: compaction 会先修改 wire map，但不会同步触发 topology publish，导致 `topologyVersion` 与真实线路图短暂漂移。
- Fix Location:
  - `src/core/runtime/Circuit.js`
- Evidence:
  - `tests/circuit.topologyBatch.spec.js`

### PRJ-006
- Outcome: compaction 前会显式失效组件连通性缓存，再在 publish 点统一刷新连接视图。
- Root Cause: `WireCompactor` 修改导线集合时，没有固定 `ConnectivityCache` 的失效时机。
- Fix Location:
  - `src/core/runtime/Circuit.js`
  - `src/core/topology/ConnectivityCache.js`
- Evidence:
  - `tests/topology.connectivityCache.spec.js`
  - `tests/circuit.topologyBatch.spec.js`

## Verification

- `npm test -- tests/circuit.topologyBatch.spec.js tests/topology.connectivityCache.spec.js`
