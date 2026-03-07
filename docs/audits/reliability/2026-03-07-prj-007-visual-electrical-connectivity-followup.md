# PRJ-007 Visual/Electrical Connectivity Follow-up

## 基本信息

- Date: 2026-03-07
- Owner: Codex
- Scope: `PRJ-007 视觉连通 / 电气节点并入 follow-up`
- Related IDs: `PRJ-007`

## 审计目标

- 验证“看起来已经连上”的分段导线路径，是否会在拓扑重建时稳定并入同一电气节点。
- 把此前缺少直接证据的 `seed-hypothesis` 收敛为明确的 topology contract。
- 同时复核导线压缩后的 remap 链路，避免 UI 仍指向旧 wireId 造成“视觉已连 / 内部未跟上”的错觉。

## 本轮新增证据

在 `tests/circuit.topologyService.spec.js` 中新增联合场景：

1. 构造两段首尾相接的导线，中间通过同一 junction 形成连续视觉路径；
2. 两端导线分别通过 `aRef / bRef` 绑定到元器件端子，且初始坐标故意设置为陈旧值；
3. 调用 `CircuitTopologyService.rebuild()`；
4. 断言 `syncWireEndpointsToTerminalRefs()` 会先把端子引用同步回真实端子坐标；
5. 断言分段导线路径最终把两个端子并入同一 electrical node，且两段 wire 的 `nodeIndex` 一致。

这条合同与已有保护共同组成闭环：

- `tests/circuit.syncWireRefs.spec.js`：保护 terminal ref 同步与 id 归一化；
- `tests/topology.nodeBuilder.spec.js`：保护同坐标连接会映射到同一节点；
- `tests/interaction.mouseLeaveHandlers.spec.js` / `tests/interaction.mouseUpHandlers.spec.js`：保护 endpoint drag + compaction 后活动 wire 起点会 remap 到新 wire；
- `tests/circuit.observationProbes.spec.js`：保护 compaction 后 probe 不会挂在被删除的旧 wireId 上。

## 新鲜验证

- `npm test -- tests/circuit.topologyService.spec.js`
- `npm test -- tests/circuit.topologyService.spec.js tests/circuit.syncWireRefs.spec.js tests/topology.nodeBuilder.spec.js tests/interaction.mouseLeaveHandlers.spec.js tests/interaction.mouseUpHandlers.spec.js tests/circuit.observationProbes.spec.js`

结果：通过。

## 结论

- 本工作树内，没有复现出“视觉已连通但电气节点未并入”的真实反例。
- 相反，当前已具备从 terminal ref 同步、junction 并查、drag/compaction remap 到 probe 跟随迁移的一整条保护证据链。
- 因此 `PRJ-007` 可从 `seed-hypothesis` 收口为 `covered`：它的开放原因是此前缺少直接联合证据，而不是当前代码仍存在已知未控的连通性缺口。
