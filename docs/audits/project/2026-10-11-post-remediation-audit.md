# Post-Remediation Audit — 2026-10-11

- Date: 2026-10-11
- Scope: 对照 `docs/audits/project/2026-10-10-full-project-audit.md` 与 `docs/audits/project/2026-10-10-architecture-audit.md`，核验 P0+P1 实施后的课堂可教性与架构诚实度
- Method: 读当前工作区源码（未要求提交）、跑课堂门禁 Vitest、对照设计 `docs/plans/2026-10-10-full-remediation-design.md`
- Policy: 只记录、不修复；不改写 `docs/audits/project/top30.md` 已闭环状态列
- Related: 2026-10-10 质量审计 / 架构审计；实施交叉验收见会话 scratch（Codex **Pass**）
- Follow-up: 独立第二轮见 `docs/audits/project/2026-10-11-second-pass-audit.md`（纠正 N5/N6 评级；课堂门闩结论不变）

## 1. Executive Summary

```
Previous (2026-10-10): Fail — C1/C2/C3 会清空画布或 XSS；电机并联反电势；仅交流无法启动
This run:             Conditional Pass — 课堂合入门闩（存档/撤销/XSS/电机/开关/AC/6V/embed）已在工作区落地
Remaining Critical:   0
Remaining High:       2 架构残留（双核、Circuit 神对象/混入）+ 1 发布过程风险
Top 3 remaining:
1. 生产仍是 AppRuntimeV2 → Circuit + MNASolver；SolveCircuitV2 仍是实验岛（H12/A1/A3）。
2. InteractionManager 仍 33 处 prototype mixin；网表仍带 source 活对象（A2/A5）。
3. P0+P1 改动与 vendor/ 仍在工作区未提交，发布前丢失会回到 10-10 的空画布/XSS。

Overall Assessment: Conditional Pass（课堂可教性）；相对 2026-03-03 五层纯度仍为 Fail
Recommended Priority: 先提交并冻结 P0+P1；下一迭代做 P2 纯度（netlist/ViewMap）或明确废弃 v2 求解岛
```

上次 Top30（PRJ-001–030）`30 covered` 结论仍成立。本轮关闭的是 **Top30 之后** 的 PRJ-031–041 课堂洞，不是重开 Top30。

## 2. Health snapshot (this run)

| Gate | Result |
|---|---|
| 课堂关键 Vitest（io/history/serialization/motor/switch/markdown/embed/factory/acStart） | **9 files / 58 tests pass** |
| 全量 Vitest（实施收尾时） | 276 files / 1323 tests pass |
| `check:v2:runtime-exclusive` | ok（现断言 AppRuntimeV2 **使用 Circuit**、禁止 SolveCircuitV2） |
| `check:v2:coverage` | ok（21 生产类型 stamp/current） |
| `check:core-size` | hard ok；ExerciseBoard / ChatController / SolveCircuitV2 超 target |
| `baseline:p0` | 20 scenarios PASS |
| Codex 交叉验收 | **Pass**（含 open→`toggleSwitch`→~0.6 A） |
| Playwright 工作台冒烟（实施时） | 28 个 `.tool-item` 均为 button；无 CDN 请求 |
| skipped/todo tests | none observed in last full run |

工作区相对 `b12aceb` **有大量未提交改动**（含未跟踪 `vendor/`、`src/app/AppDocument.js`、`SimulationDriver.js`）。下列“已修复”均指 **当前工作区源码**，不是已推送的 `main`。

## 3. Scorecard vs 2026-10-10

### Critical / High（质量）

