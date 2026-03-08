# Z6 Integration Runtime Audit

- Date: 2026-03-06
- Area: `Z6`
- Scope: 存储 ownership、embed readonly、AI/导出读取一致性
- Related PRJs: `PRJ-004`, `PRJ-026`, `PRJ-027`, `PRJ-028`

## Findings

### PRJ-026
- 现象：autosave / import / load 之间存在覆盖顺序风险。
- 风险：高优先级，可能造成用户数据被低优先级写入覆盖。

### PRJ-027
- 现象：embed readonly 可能仅隐藏 UI，但并未阻断底层修改入口。
- 风险：高优先级，只读语义不可信。

### PRJ-028
- 现象：AI / 诊断 / 导出可能读取到陈旧拓扑或观测状态。
- 风险：反馈与当前画布状态不一致。

### PRJ-004
- 现象：readonly / classroom / embed 门控口径可能分叉。
- 风险：同一能力在不同入口下出现不同行为。

## Current Status
- 审计完成，Week 1 优先整改项。


## Follow-up

- `docs/audits/reliability/2026-03-08-z6-storage-readonly-snapshot-followup.md` 已将 `PRJ-004`、`PRJ-026`、`PRJ-027`、`PRJ-028` 收口为 `covered`。
