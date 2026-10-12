# Independent Second-Pass Audit — 2026-10-11

- Date: 2026-10-11
- Scope: P0+P1 落地后的独立再审计。对照 2026-10-10 质量/架构审计与 `docs/plans/2026-10-10-full-remediation-design.md` 课堂合入门闩（C1/C2/C3）。同时核对上一份 `2026-10-11-post-remediation-audit.md`，纠正过重或过轻的残留项。
- Method: 活源阅读（工作区，相对 `b12aceb` 未提交）+ 课堂门禁 Vitest + v2 exclusive/boundaries/coverage 脚本。不启动 GUI。
- Policy: **只记录、不修复**（本节原文）。实施收口见 `docs/audits/project/2026-10-11-second-pass-closeout.md` 与文末 §11。
- Related: `docs/audits/project/2026-10-10-full-project-audit.md`、`docs/audits/project/2026-10-10-architecture-audit.md`、`docs/audits/project/2026-10-11-post-remediation-audit.md`、`docs/audits/project/2026-10-11-second-pass-closeout.md`

## 1. Executive Summary

```
Previous (2026-10-10): Fail — 存档/撤销清空画布；习题 XSS；电机并联反电势；仅交流无法启动
First 10-11 pass:      Conditional Pass（课堂门闩）
This independent pass: Conditional Pass（课堂可教性，工作区）— 与首轮复审同结论，修正 2 条残留评级

Remaining Critical: 0
Remaining High:     3（双核岛、Circuit 神对象/33 mixin、修复未入库）
Top 3 remaining:
1. 生产仍是 AppRuntimeV2 → Circuit + MNASolver；SolveCircuitV2 仍是 668 行实验岛（H12/A1/A3）。
2. InteractionManager 仍 33 处 prototype mixin；网表仍 `source: component`（A2/A5）。
3. P0+P1 与 vendor/ 仍未提交；干净 clone 仍是 10-10 的空画布/XSS。

Overall Assessment: Conditional Pass（课堂可教性，工作区）；相对 2026-03-03 五层纯度仍为 Fail
Recommended Priority: 先提交并冻结 P0+P1（含 vendor/）；下一迭代 P2 纯度或明确废弃 v2 求解岛
```

Top30（PRJ-001–030）`30 covered` 结论仍成立。本轮关闭的是 Top30 **之后** 的课堂洞。建议新债从 PRJ-042 起作为 seed-hypothesis，**不要改写** 已闭环状态列。

相对首轮 10-11 复审的差异（本轮活源）：

| 首轮项 | 本轮判定 |
|---|---|
| N5 滑变拖动不 `markSolverCircuitDirty` 会冻电流 | **降级**。`solve()` 每步 assemble 活对象，LU key 含 `pos:`。缺诚实测试，不是已证实的课堂故障。 |
| N6 属性对话框只覆盖 7/21 类型 | **改写**。共享 schema 确实 7 类；`PropertyDialogController` 仍为电容/热敏/开关等画字段。是双路径债，不是老师改不了 C。 |
| N1 电机无效 vsIndex | **保留 Medium、降低紧急度**。Assembler 对已连接电机分配 `vsIndex`；开关回退是因为未知量随闭合出现/消失。 |

## 2. Health snapshot (this run)

| Gate | Result |
|---|---|
| 课堂+相关 Vitest（14 files） | **90 tests pass**（io / serialization / history / motor / switch / markdown / embed×2 / factory / acStart / simulationDriver / tray / agents.doc / componentRegistry） |
| `check:v2:runtime-exclusive` | ok（要求 `AppRuntimeV2` import 并 `new Circuit()`，禁止 SolveCircuitV2） |
| `check:v2:architecture-boundaries` | ok |
| `check:v2:coverage` | ok（21 生产类型） |
| HEAD | `b12aceb`，工作区大量已改 + 未跟踪 `vendor/`、`AppDocument.js`、`SimulationDriver.js` |
| skipped/todo | 本批无 |
| GUI | 本轮未走浏览器 |

