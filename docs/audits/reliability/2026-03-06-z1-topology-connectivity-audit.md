# Z1 Topology Connectivity Audit

- Date: 2026-03-06
- Area: `Z1`
- Scope: 拓扑版本、批处理提交、缓存失效顺序
- Related PRJs: `PRJ-005`, `PRJ-006`

## Findings

### PRJ-005
- 现象：`topologyVersion` 与 `solverCircuitDirty` 在 batch 结束前后可能不同步。
- 风险：求解器读取到半提交拓扑状态。
- 证据入口：`src/core/runtime/Circuit.js`, `tests/circuit.topologyBatch.spec.js`

### PRJ-006
- 现象：`WireCompactor` 与 `ConnectivityCache` 的失效顺序未固定。
- 风险：压缩后缓存仍引用旧连通性图。
- 证据入口：`src/core/topology/WireCompactor.js`, `src/core/topology/ConnectivityCache.js`

## Related Follow-up
- `docs/audits/reliability/2026-03-07-prj-007-visual-electrical-connectivity-followup.md`

## Current Status
- 审计完成，待执行事务化提交流程整改。
