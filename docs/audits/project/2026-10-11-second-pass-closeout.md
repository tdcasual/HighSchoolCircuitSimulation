# Second-Pass Close-out — 2026-10-11

- Date: 2026-10-11
- Scope: 对 `2026-10-11-second-pass-audit.md` 中本轮可修项落地后的验收。原审计仍是「只记录、不修复」快照，本文件是实施收口。
- HEAD: 本收口随课堂 P0+P1 一并入库；R3 由该提交关闭。
- Policy: 不改写 `docs/audits/project/top30.md` 状态列。不把生产切到 `SolveCircuitV2`。不重写 InteractionManager。

## Verdict

**Conditional Pass（课堂可教性，工作区）**

Codex 交叉验收（session `01a12b9d-6f32-79d3-932f-2282c3efb514`）与本轮 Vitest / 浏览器走查一致：二次审计要求关闭的 N/M/A 项全部 PASS；设计 Non-Goals 标 DEFERRED-BY-DESIGN，不算失败。

该提交之后，干净 clone 应带上课堂 C1–C3 / H1–H11 与二次审计可修项。

## Gates

| Gate | Result |
|---|---|
| Vitest | **282 files / 1338 tests pass** |
| `node scripts/ci/assert-v2-runtime-exclusive.mjs` | ok |
| `node scripts/ci/assert-ci-workflow-coverage.mjs` | ok |
| Chromium keyboard + 属性对话框 | `ui-verify.json` `ok: true` |
| Codex 交叉验收 | Conditional Pass，必闭项全 PASS |

## Closed this pass

| ID | Status | Evidence |
|---|---|---|
| N1 | Fixed | `ComponentRegistry.js` Motor：合法 `vsIndex` → `stampSeriesVoltageSource`；否则 `stampResistor(Ra)`。Ammeter 有索引守卫。`tests/simulation.componentRegistry.spec.js` |
| N2 | Fixed | `index.html` MathJax `packages: { '[-]': ['require', 'autoload', 'html', 'href'] }`。`tests/markdown.sanitize.spec.js` TeX `\href` 不成 `<a>` |
| N4 | Fixed | quality 末步 `lint && format:check && check:v2:runtime-safety && check:core-size && test && baseline:p0/circuitjs/ai`，不再 `npm run check` |
| N5 | Fixed | 滑变拖动结束 `markSolverCircuitDirty`；`tests/circuit.rheostatLiveStep.spec.js` 运行中改 `position` 电流随 `Circuit.step()` 变 |
| N6 | Fixed | 共享 schema 19/21；Ground 提示 + Switch toggle 自定义。Motor 5 字段。`PropertyDialogActions` 走 schema apply |
| N7 | Fixed | `Circuit.haltSimulation` 只 `isRunning=false`。无 `simulationInterval` / `setInterval` / `clearInterval` |
| N9 | Fixed | `.tool-item` 使用 `--tool-item-*` token；hover 无 `#e3f2fd`；`.tool-item-quick` 用 `--tool-item-bg` |
| N11 | Fixed | 平行板 `beginHistoryTransaction('调节平行板电容')` + `markSolverCircuitDirty` + commit。undo 恢复 `plateDistance` |
| N12 | Fixed | `.tool-item:focus-visible` 2px outline + 2px box-shadow；`min-height: 36px`；transition 不再 `all`。键盘 Tab 到 `6V 电源` 测到 `outlineWidth: 2px` |
| N13 | Fixed | nginx CSP 含 `default-src 'self'` 等，保留 `frame-ancestors *` |
| N14 | Fixed | PowerSource schema `defaultValue: 6`；`PropertyDialogActions` 无 12V fallback。对话框实测 `edit-voltage=6` |
| N15 | Fixed | `tests/runtimeActionRouter.acStart.spec.js` 走真实 `SimulationDriver` |
| M1 | Fixed | `NodeBuilder` 合并全部 Ground 到公共地；孤立 Ground = node 0 |
| M4 | Fixed | `collectRuntimeDiagnostics` 在 `results.valid` 时仍跑拓扑校验（仅 topology deferred 跳过） |
| M11 | Fixed | `prefers-reduced-motion` + `prefers-color-scheme: dark` |
| A2 | Thin Fixed | Netlist DTO 无 `source`；`ensureSolverPrepared` `solver.setCircuit(live components, this.nodes)`。投影写回实体仍在（P2） |
| R1 | Isolation Fixed | 生产 `src/app`/`src/ui`/`src/core`/`src/embed` 禁止 `SolveCircuitV2`/`runSimulationStepV2`。实验岛仍在 `src/v2` |

## Deferred by design

| ID | Why |
|---|---|
| H12 / R1 island | 不切生产到 `SolveCircuitV2`；TopologyCoordinatorV2 丢导线 |
| R2 / A5 | 不重写 InteractionManager 33 mixin / Circuit 神对象 |
| R3 | 本提交关闭 |
| M5 | 非线性灯泡不在本轮 |
| M7 | 双拖动标志随 InteractionManager 延期 |
| M10 | 10ms 时钟未改 |
| N3 | 不改 vendor minified SRE blob |
| N8 | Node 无 DOM 时走正则消毒 |
| N10 | P0 20 场景覆盖缺口 |
| L1–L5 | ESLint 9 / StampDispatcher / legacyFlags / 吸附阈值 |

## Browser acceptance (this pass)

- 键盘 Tab 落到 `#toolbox button.tool-item[data-type=PowerSource]`：`matches(':focus-visible')`，`outline: oklch(0.61 0.15 252) solid 2px`，`box-shadow` 同色 2px，`min-height: 36px`。
- 电动机对话框 5 字段：电枢电阻、转矩常数、反电动势常数、转动惯量、负载转矩。
- 电容对话框标签 `电容值 (μF)`，显示值 `1000`（内部 0.001 F）。
- 电源对话框电动势 `6`。
- 开关仍走自定义通断钮。

截图：`/tmp/grok-goal-097196ece013/implementer/ui-toolbox-focus.png`、`ui-property-dialog.png`、`ui-workbench.png`。

## Residual High (unchanged)

1. 生产仍是 AppRuntimeV2 → Circuit + MNASolver；`SolveCircuitV2` 实验岛仍在（H12 / R1）。
2. Circuit 神对象 + InteractionManager 33 mixin（R2 / A5）。

R3 由本提交关闭。不要改 Top30 已闭环列。新债从 PRJ-042 起。下一轮见 `docs/audits/project/2026-10-12-next-issues.md`。