体积（`wc -l`）：

| 文件 | 行 |
|---|---:|
| `src/core/runtime/Circuit.js` | 1085 |
| `src/ui/ExerciseBoard.js` | 956 |
| `src/components/Component.js` | 797 |
| `src/ui/AIPanel.js` | 687 |
| `src/v2/simulation/SolveCircuitV2.js` | 668 |
| `src/app/AppRuntimeV2.js` | 483 |

`Circuit.js` 无 `setInterval`。时钟在 `SimulationDriver`（默认 `intervalMs = 10`）。

## 3. Scorecard vs 2026-10-10

### Critical / High（质量）

| ID | 10-10 标题 | 本轮 | 活源证据 |
|---|---|---|---|
| C1 | 应用存档 meta 被 schema 拒绝；fromJSON 先 clear | **Fixed** | `parseAppDocument` 信封 `{format:hscs-app,formatVersion:1,circuit,ui}`；legacy UI 从 meta 剥离。`fromJSON` → `deserialize`（先 `Gateway.validate`）→ 成功才 `replaceLoadedCircuit`。失败：`tests/circuit.io.spec.js` 2 元件仍在且 `isRunning` 仍 true |
| C2 | 撤销快照缺 version，undo 清空 | **Fixed** | `HistoryManager.captureState` 带 `meta.version=3`、无 timestamp；`undo`/`redo` try/catch 失败推回栈。真实 `Circuit`：加灯泡 → undo 剩 2 元件（`tests/interaction.historyManager.spec.js`） |
| C3 | 习题板 Markdown XSS | **Fixed**（残留 N2） | `ExerciseBoard.renderNow` → `parseMarkdownSafe`；marked `renderer.html = () => ''` 后再消毒。`tests/markdown.sanitize.spec.js` 覆盖 script / onerror / `javascript:` |
| H1 | 删除接线元件后存档无法加载 | **Fixed** | `Circuit.removeComponent` 删除命中 `aRef`/`bRef` 的导线；serializer `serializeRef` 丢悬空 id |
| H2 | 电压表 Infinity → JSON null | **Fixed** | `dumpVoltmeterResistance` 哨兵 `"Infinity"`；反序列化还原 `Infinity` |
| H3 | 电机 R 并联反电势 | **Fixed** | `stampSeriesVoltageSource(backEmf, ra, vsIndex)`；堵转 `6V/5Ω → +1.2 A`（`createTestCircuit` + `isRunning` + `step()`） |
| H4 | 仅交流无法启动 | **Fixed** | `SourceTypes.ACTIVE_SOURCE_TYPES` 含 `ACVoltageSource`；生产 `AppRuntimeV2.startSimulation` → router → `simulationDriver.start()`。单元测试走 fallback `circuit.startSimulation`（见 N15） |
| H5 | 闭合开关电流 `dV/1e-9` | **Fixed** | 额外未知量；`toggleSwitch` → `markSolverCircuitDirty`；无效 vsIndex 回退 1e-9 Ω。诚实测试 open→`toggleSwitch`→(0.59,0.61) |
| H6 | embed 默认 `*` / 空 allowlist 放行 | **Fixed** | 空列表或 `*` → `isOriginAllowed` false；解冻需 `capabilities.unfreeze`，失败码 `CAPABILITY_DENIED`。`READONLY_BLOCKED_METHODS` 仍是 `run/clearCircuit/loadCircuit` |
| H7 | CDN 无 SRI / 浮动 MathJax | **Fixed**（残留 N3、N13） | `index.html` 加载 `vendor/marked-12.0.0.min.js` 与 `vendor/mathjax-3.2.2/`；页面无 `cdn.jsdelivr`。nginx CSP 仍只有 `frame-ancestors *` |
| H8 | 工具箱 6V、默认 12V | **Fixed**（残留 N14 死代码） | `ComponentDefinitionRegistry` `voltage: 6`；`createComponent('PowerSource')` 测 6；对话框 schema `defaultValue: 6` |
| H9 | 元件库 div 不可键盘 | **Fixed**（残留 N12） | 28 个 `<button type="button" class="tool-item">`；0 个 div tool-item |
| H10 | README/AGENTS 指向 `src/engine` | **Fixed** | `README.md` / `AGENTS.md` / v0.9 笔记无 `src/engine` / `Solver.js` |
| H11 | quality 跑 `check:full` 无浏览器 | **Fixed**（残留 N4） | quality 末步 `npm run check && baseline:p0/circuitjs/ai`；Playwright 在独立 e2e jobs |
| H12 | 两套求解/渲染核 | **Open**（设计 D4） | 生产 `new Circuit()` + `MNASolver`；`SolveCircuitV2` 668 行。CI 已诚实，双核未消失 |