| ID | 10-10 标题 | 11-10 状态 | 证据 |
|---|---|---|---|
| C1 | 应用存档 meta 被 schema 拒绝；fromJSON 先 clear | **Fixed** | `parseAppDocument` 信封 `{format:hscs-app,formatVersion:1,circuit,ui}`；legacy UI 从 meta 剥离。`fromJSON` → `deserialize`（先 `Gateway.validate`）→ 成功才 `replaceLoadedCircuit`。失败测试：`tests/circuit.io.spec.js` 2 元件电路仍在 |
| C2 | 撤销快照缺 version，undo 清空 | **Fixed** | `HistoryManager.captureState` 带 `meta.version=3` 无 timestamp；`undo`/`redo` try/catch 失败推回栈。真实 Circuit 测试在 `tests/interaction.historyManager.spec.js` |
| C3 | 习题板 Markdown XSS | **Fixed**（残留见 N2） | `ExerciseBoard.renderNow` 走 `parseMarkdownSafe`；marked raw HTML 被 renderer 清空后再消毒。`tests/markdown.sanitize.spec.js` |
| H1 | 删除接线元件后存档无法加载 | **Fixed** | `Circuit.removeComponent` 删除 `aRef`/`bRef` 命中导线；serializer 丢悬空 ref |
| H2 | 电压表 Infinity → JSON null | **Fixed** | 属性哨兵 `"Infinity"`；反序列化还原 `Infinity` |
| H3 | 电机 R 并联反电势 | **Fixed** | `stampSeriesVoltageSource(backEmf, ra, vsIndex)`；堵转 `6V/5Ω → +1.2 A`（`tests/solver.motor.spec.js`，`internalResistance:0` + `isRunning` + `step()`） |
| H4 | 仅交流无法启动 | **Fixed** | `SourceTypes.isActiveSourceType` 含 `ACVoltageSource` |
| H5 | 闭合开关电流 `dV/1e-9` | **Fixed** | 额外未知量电流；点击路径：`toggleSwitch` → `markSolverCircuitDirty`；无效 vsIndex 回退 1e-9 Ω。诚实测试 open→toggle→(0.59,0.61) |
| H6 | embed 默认 `*` / 空 allowlist 放行 | **Fixed** | 空列表或 `*` → `isOriginAllowed` false；解冻需 `capabilities.unfreeze`，失败码 `CAPABILITY_DENIED` |
| H7 | CDN 无 SRI / 浮动 MathJax | **Fixed**（残留见 N3） | `index.html` 加载 `vendor/marked-12.0.0.min.js` 与 `vendor/mathjax-3.2.2/`；页面无 `cdn.jsdelivr` |
| H8 | 工具箱 6V、默认 12V | **Fixed** | `ComponentDefinitionRegistry` / 对话框 `defaultValue: 6`；`createComponent('PowerSource')` 测 6 |
| H9 | 元件库 div 不可键盘操作 | **Fixed** | 28 个 `<button type="button" class="tool-item">`；click → `setPendingToolType`；`aria-pressed` |
| H10 | README/AGENTS 指向 `src/engine` | **Fixed** | README/AGENTS/v0.9 笔记无 `src/engine` / `Solver.js`；示例改为 `tests/circuit.io.spec.js` |
| H11 | quality 跑 `check:full` 无浏览器 | **Fixed**（残留见 N4） | quality 末步 `npm run check && baseline:p0/circuitjs/ai`；Playwright 在独立 e2e jobs |
| H12 | 两套求解/渲染核 | **Open**（设计 D4：本轮不切生产） | 生产仍 `new Circuit()` + `MNASolver`；`SolveCircuitV2` 668 行实验岛。CI 已诚实化，双核未消失 |

### Medium / Low（质量）

