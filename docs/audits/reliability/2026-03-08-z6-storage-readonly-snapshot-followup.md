# Z6 Storage / Readonly / Snapshot Follow-up

- Date: 2026-03-08
- Area: `Z6`
- Scope: `PRJ-004`, `PRJ-026`, `PRJ-027`, `PRJ-028`
- Status: `covered`

## Summary

本轮对 `Z6` 进行了三类收口：

1. 为 `autosave` 引入 ownership sequence 与 metadata，避免延迟写回覆盖更新后的导入/恢复态。
2. 将 `readonly` 从“只隐藏 UI”提升到 app 级 mutation/storage hard gate，确保直接调用 app 方法也无法修改电路。
3. 增加统一 runtime read snapshot，让 AI 保存入口、diagnostics freshness、observation export metadata 读同一份快照语义。

## Evidence

- 存储 ownership / stale autosave guard
  - `tests/app.storage.spec.js`
  - `tests/app.storageOwnership.spec.js`
  - `tests/runtimeActionRouter.spec.js`
- readonly / classroom / embed capability hard gate
  - `tests/app.runtimeCapabilities.spec.js`
  - `tests/embedRuntimeBridge.spec.js`
  - `tests/app.bootstrapV2.spec.js`
- shared runtime snapshot
  - `tests/aiClient.storage.spec.js`
  - `tests/observationExportService.spec.js`
  - `tests/runtimeDiagnostics.pipeline.spec.js`

## Implemented Notes

### PRJ-026
- `saved_circuit_meta` 记录 `owner/source/sequence`。
- autosave 在 debounce flush 时校验 `expectedSequence`，过期写直接拒绝。

### PRJ-027
- `AppRuntimeV2.startSimulation/clearCircuit/loadCircuitData/importCircuit/saveCircuitToStorage` 在 readonly embed 模式下统一拒绝。

### PRJ-004
- capability gate 从 `AppRuntimeV2.getRuntimeCapabilityFlags()` 单点导出，课堂模式切换也统一纳入门控。

### PRJ-028
- `Circuit.getRuntimeReadSnapshot()`、`AppRuntimeV2.getRuntimeReadSnapshot()` 建立统一快照。
- `AIPanel`、`RuntimeDiagnosticsPipeline`、`ObservationExportService` 改为优先读取 shared runtime snapshot。

## Verification

- `npm test -- tests/app.storage.spec.js tests/app.storageOwnership.spec.js tests/runtimeActionRouter.spec.js`
- `npm test -- tests/app.runtimeCapabilities.spec.js tests/embedRuntimeBridge.spec.js tests/app.bootstrapV2.spec.js`
- `npm test -- tests/aiClient.storage.spec.js tests/observationExportService.spec.js tests/runtimeDiagnostics.pipeline.spec.js`
- `npm test`

## Conclusion

- `PRJ-004`：`confirmed -> covered`
- `PRJ-026`：`confirmed -> covered`
- `PRJ-027`：`confirmed -> covered`
- `PRJ-028`：`confirmed -> covered`