### Medium / Low（质量）

| ID | 状态 | 本轮说明 |
|---|---|---|
| M1 多 Ground 不合并 | **Open** | `NodeBuilder.js:107-123` 第一个**已连接** Ground 为参考后 `break` |
| M2 缺 integrationMethod 写成 BE | **Fixed** | `CircuitDeserializer` 不再改写该方法；序列化默认 `'auto'` |
| M3 保险丝 I²t × 整个 outer dt | **Fixed** | `CircuitSimulationLoopService` 每子步 `updateFuseState(..., substepDt)` |
| M4 求解成功跳过浮空子电路警告 | **Open** | `Circuit.collectRuntimeDiagnostics`：`normalizedResults.valid` 时 `topologyReport = null` |
| M5 灯泡线性电阻 | **Open** | `DefaultComponentRegistry.register('Bulb', Resistor)` |
| M6 属性对话框覆盖不全 | **Open，改写** | 共享 schema 7 类（电源/交流/电阻/电流表/电压表/电机/黑箱）。控制器 switch 仍覆盖热敏/光敏/继电器/滑变/灯泡/电容/电感/平行板/开关/SPDT/保险丝。老师能改 C；维护上是双路径 |
| M7 端点编辑双状态 | **Open** | `DragBehaviors` 仍写 `this.isRheostatDragging` **并且** `setInteractionModeContext`。P0/P1 明确不重写 InteractionManager |
| M8 只读可 setOptions 解冻；addComponent 不管 capability | **Fixed** | unfreeze 能力门闩；`addComponent` 读 `allowsCircuitMutation` |
| M9 习题板 min-width 320 溢出 | **Fixed** | `#exercise-board-panel { min-width: min(320px, 100%) }` |
| M10 仿真 10ms ≈ 100 Hz | **Moved, not reduced** | `SimulationDriver` 默认仍 10ms |
| M11 无暗色 / reduced-motion | **Open** | CSS 无 `prefers-color-scheme` / `prefers-reduced-motion`；`--primary-color: #2196F3` 与 oklch token 并存 |
| M12 热点预算漏大 UI | **Partial** | ExerciseBoard 956 / AIPanel 687 已进行数统计；仍超舒适 target |
| L1 StampDispatcher 死路由 | **Open** | 只映射 Resistor/Bulb；生产先走 registry |
| L2 legacyFlags | **Open** | `InteractionModeStore` 仍投影 |
| L3 吸附阈值三套 | **Open** | 本轮未重测数值 |
| L4 ESLint engine 层 / ESLint 8 EOL | **Partial** | `.eslintrc.cjs` 已无 `engine`；ESLint 仍 8.57.1；devDep `eslint-import-resolver-node` |
| L5 debtDashboard 依赖 dist | **Partial** | 超时 30s；仍 spawn 全量扫描 |

### Architecture（2026-10-10）

