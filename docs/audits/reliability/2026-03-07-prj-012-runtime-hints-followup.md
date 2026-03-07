# PRJ-012 Runtime Hints Follow-up

## 基本信息

- Date: 2026-03-07
- Owner: Codex
- Scope: `PRJ-012 runtime diagnostics 解释深度 / 近场反馈 follow-up`
- Related IDs: `PRJ-012`

## 审计目标

- 验证 runtime diagnostics 的 `hints` 是否真正落到 UI，而不只停留在内部 payload。
- 用最小实现把失败摘要扩展为“摘要 + 首条排查建议”的近场反馈。
- 为 `Z2 / Z5` 建立一条稳定的 UI 回归合同，避免重新退回“只有 summary”的状态。

## 本轮实现的 contract

在 `src/app/AppRuntimeV2.js` 的 `onCircuitUpdate()` 中新增约束：

1. invalid solve 或 `SHORT_CIRCUIT` 场景下，继续保留原有 `runtimeDiagnostics.summary` 投递；
2. 若存在 `runtimeDiagnostics.hints[0]`，则构建 `摘要 + 建议` 的运行时状态文案；
3. 该文案会同时投递到 `chartWorkspace.setRuntimeStatus()` 与 `updateStatus()`；
4. 若交互层可用，还会通过 `interaction.showStatusAction()` 暴露 `排查建议` 动作，避免提示只停留在纯摘要层。

这意味着：

- 诊断结果不再只有“失败了”，而是给出下一步排查方向；
- 图表区和状态栏拿到的是一致的解释文案；
- `PRJ-012` 的开放点从“解释层未落地”收口为有自动化保护的 UI 契约。

## 测试映射

- `tests/circuit.runtimeDiagnostics.spec.js`
  - 验证 invalid solve 时 runtime diagnostics 会产出结构化 `summary` / `hints`
- `tests/runtimeDiagnostics.pipeline.spec.js`
  - 验证 runtime diagnostics 会被挂载到 `results.runtimeDiagnostics`
- `tests/appRuntimeV2.runtimeDiagnosticsUi.spec.js`
  - 验证 fatal diagnostics 的首条 `hint` 会进入 `chartWorkspace`、状态栏与状态动作通道

## 新鲜验证

- `npm test -- tests/circuit.runtimeDiagnostics.spec.js tests/runtimeDiagnostics.pipeline.spec.js tests/appRuntimeV2.runtimeDiagnosticsUi.spec.js`

结果：通过。

## 结论

- 本工作树内，`PRJ-012` 可从 `seed-hypothesis` 收口为 `covered`。
- 这次收口不是新增一套复杂错误面板，而是用现有状态/图表工作区通道，把 `hints` 明确转译成用户可执行的近场提示。
- 若后续要继续增强，可再往属性区或观测区做更细颗粒的定位，但不再需要继续把 `PRJ-012` 保留为开放审计项。
