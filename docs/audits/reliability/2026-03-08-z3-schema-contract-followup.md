# Z3 Schema Contract Follow-up

- Date: 2026-03-08
- Area: `Z3`
- Scope: `PRJ-014`, `PRJ-015`, `PRJ-016`
- Status: `covered`

## Closed Items

### PRJ-014
- Outcome: runtime-critical 数值字段不再由 deserializer 静默修正；非法值会在 schema / deserialize 入口被明确拒绝。
- Root Cause: deserialize 阶段用 fallback 值覆盖非法输入，造成“能打开但语义被改写”。
- Fix Location:
  - `src/core/io/CircuitSchemaGateway.js`
  - `src/core/io/CircuitDeserializer.js`
  - `src/v2/infra/io/CircuitSchemaV3.js`
- Evidence:
  - `tests/circuit.io.spec.js`
  - `tests/circuitSchema.spec.js`

### PRJ-015
- Outcome: legacy payload 只有在显式 `allowLegacyMigration` 下才允许升级，并返回 migration diagnostics；默认仍拒绝。
- Root Cause: v3 读取链缺少“允许升级 / 升级说明 / 默认拒绝”的明确契约。
- Fix Location:
  - `src/v2/infra/io/CircuitSchemaV3.js`
  - `src/v2/infra/io/CircuitDeserializerV3.js`
- Evidence:
  - `tests/circuitSchema.v3.spec.js`

### PRJ-016
- Outcome: 属性弹窗字段元数据开始收敛到 `ComponentPropertySchema`，默认值与编辑边界由共享契约派生。
- Root Cause: Property dialog controller / actions 各自硬编码字段与边界，容易和 schema/defaults 漂移。
- Fix Location:
  - `src/ui/interaction/ComponentPropertySchema.js`
  - `src/ui/interaction/PropertyDialogController.js`
  - `src/ui/interaction/PropertyDialogActions.js`
- Evidence:
  - `tests/interaction.propertyDialogController.spec.js`
  - `tests/interaction.propertyDialogActions.spec.js`

## Verification

- `npm test -- tests/circuit.io.spec.js tests/circuitSchema.spec.js tests/circuitSchema.v3.spec.js tests/interaction.propertyDialogActions.spec.js tests/interaction.propertyDialogController.spec.js`