| ID | 状态 | 说明 |
|---|---|---|
| A1 声明运行时 ≠ 对象图 | **Honest, not unified** | exclusive 现要求 Circuit、禁止 SolveCircuitV2。对象图未改 |
| A2 网表带 source、投影写回实体 | **Open (P2)** | `NetlistBuilder.toComponentEntry` 仍 `source: component` |
| A3 影子求解器丢导线 | **Open (P2)** | 设计明确不切生产 |
| A4 type 分发泄漏 | **Partial** | 电机/开关 stamp 与积分器电流已对齐；core 内仍大量 `comp.type ===` |
| A5 33 prototype mixin | **Open** | `Interaction.js:28-29`；本轮仍数到 33 处 `Object.assign(InteractionManagerClass.prototype` |
| A6 架构 CI 不测真依赖 | **Partial** | resolver 已加；`CircuitSchemaV3` 白名单 v2→core；export-from 仍测不到 |
| A7 Composition root 补丁 | **Open** | |
| A8 时钟在 Circuit | **Fixed** | `SimulationDriver`；`Circuit.startSimulation` 只 `prepareSimulation` |
| A9 启动门忽略 AC | **Fixed** | 同 H4 |
| A10 双份 schema 键表 | **Fixed** | `CircuitSchemaV3` re-export Gateway |
| A11 AppError 未进 IO | **Partial** | Gateway `AppError(IO_ERR_SCHEMA_REJECTED)` |
| A12 观测控制器半废弃 | **Open** | 本轮未深挖 |
| A13 legacyFlags | **Open** | 同 M7 |
| A14 StampDispatcher | **Open** | |
| A15 ESLint engine 层 | **Fixed** | |
| A16 Component.js 门面偏大 | **Open** | 797 行 |

## 4. Remaining / new findings

### High

#### R1. 双求解核仍在，只是门禁说了实话

- **Location**: `src/app/AppRuntimeV2.js:58-68`, `src/v2/simulation/SolveCircuitV2.js`（668 行）
- **Severity**: High（架构债，非本轮回归）
- **Category**: Z0 / Z2
- **Description**: 课堂 tick 仍是 Circuit → MNASolver → ComponentRegistry。v2 solver/renderer 仍可被测试 import。二极管生产 Shockley vs v2 Ron/Roff 分叉还在。
- **Impact**: 新贡献者仍可能改错核。覆盖脚本已改测生产 registry。
- **Fix Recommendation**: 保持 D4：实验文件标 `@internal`；下一迭代删除运行时包中的 SolveCircuitV2，或门面化且拓扑必须走 NodeBuilder。

#### R2. Circuit 神对象 + InteractionManager 混入未动

- **Location**: `src/core/runtime/Circuit.js`（1085 行）, `src/ui/Interaction.js:28-29`
- **Severity**: High（可维护性）
- **Category**: Z0 / Z4
- **Description**: 时钟和 IO 顺序已修好，门面形状没变：增删改、步进、诊断、fromJSON 仍在同一实例。交互仍 33 个 mixin。
- **Impact**: 新的「改状态忘了 markDirty」仍可能出现。开关路径已补；滑变/平行板是值变化而非矩阵尺寸变化。
- **Fix Recommendation**: P2 再拆；不要在课堂门闩未提交前开交互重写。

#### R3. 课堂修复尚未进入版本库

- **Location**: 工作区相对 `b12aceb`：已改 70+ 文件；未跟踪 `vendor/`、`AppDocument.js`、`SimulationDriver.js`、`src/utils/markdown/`
- **Severity**: High（发布/协作）
- **Category**: Process
- **Description**: 本轮审计与测试针对工作区。干净 clone 仍是 10-10 的 C1/C2/C3。
- **Impact**: 重置工作区或换机器即回到清空画布与习题 XSS。
- **Fix Recommendation**: 按 PR-01…PR-13 拆提交；`vendor/` 必须进 git（设计禁止 LFS）。**在提交完成前，本审计对 `main` 不成立。**

### Medium

#### N1. 电动机 stamp 在无效 vsIndex 时静默跳过串联源

