# Confirmed Audit Remediation Evidence Matrix

- Date: 2026-03-08
- Scope: Week0 ~ Week4 closure evidence review
- Note: `CLOSURE_COMMIT_TBD` 将在本轮收尾提交后替换为实际 commit hash。

## Historical Commits Already On Branch

| wave | commit | coverage |
|---|---|---|
| Week0 project audit board alignment | `56d323b` | 项目级主表、closure review、README 基线同步 |
| Week1 runtime/storage hardening | `e17d925` | `PRJ-004`, `PRJ-026`, `PRJ-027`, `PRJ-028` |
| Week2 interaction/runtime foundation | `4a6223e` | `PRJ-001`, `PRJ-002`, `PRJ-003` 的单源化基础，以及 local feedback 基础设施 |
| Mobile restore baseline | `b005913` | `PRJ-030` 及手机端恢复入口闭环基线 |

## Closure Commit Review

| wave | commit | coverage | test evidence |
|---|---|---|---|
| Remaining remediation closure | `CLOSURE_COMMIT_TBD` | `PRJ-005`, `PRJ-006`, `PRJ-011`, `PRJ-014`, `PRJ-015`, `PRJ-016`, `PRJ-018`, `PRJ-022`, `PRJ-023`, `PRJ-024`, `PRJ-025`, `PRJ-029` 以及 2026-03-08 follow-up 审计稿回填 | Week2 / Week3 / Week4 targeted gates + final `npm test` |

## Command Evidence

### Week2 gate
- `npm test -- tests/interaction.modeStore.spec.js tests/interaction.modeBridge.spec.js tests/interaction.modeMatrix.spec.js tests/circuit.topologyBatch.spec.js tests/topology.connectivityCache.spec.js`

### Week3 gate
- `npm test -- tests/circuit.io.spec.js tests/circuitSchema.spec.js tests/circuitSchema.v3.spec.js tests/interaction.propertyDialogActions.spec.js tests/interaction.propertyDialogController.spec.js tests/quickActionBarController.spec.js tests/interaction.selectionPanelController.spec.js tests/interaction.uiStateController.spec.js`

### Week4 gate
- `npm test -- tests/interaction.pointerSessionManager.spec.js tests/touchActionController.spec.js tests/responsiveLayoutController.spec.js tests/topActionMenuController.spec.js tests/observationChartInteraction.spec.js tests/e2e.observationTouchContract.spec.js tests/appRuntimeV2.runtimeDiagnosticsUi.spec.js tests/circuit.acSubstep.spec.js tests/circuit.adaptiveTimestep.spec.js`

### Final regression
- `npm test`

### Documentation integrity
- `npm test -- tests/release.docsIntegrity.spec.js`