| ID | 状态 | 说明 |
|---|---|---|
| M1 多 Ground 不合并 | **Open** | `NodeBuilder.js` 第一个已连接 Ground 为参考，第二个 Ground 可成独立根 |
| M2 缺 integrationMethod 被写成 BE | **Likely fixed** | Deserializer 不再改写该方法；序列化默认 `'auto'`。运行时 auto 仍是先 BE 后梯形 |
| M3 保险丝 I²t × 整个 outer dt | **Likely fixed** | `CircuitSimulationLoopService` 每子步调用 `updateFuseState(..., substepDt)` |
| M4 求解成功跳过浮空子电路警告 | **Open** | `Circuit.collectRuntimeDiagnostics`：`normalizedResults.valid` 时 `topologyReport = null` |
| M5 灯泡线性电阻 | **Open** | `DefaultComponentRegistry.register('Bulb', Resistor)`；AGENTS 已写明 |
| M6 属性对话框覆盖不全 | **Partial** | Motor 已补转矩/反电势/惯量/负载；仍只有 7/21 类型有对话框 schema（无电容/开关/滑变等） |
| M7 端点编辑双状态 | **Open** | P0/P1 明确不重写 InteractionManager |
| M8 只读可 setOptions 解冻；addComponent 不管 capability | **Fixed** | unfreeze 能力门闩；`addComponent` 读 `allowsCircuitMutation` |
| M9 习题板 min-width 320 溢出 | **Fixed** | `#exercise-board-panel { min-width: min(320px, 100%) }` |
| M10 仿真 10ms ≈ 100 Hz | **Moved, not reduced** | 时钟在 `SimulationDriver`（默认仍 `intervalMs = 10`） |
| M11 无暗色 / reduced-motion | **Open** | CSS 无 `prefers-color-scheme` / `prefers-reduced-motion`；`--primary-color: #2196F3` 与 oklch token 并存 |
| M12 热点预算漏大 UI | **Partial** | ExerciseBoard/AIPanel/ChatController 已进 core-size；仍超 target |
| L1 StampDispatcher 死路由 | **Open** | 生产先走 registry |
| L2 legacyFlags | **Open** | |
| L3 吸附阈值三套 | **Open** | |
| L4 ESLint engine 层 / ESLint 8 EOL | **Partial** | `engine` 元素已删；ESLint 仍 8.57.1 EOL |
| L5 debtDashboard 依赖 dist | **Partial** | 超时提到 30s；仍 spawn 全量扫描 |

### Architecture（2026-10-10）

| ID | 状态 | 说明 |
|---|---|---|
| A1 声明运行时 ≠ 对象图 | **Honest, not unified** | exclusive 现要求 AppRuntimeV2 构造 Circuit、禁止 SolveCircuitV2。对象图未改 |
| A2 网表带 source、投影写回实体 | **Open (P2)** | `NetlistBuilder.toComponentEntry` 仍 `source: component` |
| A3 影子求解器丢导线 | **Open (P2)** | 设计明确不切生产 |
| A4 type 分发泄漏 | **Partial** | 电机/开关 stamp 与积分器电流已对齐；core 内仍大量 `comp.type ===` |
| A5 33 prototype mixin | **Open** | `Interaction.js:28-29` 仍 `installInteractionCoreDelegates` + Tail |
| A6 架构 CI 不测真依赖 | **Partial** | 已加 `eslint-import-resolver-node`；`CircuitSchemaV3` boundaries 关闭；export-from 仍测不到 |
| A7 Composition root 补丁 | **Open** | |
| A8 时钟在 Circuit | **Fixed** | `SimulationDriver`；`Circuit.startSimulation` 只 `prepareSimulation` |
| A9 启动门忽略 AC | **Fixed** | 同 H4 |
| A10 双份 schema 键表 | **Fixed** | `CircuitSchemaV3` re-export Gateway；v2→core 是白名单例外 |
| A11 AppError 未进 IO | **Partial** | Gateway 抛 `AppError(IO_ERR_SCHEMA_REJECTED)`；拓扑主路径仍混用 |
| A12 观测控制器半废弃 | **Open** | |
| A13 legacyFlags | **Open** | |
| A14 StampDispatcher | **Open** | |
| A15 ESLint engine 层 | **Fixed** | |
| A16 Component.js 门面偏大 | **Open** | 798/1200 |

## 4. Remaining / new findings

### High

#### R1. 双求解核仍在，只是门禁说了实话

- **Location**: `src/app/AppRuntimeV2.js:58-68`, `src/v2/simulation/SolveCircuitV2.js` (668 行)
- **Severity**: High（架构债，非本轮回归）
- **Category**: Z0 / Z2
- **Description**: 课堂 tick 仍是 Circuit → MNASolver → ComponentRegistry。v2 solver/renderer 仍可被测试 import。二极管生产 Shockley vs v2 Ron/Roff 分叉还在。
- **Impact**: 新贡献者仍可能改错核。覆盖脚本已改测生产 registry，绿不再等于 v2 全类型成功。
- **Fix Recommendation**: 保持 D4：实验文件标 `@internal`；下一迭代删除运行时包中的 SolveCircuitV2，或把它做成 MNASolver 门面且拓扑必须走 NodeBuilder。

#### R2. Circuit 神对象 + InteractionManager 混入未动