- **Location**: `src/core/simulation/ComponentRegistry.js:233-239`, `src/core/simulation/SolverMatrixAssembler.js:242-246`
- **Severity**: Medium（课堂主路径紧急度低于开关）
- **Category**: Z2
- **Description**: 生产 context 总有 `stampSeriesVoltageSource`。Assembler 对已连接、未短路电机分配 `vsIndex`（`SolverMatrixAssembler.js:68-75`）。开关已在 vsIndex 非法时回退 1e-9 Ω；电机仍是调用后 `return`。Assembler 对非法 vsIndex 只 warn 并 skip → 电机开路。
- **Impact**: 正常 `setCircuit` 后课堂堵转测试为 +1.2 A。风险在短接/未 prepare 的 stamp 调用。
- **Fix Recommendation**: 与开关相同：仅当 `Number.isInteger(vsIndex) && vsIndex >= 0` 走串联源，否则 stamp Ra。

#### N2. MathJax 在消毒之后排版，TeX `\href` 未进 Markdown 测试

- **Location**: `index.html:8-15`, `src/ui/ExerciseBoard.js` `typesetPromise`, `tests/markdown.sanitize.spec.js`
- **Severity**: Medium
- **Category**: Z6 / Security
- **Description**: HTML 向量已测。`window.MathJax.tex` 只配了分隔符，未关 `href`/`require`。MathJax 3 autoload 见到 `\href` 可能加载扩展。
- **Impact**: 共享习题 Markdown 若含 TeX href，可绕过 HTML allowlist。
- **Fix Recommendation**: 关闭 MathJax href/require；加一条 TeX 向量测试。

#### N3. Vendored MathJax 包内仍含 jsDelivr SRE URL

- **Location**: `vendor/mathjax-3.2.2/es5/tex-chtml.js`
- **Severity**: Medium（供应链/审计噪声）
- **Category**: Z6
- **Description**: 应用 HTML 不加载 CDN。全库 grep 若不排除 `vendor/` 会误报 H7 未修。
- **Fix Recommendation**: 证据 grep 排除 vendor；不要为 SRE 字符串改 minified blob。

#### N4. quality job 重复跑 `check`

- **Location**: `.github/workflows/ci.yml` quality 末步；`package.json` `"check"` 已含 boundaries/coverage/maintainability/lint/test
- **Severity**: Medium
- **Category**: CI
- **Description**: 前面已跑 docs/boundaries/coverage/build/maintainability/reliability；末步又 `npm run check`（再跑一遍门禁 + 全量 Vitest）再加三条 baseline。Playwright 已拆出，重复 CPU 仍在。20 分钟窗口仍紧。
- **Fix Recommendation**: quality 末步改为 `npm test` + baselines，或删掉前面与 `check` 重复的步骤。

#### N11. 平行板探索拖动不进撤销栈

- **Location**: `src/ui/interaction/DragBehaviors.js:293-339`
- **Severity**: Medium
- **Category**: Z4 / Z5
- **Description**: 滑变拖动调用 `beginHistoryTransaction('调节滑动变阻器')`。平行板探索拖动改 `plateDistance` / `plateOffsetYPx` 并 `recomputeParallelPlateCapacitance`，没有 history transaction，也没有 `markSolverCircuitDirty`。
- **Impact**: 老师拖极板改 C 后无法撤销。LU key 含 `C:`，运行中电容值会更新（与 N5 同类：值变化靠活对象，不靠 dirty）。丢失的是撤销，不是电流冻结。
- **Fix Recommendation**: 与滑变对称：`beginHistoryTransaction` / `commitHistoryTransaction`；补「拖极板 → undo 恢复 d」的真实 Circuit 测试。

### Low / 改写项

