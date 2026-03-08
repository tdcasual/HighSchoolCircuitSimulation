# Z4 Mode Mutual-Exclusion Follow-up

- Date: 2026-03-08
- Area: `Z4`
- Scope: `PRJ-001`
- Status: `covered`

## Closed Item

### PRJ-001
- Outcome: 交互模式快照现在以 authoritative mode 为准；即使保留 wire restore 配置，也不会再对外暴露 `conflict` 双活状态。
- Root Cause: 诊断快照按 raw flags 聚合 active modes，把“恢复配置”误当成第二活跃模式。
- Fix Location:
  - `src/ui/interaction/ToolPlacementController.js`
  - `src/app/interaction/InteractionModeBridge.js`
- Evidence:
  - `tests/interaction.modeMatrix.spec.js`
  - `tests/interaction.modeStore.spec.js`

## Verification

- `npm test -- tests/interaction.modeStore.spec.js tests/interaction.modeBridge.spec.js tests/interaction.modeMatrix.spec.js`
