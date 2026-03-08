# Z2 Solver Dynamics Audit

- Date: 2026-03-06
- Area: `Z2`
- Scope: 动态元件复位、子步进切换、求解链一致性
- Related PRJs: `PRJ-009`, `PRJ-010`, `PRJ-011`

## Findings

### PRJ-011
- 现象：AC 子步进与自适应步长切换时可能产生行为跳变。
- 风险：图表与瞬态读数出现不连续突变。
- 证据入口：`tests/circuit.acSubstep.spec.js`, `tests/circuit.adaptiveTimestep.spec.js`

## Covered Items
- `PRJ-009` 与 `PRJ-010` 已由 parity / reset 合同测试收口，但本审计稿继续保留根因上下文。

## Current Status
- 审计完成，`PRJ-011` 仍待整改；其余项已有自动化保护。