| ID | Title | Notes |
|---|---|---|
| N5 | 滑变拖动不 markDirty | **降级**。`MNASolver.solve` 每迭代 `assemble` 活对象；cache key 含 `pos:`。矩阵尺寸不变，不需要 `setCircuit`。缺「运行中拖滑变，电流随 position 变」的 Circuit.step 测试。 |
| N6 | 对话框双路径 | 共享 schema 7 类；控制器仍画其余类型。`PropertyDialogActions` 在 schema 未命中时走旧 switch（电源 fallback 默认仍写 12，见 N14）。 |
| N7 | `haltSimulation` 仍 `clearInterval(this.simulationInterval)` | Circuit 已无 setInterval 写入；死字段 |
| N8 | 无 DOM 消毒走正则 | Node 测试走 `sanitizeRenderedMarkdownWithoutDom`；浏览器走 template |
| N9 | oklch token 与 `#2196F3` 双轨 | `.tool-item:hover` 仍 `#e3f2fd` |
| N10 | P0 20 场景仍无电机/半导体/交流 | 覆盖缺口与 10-10 相同 |
| N12 | `.tool-item` 无 `:focus-visible`；桌面 padding 8px | 粗指针媒体查询 `min-height: 48px`。分类折叠钮有 focus-visible，元件按钮没有。键盘用户能 Tab 到 button，焦点环依赖 UA 默认 |
| N13 | CSP 只有 `frame-ancestors *` | `nginx.conf:11`。H7 的 CDN 已修；嵌入策略仍是任意父页可 iframe |
| N14 | 属性对话框 PowerSource 旧 fallback 默认 12 | `PropertyDialogActions.js:38-40`。共享 schema 命中则不走。死代码，改 schema 失败时会把空输入写成 12V |
| N15 | AC 启动单测不经过 SimulationDriver | `tests/runtimeActionRouter.acStart.spec.js` mock 的是 `circuit.startSimulation`。生产有 driver 时走 `simulationDriver.start()`。门闩（类型识别）测到了，时钟路径没测到 |

## 5. Architecture verdict (this pass)

```
Intended (2026-03-03):  ui → app → domain/simulation → infra
Actual production:      AppRuntimeV2 → Circuit(god) ↔ MNASolver
                                      ↘ Renderer / InteractionManager (33 mixins)
Clock:                  SimulationDriver (app) → Circuit.step
Schema:                 CircuitSchemaGateway SoT; CircuitSchemaV3 re-export
v2 island:              tests + experimental SolveCircuitV2
```

相对五层目标：**仍 Fail**。相对「CI 描述真实对象图」：**Pass**。相对课堂可教性门闩：**Pass（工作区）**。

`CircuitSchemaV3.js` 被允许 import `src/core`。这是「一份 schema」的正确例外，也是 v2 目录不再自洽的裂缝。

一次生产 tick（本轮核对）：

```
AppRuntimeV2.startSimulation
  → RuntimeActionRouter（isActiveSourceType: PowerSource | ACVoltageSource）
  → SimulationDriver.start
        Circuit.prepareSimulation
        setInterval(10ms) → Circuit.step
              NetlistBuilder.build({ source: component })
              MNASolver.setCircuit → unwrap entry.source
              ComponentRegistry.stamp
              投影写回 I/V/P
```

## 6. Anti-Patterns Verdict

**AI Slop Check**: Partial（与 10-10 相同）

oklch 表面 token、课堂常用托盘、按钮化 tool-item 是真改版。残留 `#2196F3`、无暗色、无 `prefers-reduced-motion`、`RuntimeUiBridge`/`SettingsController` 仍 `alert()`。不是新套模板。

**A11y / Responsive / Theming（源码，无 GUI）**

| 检查 | 判定 |
|---|---|
| 元件库键盘 | 28 个 button；Enter/Space 由原生 button 提供 |
| 工具按钮焦点环 | `.tool-item` 无 `:focus-visible`（分类折叠钮有） |
| 触控目标 | `@media (pointer: coarse)` 元件 48px、若干控件 44px；桌面 tool-item padding 8px |
| 习题板窄屏 | `min-width: min(320px, 100%)` |
| 暗色 / 动效减速 | 无 |
| 空画布标题 | `h1.workbench-empty-title`；顶栏标题是 `<p id="experiment-title">` |
| 首次引导 | 静态 innerHTML，`role="dialog"` `aria-modal="true"` |
| CSP | `frame-ancestors *` only |