- **Location**: `src/core/runtime/Circuit.js` (1085 行), `src/ui/Interaction.js:28-29`
- **Severity**: High（可维护性）
- **Category**: Z0 / Z4
- **Description**: P0 把时钟和 IO 顺序修好了，门面形状没变：增删改、步进、诊断、fromJSON 仍在同一实例。交互仍 33 个 `Object.assign(prototype)`。
- **Impact**: 新的“改状态忘了 markDirty”类 bug 还会出现（本轮开关已补；滑变拖动仍不调用 `markSolverCircuitDirty`，见 N5）。
- **Fix Recommendation**: P2 再拆；不要在课堂门闩未提交前开交互重写。

#### R3. 课堂修复尚未进入版本库

- **Location**: 工作区相对 `b12aceb`：已改 70+ 文件；未跟踪 `vendor/`、`AppDocument.js`、`SimulationDriver.js`、`utils/markdown/`
- **Severity**: High（发布/协作）
- **Category**: Process
- **Description**: 审计与 Codex 验收的是工作区。干净 clone 仍是 10-10 的 C1/C2/C3。
- **Impact**: 重置工作区或换机器即回到清空画布与习题 XSS。
- **Fix Recommendation**: 按 PR-01…PR-13 拆提交；`vendor/` 必须进 git（设计禁止 LFS）。

### Medium

#### N1. 电动机 stamp 在无效 vsIndex 时仍可能静默开路

- **Location**: `src/core/simulation/ComponentRegistry.js:233-239`
- **Severity**: Medium
- **Category**: Z2
- **Description**: 生产 context 总有 `stampSeriesVoltageSource`。开关已在 vsIndex 非法时回退 1e-9 Ω；电机仍是调用后 `return`。Assembler 对已连接电机一般会分配 vsIndex，课堂点击路径不如开关敏感。
- **Fix Recommendation**: 与开关相同：仅当 `Number.isInteger(vsIndex) && vsIndex >= 0` 走串联源，否则 stamp Ra。

#### N2. MathJax 在消毒之后排版，TeX `\href` 未进 Markdown 测试

- **Location**: `src/ui/ExerciseBoard.js:606-617`, `src/utils/markdown/sanitizeRenderedMarkdown.js`
- **Severity**: Medium
- **Category**: Z6 / Security
- **Description**: HTML 向量（script/onerror/javascript:）已测。`typesetPromise([target])` 仍处理消毒后节点内的 `$...$`。MathJax 3 若启用 `\href`，可绕过 HTML allowlist。
- **Fix Recommendation**: 关闭 MathJax href/require；加一条 TeX 向量测试。

#### N3. Vendored MathJax 包内仍含未使用的 jsDelivr SRE URL

- **Location**: `vendor/mathjax-3.2.2/es5/tex-chtml.js`
- **Severity**: Medium（供应链/审计噪声）
- **Category**: Z6
- **Description**: 应用 HTML 不加载 CDN。全库 grep 若不排除 `vendor/` 会误报 H7 未修。
- **Fix Recommendation**: 证据 grep 排除 vendor；不要为 SRE 字符串改 minified blob。

#### N4. quality job 重复跑 `check`，20 分钟窗口偏紧

- **Location**: `.github/workflows/ci.yml:71-75`
- **Severity**: Medium
- **Category**: CI
- **Description**: 前面已跑 docs/boundaries/coverage/build/maintainability/reliability；末步又 `npm run check`（内含再跑一遍门禁 + 全量 Vitest）再加三条 baseline。Playwright 已拆出，重复 CPU 仍在。
- **Fix Recommendation**: quality 末步改为 `npm test` + baselines，或删掉前面与 `check` 重复的步骤。

#### N5. 滑变拖动改 `position` 不标脏

- **Location**: `src/ui/interaction/DragBehaviors.js:258-259`
- **Severity**: Medium
- **Category**: Z2 / Z4
- **Description**: 每步 stamp 读活对象；LU key 含 `pos`，若每 `solve()` 重算 key 则电阻会更新。未走 `markSolverCircuitDirty`/`setCircuit`。与开关“矩阵尺寸变化”不同，但是同一类 UI→求解耦合。
- **Fix Recommendation**: 拖动结束（或节流）调用 `markSolverCircuitDirty`；补“运行中拖滑变，电流随 position 变”的 Circuit.step 测试。

#### N6. 属性对话框仍只覆盖 7 类元件

