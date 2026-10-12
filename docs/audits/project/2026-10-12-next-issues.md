# Next Issues After P0+P1 Freeze — 2026-10-12

- Date: 2026-10-12
- Scope: 课堂 P0+P1 与二次审计可修项入库之后，活源核对剩余债。只记录优先级，不改生产核。
- Policy: 不改写 `docs/audits/project/top30.md` 状态列。不把生产切到 `SolveCircuitV2`。不在本轮重写 InteractionManager。新债从 **PRJ-042** 起。
- Related: `2026-10-11-second-pass-closeout.md`、`docs/plans/2026-10-10-full-remediation-design.md` PR-14 / P3

## Verdict

课堂 Critical / High 可教性项已关。剩下没有会清空画布或把电机印成开路的洞。

下一轮不要开 InteractionManager 重写，也不要把生产切到 v2 求解岛。按「覆盖缺口 → 隔离实验岛 → ViewMap 纯度」推进。

Remaining Critical: 0  
Remaining High: 2（H12/R1 双核岛，R2/A5 Circuit 神对象 + 33 mixin）

## Remaining scorecard (live)

| ID | Sev | Status | Live |
|---|---|---|---|
| H12 / R1 | High | Open | 生产 `AppRuntimeV2 → Circuit + MNASolver`。`src/v2/simulation/SolveCircuitV2.js` 668 行，标 `@internal experimental`。生产目录 CI 禁止出现该名字。测试仍可 import。二极管生产 Shockley vs v2 Ron/Roff 分叉仍在。 |
| R2 / A5 | High | Open | `Circuit.js` 1077 行；增删改、步进、IO、诊断仍同一实例。`Object.assign(InteractionManagerClass.prototype` **33** 处。 |
| A2 remainder | Med | Partial | Netlist DTO 已无 `source`；`ensureSolverPrepared` 传 live 数组。`Circuit.syncSimulationStateToComponents` 仍把 conducting/backEmf/speed 写回元件。Renderer 仍读 `comp.currentValue`。这是设计 PR-14。 |
| N10 | Med | Open | P0 电气基线 20 场景仍是直流电源+电阻串并联。无 Motor / ACVoltageSource / Diode / LED / Switch。电机堵转与开关已有独立诚实测试，未进 P0 快照。 |
| M5 | Med | Open | `DefaultComponentRegistry.register('Bulb', Resistor)`。线性灯丝。 |
| M10 | Low | Open | `SimulationDriver` 默认仍 10ms。P1 只搬家，未改显示频率。 |
| M7 | Low | Open | `DragBehaviors` 同时写 `this.isRheostatDragging` 与 `setInteractionModeContext`。随 mixin 拆分。 |
| M12 | Low | Open | ExerciseBoard / AIPanel 仍超舒适行数。已进体积统计。 |
| L1 | Low | Open | StampDispatcher 只映射 Resistor/Bulb；生产先走 registry。 |
| L2 / A13 | Low | Open | InteractionModeStore 仍投影 `legacyFlags`。 |
| L4 | Low | Open | ESLint 8.57.1 EOL。boundaries 已无 `engine` 层。 |
| N3 | Low | Defer | vendor MathJax minified 内 jsDelivr SRE 字符串。不要改 blob。 |
| N8 | Low | Accept | Node 测试走无 DOM 正则消毒；浏览器走 template。 |
| A3 | High-arch | Defer | TopologyCoordinatorV2 丢导线。禁止切生产。 |
| A7 | Low | Open | AppCompositionRootV2 仍是补丁式 composition。 |

## What to do next (ordered)

### 1. N10 — 把电机 / 交流 / 半导体编进电气基线（建议下一件）

- **Why now**: 课堂已修电机串联与交流启动，但 P0 20 场景仍全是 12V+电阻。回归网看不到这些修。
- **Work**: 在 `scripts/benchmark/p0-electrical-regression.mjs` **追加**（不要改现有 20 条的 12V 夹具）Motor 堵转、AC+电阻 RMS、二极管单向、开关开合。独立快照或 P0 扩展文件，避免搅动现有 baseline JSON。
- **Risk**: 低。已有 `tests/solver.motor.spec.js` / `switchCurrent` / `runtimeActionRouter.acStart.spec.js` 可作种子。
- **Seed**: PRJ-046

### 2. H12 / R1 — 隔离或移出运行时包中的 SolveCircuitV2（不要切生产）

- **Why**: 新贡献者仍可能改错核。CI 已诚实，岛还在 `src/v2` 与测试里。
- **Work**: 保持生产 Circuit。把 `SolveCircuitV2` / `runSimulationStepV2` 留在测试可见路径，或迁到 `tests/experimental/`；运行时镜像/embed 包不再带该岛。禁止 `TopologyCoordinatorV2` 进课堂 tick。
- **Risk**: 中。会碰到现有 `tests/solver.v2.*`、`tests/app.runSimulationStepV2.spec.js`。
- **Do not**: 把 AppRuntimeV2 换成 SolveCircuitV2。
- **Seed**: PRJ-042

### 3. PR-14 — ViewMap，停写 `comp.currentValue`（真正的 P2）

- **Why**: A2 薄修只拿掉 DTO 上的 `source`。投影与 UI 仍耦合活对象。
- **Work**: 按设计：`solve → ViewMap`；`MNASolver` 只读 params/state；Renderer `setViewMap`；删除 `syncSimulationStateToComponents`。
- **Risk**: 高。UI 大量读 `currentValue`/`voltageValue`。必须单独 PR，电气基线全绿再合。
- **Seed**: PRJ-039 已在设计里；实施时不要改 Top30 列。

### 4. M5 — 非线性灯泡（仅当教学需要）

- **Why**: 高中「灯丝电阻随温度变」实验目前是定值电阻 + 亮度可视化。
- **Work**: 单独模型，不要绑进 ViewMap PR。
- **Risk**: 中。会改 P/亮度曲线。

### 5. 以后再做

| Item | When |
|---|---|
| R2 / A5 Circuit 门面拆分、去掉 33 mixin | P3 单独里程碑。设计明确不与存档/纯度抢合。 |
| M10 显示 20Hz / rAF | 仿真 dt 不变，只合并绘制。 |
| M7 双拖动标志 | 随 InteractionManager 拆分一起删。 |
| L4 ESLint 9 | 工具链，不挡课堂。 |
| N3 SRE 字符串 | 不改 minified。 |
| A7 composition root | 随 P3。 |

## Anti-pattern / not next

- 不要为纯度重写 33 mixin。
- 不要把生产求解切到丢导线的 v2 拓扑。
- 不要改 Top30 已闭环状态列。
- 不要为 N3 手改 MathJax 压缩包。

## Suggested first ticket

**PRJ-046**：P0 电气基线扩展 Motor 堵转、交流有效值、二极管单向、开关开合；现有 20 条 12V 电阻场景保持不动。
