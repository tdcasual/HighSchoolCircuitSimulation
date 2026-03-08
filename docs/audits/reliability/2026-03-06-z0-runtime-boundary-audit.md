# Z0 Runtime Boundary Audit

- Date: 2026-03-06
- Area: `Z0`
- Scope: 启动链路、运行时边界、状态源统一性
- Related PRJs: `PRJ-002`, `PRJ-003`

## Findings

### PRJ-002
- 现象：`bootstrapV2` 外层入口已切换，但内部仍可能装配旧 monolith runtime。
- 风险：运行时边界泄漏，v2 行为和 legacy 初始化时序混杂。
- 证据入口：`src/main.js`, `src/app/AppRuntimeV2.js`

### PRJ-003
- 现象：mode store 与 legacy runtime flags 可能同时表达当前交互模式。
- 风险：同一动作被不同状态源解释，导致 UI 与实际模式漂移。
- 证据入口：`src/app/interaction/InteractionModeStore.js`, `tests/interaction.modeStore.spec.js`

## Remediation Target
- 收敛为单一 runtime 装配入口。
- 收敛为单一可写模式真相源。

## Current Status
- 审计完成，待按 `docs/plans/2026-03-08-confirmed-audit-remediation-implementation.md` 执行整改。