- **Location**: `src/ui/interaction/ComponentPropertySchema.js:14-52`
- **Severity**: Medium
- **Category**: Z5
- **Description**: 电容、电感、开关、滑变、热敏/光敏、继电器、保险丝等仍无对话框字段表。Motor 本轮已补全。
- **Fix Recommendation**: 按 `ComponentDefaults` 补 schema，或侧栏与对话框共用一份 definition。

### Low

| ID | Title | Notes |
|---|---|---|
| N7 | `haltSimulation` 仍清理 `this.simulationInterval` | 时钟已上移，字段应已无写入；死代码 |
| N8 | 无 DOM 消毒走正则 | Node 测试走这条；浏览器走 template。正则弱于 DOM walk |
| N9 | oklch token 与 `#2196F3` 双轨 | 实验台视觉债，非本轮回归 |
| N10 | P0 20 场景仍无电机/半导体/交流 | 覆盖缺口与 10-10 相同 |

## 5. Architecture verdict (update)

```
Intended (2026-03-03):  ui → app → domain/simulation → infra
Actual production:      AppRuntimeV2 → Circuit(god) ↔ MNASolver
                                      ↘ Renderer / InteractionManager (33 mixins)
Clock:                  SimulationDriver (app) → Circuit.step
Schema:                 CircuitSchemaGateway SoT; CircuitSchemaV3 re-export
v2 island:              tests + experimental SolveCircuitV2
```

相对五层目标：**仍 Fail**。相对“CI 描述真实对象图”：**Pass**。相对课堂可教性门闩：**Pass**（工作区）。

`CircuitSchemaV3.js` 被允许 import `src/core`（eslint override + boundaries 脚本白名单）。这是“一份 schema”的正确例外，也是 v2 目录不再自洽的新裂缝。

## 6. Anti-Patterns Verdict

**AI Slop Check**: Partial（与 10-10 相同）

oklch 表面 token、课堂常用托盘、按钮化 tool-item 是真改版。残留 `#2196F3`、无暗色、无 `prefers-reduced-motion`。不是新套模板。

## 7. Positive findings

- 课堂 C1–C3、H1–H11 在源码与 Vitest 上对得上，不再靠 mock `fromJSON` 假装撤销可用。
- 电机堵转与开关电流走真实 `Circuit.step()`；点击闭合有 open→`toggleSwitch` 诚实测试。
- 嵌入 fail-closed；解冻有独立错误码。
- 仿真时钟离开 Circuit；失败 `fromJSON` 不再 `clear()`。
- 文档不再把贡献者指向已删除的 `src/engine`。
- 无新的生产 npm 依赖；vendor 不进 esbuild main。
- Top30 闭环资产未改写。

## 8. What was not re-verified in a GUI this round

未做完整桌面/手机手势走查。工具栏按钮与 vendor 脚本在实施阶段用过一次 Chromium 冒烟。移动端抽屉、只读嵌入点击、投屏对比仍依赖既有 e2e 脚本。本轮以源码 + Vitest 为法庭。

## 9. Action plan

| Priority | Issues | Notes |
|----------|--------|-------|
| Immediate | R3 提交 P0+P1（含 vendor/） | 不提交则审计结论对 `main` 不成立 |
| Short-term | N1 电机 vsIndex 回退；N2 MathJax href；N5 滑变 dirty | 小补丁，可跟在开关修复后 |
| Next iteration | R1/R2、A2 网表无 source、H12 删或门面化 v2 solver | 设计 PR-14 纯度 |
| Backlog | M1 多 Ground、M5 非线性灯泡、M11 暗色、N6 对话框覆盖、N4 CI 去重 | 原 P2/P3 |

建议继续使用 PRJ-031–041 编号记录本轮已确认项的**关闭**，不要改 Top30 状态列。新债从 **PRJ-042** 起：

| id | area | title | status |
|---|---|---|---|
| PRJ-042 | Z0 | 实验岛 SolveCircuitV2 仍与生产分叉 | seed-hypothesis |
| PRJ-043 | Z2/Z4 | 滑变拖动不 markSolverCircuitDirty | seed-hypothesis |
| PRJ-044 | Z6 | MathJax TeX href 绕过 HTML 消毒 | seed-hypothesis |
