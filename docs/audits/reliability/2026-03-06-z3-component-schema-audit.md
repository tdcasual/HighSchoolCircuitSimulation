# Z3 Component Schema Audit

- Date: 2026-03-06
- Area: `Z3`
- Scope: schema、序列化、组件定义单源化
- Related PRJs: `PRJ-013`, `PRJ-014`, `PRJ-015`, `PRJ-016`

## Findings

### PRJ-014
- 现象：serializer / deserializer 可能静默修正字段值。
- 风险：用户输入与落盘语义不一致。

### PRJ-015
- 现象：legacy save 虽可读，但迁移后行为语义可能已变化。
- 风险：旧存档“能打开”但结果不等价。

### PRJ-016
- 现象：UI 可编辑字段与 schema 允许值可能不一致。
- 风险：表单允许值超出底层 schema 约束。

## Covered Item
- `PRJ-013` 已由 canonical component definition registry 收口。

## Current Status
- 审计完成，`PRJ-014`~`PRJ-016` 待执行统一 schema contract 整改。