## 7. Positive findings

- C1–C3、H1–H11 在源码与 **真实 Circuit** 测试上对得上。撤销不再 mock `fromJSON` 的成功路径。
- 电机堵转与开关电流走 `createTestCircuit` + `isRunning` + `Circuit.step()`；点击闭合有 open→`toggleSwitch` 诚实测试。
- 嵌入 fail-closed；解冻有独立错误码；`addComponent` 读只读能力。
- 仿真时钟离开 Circuit；失败 `fromJSON` 不再 `clear()`，且保持 `isRunning`。
- 文档不再把贡献者指向已删除的 `src/engine`。
- 无新的生产 npm 依赖；vendor 不进 esbuild main。
- M2（反序列化改写积分方法）与 M3（保险丝子步 dt）本轮确认为 Fixed，不是「likely」。
- Top30 闭环资产未改写。
- 本批 14 files / 90 tests 与 exclusive/boundaries/coverage 脚本均为绿。

## 8. What was not verified in a GUI this round

未启动浏览器做点击走查。工具栏按钮与 vendor 脚本在实施阶段用过一次 Chromium 冒烟（见首轮复审）。移动端抽屉、只读嵌入点击、投屏对比仍依赖既有 e2e。本轮法庭是源码 + Vitest + CI 脚本。

未复跑全量 276/1323（上一轮实施收尾为绿）。本轮只跑课堂门闩相关 14 个文件。

## 9. Action plan

| Priority | Issues | Notes |
|----------|--------|-------|
| Immediate | R3 提交 P0+P1（含 vendor/） | 不提交则本审计对 `main` 不成立 |
| Short-term | N1 电机 vsIndex 回退；N2 MathJax href；N11 平行板撤销 | 小补丁 |
| Next iteration | R1/R2、A2 网表无 source、H12 删或门面化 v2 solver | 设计 PR-14 纯度 |
| Backlog | M1 多 Ground、M5 非线性灯泡、M11 暗色、N4 CI 去重、N12 焦点环、N13 CSP | 原 P2/P3 |

建议继续使用 PRJ-031–041 记录本轮已确认项的**关闭**（不要改 Top30 状态列）。新债从 **PRJ-042** 起：

| id | area | title | status |
|---|---|---|---|
| PRJ-042 | Z0 | 实验岛 SolveCircuitV2 仍与生产分叉 | seed-hypothesis |
| PRJ-043 | Z4 | 平行板探索拖动不进撤销栈 | seed-hypothesis |
| PRJ-044 | Z6 | MathJax TeX href 绕过 HTML 消毒 | seed-hypothesis |
| PRJ-045 | Z7 | 元件 button 无 :focus-visible；桌面触控高度偏小 | seed-hypothesis |

（首轮建议的「滑变 dirty」PRJ-043 本轮降级，编号让给平行板撤销。）

## 10. Policy reminder

- 只记录、不修复。
- 不改写 `docs/audits/project/top30.md` 状态列。
- 不把生产切到 `SolveCircuitV2`。
- 未要求则不提交。

## 11. Close-out addendum (implementer, same day)

原文 §1–§10 保持发现时快照。落地与验收写在 `2026-10-11-second-pass-closeout.md`。

本轮关闭：N1 N2 N4 N5 N6 N7 N9 N11 N12 N13 N14 N15 M1 M4 M11 A2（薄）R1（生产路径隔离）。

设计延期：H12 A5 M5 M7 M10 N3 N8 N10 L1–L5 R2 R3。

验收：Vitest 282/1338 PASS；exclusive + ci-workflow 脚本 ok；Chromium 键盘焦点环 2px + 电动机 5 字段；Codex Conditional Pass。R3 由随后的课堂冻结提交关闭。下一轮见 `2026-10-12-next-issues.md`。
