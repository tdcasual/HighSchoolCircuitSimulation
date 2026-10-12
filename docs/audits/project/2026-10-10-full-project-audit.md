# Full Project Audit — 2026-10-10

- Date: 2026-10-10
- Scope: Z0–Z7 全项目（架构、拓扑、求解、schema、交互、面板、嵌入/AI、移动端/A11y）
- Method: 对照 `docs/templates/project-audit/`、现有 Top30 闭环结论、当前 `main`（`b12aceb`）源码与实机脚本复现
- Policy: 只记录、不修复

## 1. Executive Summary

```
Total Issues: 32 (Critical: 3, High: 12, Medium: 12, Low: 5)
Top 3 Issues:
1. 应用存档把 exerciseBoard/chartWorkspace 写进 meta，加载时 schema 拒绝；fromJSON 先 clear 再校验，失败会清空画布。
2. 撤销/重做不带 meta.version，fromJSON 抛错被吞掉，电路被清空。
3. 习题板 Markdown 未消毒直接 innerHTML，可配合存档/嵌入形成 XSS。

Overall Assessment: Fail（数据完整性与若干教学物理模型；门禁测试大多为绿）
Recommended Priority: 先修存档/撤销/XSS，再修电动机印记与交流启动门闩
```

上次项目级闭环（2026-03-08）结论 `30 covered / 0 confirmed` 仍然成立：当时的 Top30 引用测试与审计文档都还在。本轮发现的是 **Top30 之后 UI 改版与 schema 收紧叠加出来的新洞**，以及测试替身过宽导致的漏检。

## 2. Health snapshot (this run)

| Gate | Result |
|---|---|
| `npx vitest run` | **269 files / 1280 tests pass**, 1 fail (`tests/debtDashboard.spec.js`，缺 `dist/` 时 markdown 不含小写 `target`) |
| `eslint`（项目本地 8.57.1） | ok |
| `prettier --check` | ok |
| v2/observation/mode/registry/renderer/engine 合同脚本 | ok |
| `check:core-size` | ok（Circuit 1060/1400，AppRuntimeV2 479/575） |
| `check:maintainability` | ok（shims=0；bundle warn 因当时无 dist） |
| `npm run build:frontend` | ok：main **320.3 KiB** / hard 400，total **582.5 KiB** / target 580 / hard 620 |
| skipped/todo tests | **none** |

说明：本机默认 `PATH` 上的 `eslint` 是系统 6.4.0，会误报“找不到配置”。门禁用 `./node_modules/.bin/eslint`。

## 3. Anti-Patterns Verdict

**AI Slop Check**: Partial

March 14 实验台改版已经落地：oklch token、空画布引导、图表/助手表面合同测试都在。残留的是双 token（`--accent-instrument` 与 `#2196F3`）、🤖 FAB、`alert()`、以及大量 `safeInvoke` 吞异常。这更像长期迭代产物，不是整页套模板。

## 4. Dual-runtime verdict

`src/main.js` 走 `bootstrapV2({ AppClass: AppRuntimeV2 })`，CI `check:v2:runtime-exclusive` 因此为绿。

**实际求解/渲染仍是 v1：**

- `AppRuntimeV2` 构造 `new Circuit()` + `new Renderer()`
- `Circuit.solver = new MNASolver()`
- `runSimulationStepV2` / `SolveCircuitV2` / `RendererRegistryV2` 只被测试和 coverage 脚本引用

`src/v2` 禁止 import `src/core`，两套求解器会继续漂移（生产二极管是 Shockley 线性化，v2 仍是 Ron/Roff）。

## 5. Detailed findings

### Critical

#### C1. 应用存档无法通过电路 schema 加载

- **Location**: `src/app/AppSerialization.js:28-38`, `src/core/io/CircuitSchemaGateway.js:129-132`, `src/core/runtime/Circuit.js:1041-1045`, `src/app/RuntimeActionRouter.js:86`
- **Severity**: Critical
- **Category**: Z3 / Z6
- **Description**: `buildAppSaveData` 把 `exerciseBoard`、`chartWorkspace` 写进 `meta`。Gateway 只允许 `version|name|timestamp`。`fromJSON` 先 `clear()` 再 `validate`。
- **Impact**: 导出/导入、autosave 恢复失败。`loadCircuitFromStorage` 捕获异常后返回 false，刷新丢电路。失败的导入会先清空当前电路。
- **Evidence**: 2026-10-10 实机：`fromJSON full save: THROW payload.meta 包含未知字段: exerciseBoard`
- **Fix Recommendation**: 校验前剥离 UI meta，或扩展 `META_KEYS` 并忽略未知键。`fromJSON` 必须先校验再 clear。给 `tests/app.storage.spec.js` / `tests/circuit.io.spec.js` 加上带 exerciseBoard 的往返用例。

#### C2. 撤销/重做清空电路

- **Location**: `src/ui/interaction/HistoryManager.js:22-30,119-134`, `src/core/runtime/Circuit.js:1041-1045`, `src/utils/RuntimeSafety.js`
- **Severity**: Critical
- **Category**: Z4 / Z5
- **Description**: `captureState` 只保留 `components/wires/probes`，丢掉 `meta`。`applyState` 调用 `fromJSON` 时没有 `meta.version === 3`。抛错被 `safeInvoke` 吞掉，画布停在 `clear()` 之后。
- **Impact**: 任意一次撤销可以把课堂演示电路清零。现有 `tests/interaction.historyManager.spec.js` 只用 mock `fromJSON`，测不到。
- **Evidence**: 实机 2 元件 → 再加灯泡 → undo 后 `count 0`
- **Fix Recommendation**: 快照使用完整 `toJSON()`。校验失败不得 clear。补真实 `Circuit` 的 undo 集成测试。

#### C3. 习题板 Markdown XSS

- **Location**: `src/ui/ExerciseBoard.js:598-618`
- **Severity**: Critical（课堂共享 JSON / 嵌入 `loadCircuit`）
- **Category**: Z6 / Security
- **Standard**: XSS / 不可信 HTML
- **Description**: `marked.parse` 结果直接赋给 `innerHTML`，无 allowlist。聊天路径有 `sanitizeRenderedMarkdown`（`AIPanel.js:244-306`）。
- **Impact**: 恶意习题或导入文件可在模拟器源跑脚本，读取 `ai_session_key`，改电路，向父页 `postMessage`。
- **Fix Recommendation**: 复用 AI 消毒器或 DOMPurify；marked 关闭 raw HTML。MathJax 只排版消毒后的节点。

---

### High

#### H1. 删除已接线元件后存档无法再加载

- **Location**: `src/core/runtime/Circuit.js:243-248`, `src/core/io/CircuitSchemaGateway.js:156-160`
- **Severity**: High
- **Category**: Z1 / Z3
- **Description**: `removeComponent` 不清理导线 `aRef`/`bRef`。schema 要求 ref 指向仍存在的元件。
- **Evidence**: 实机 `reload after delete: THROW wire.bRef.componentId 不存在: R1`
- **Fix Recommendation**: 删除元件时剥离或删除相关导线 ref；序列化时丢弃悬空 ref。

#### H2. 理想电压表 `Infinity` 经 JSON 变成 `null`

- **Location**: `src/core/runtime/CircuitComponentProperties.js`, `JSON.stringify` 语义
- **Severity**: High
- **Category**: Z3 / Z5
- **Evidence**: roundtrip `properties.resistance: null`；加载后 `resistance === Infinity` 为 false，面板可能显示 `null Ω`。求解器把非有限电阻当开路，电学碰巧还能用。
- **Fix Recommendation**: 用哨兵 `"Infinity"` / `null` 并在反序列化还原；schema 显式校验电压表内阻。

#### H3. 电动机印记是 R 并联反电动势，不是电枢串联

- **Location**: `src/core/simulation/ComponentRegistry.js:226-234`, `src/core/simulation/DynamicIntegrator.js:90`
- **Severity**: High
- **Category**: Z2
- **Description**: 同一对端子既 stamp 电阻又 stamp `V = -E`。机械侧却用 `I = (V - E) / R`。`detectConflictingIdealSources` 不看 Motor。
- **Impact**: 堵转电流不是 `V/Ra`，反电动势实验物理错误。
- **Fix Recommendation**: 内部节点或额外未知量实现 `Ra` 与 `E` 串联。补电路级 ω/转矩测试（当前 `tests/solver*.js` 零命中 Motor）。

#### H4. 仅有交流电源时 UI 拒绝开始模拟

- **Location**: `src/app/RuntimeActionRouter.js:23-33`
- **Severity**: High
- **Category**: Z0 / Z2
- **Description**: 启动门只认 `PowerSource`。`ACVoltageSource` 在目录和 AC 子步进里都是一等公民。
- **Impact**: 课本交流电路无法点“运行”。测试直接 `circuit.step()` 所以是绿的。
- **Fix Recommendation**: 把 `ACVoltageSource` 算作电源。

#### H5. 闭合开关电流用 `dV / 1e-9`

- **Location**: `src/core/simulation/ComponentRegistry.js:121-135`
- **Severity**: High
- **Category**: Z2 / Z5
- **Impact**: LU 残差 `1e-6 V` 会读成 `1000 A`。开关自身读数/曲线不可信。
- **Fix Recommendation**: 闭合开关按理想电流表（V=0 源）取额外未知量电流。

#### H6. 嵌入 postMessage 默认 `*`，空 allowlist 放行任意 origin

- **Location**: `src/embed/EmbedRuntimeBridge.js:40,84-90`, `src/embed/EmbedClient.js:80-99`
- **Severity**: High
- **Category**: Z6
- **Description**: `allowedParentOrigins` 为空则 `isOriginAllowed` 恒 true。`setReadonly` 不在只读阻断列表里，可先解冻再 `loadCircuit`。
- **Fix Recommendation**: 默认失败关闭；禁止 `*`；解冻需要显式能力。

#### H7. CDN 脚本无 SRI，MathJax 浮动大版本

- **Location**: `index.html:17-18`
- **Severity**: High
- **Category**: Z6 / Performance
- **Evidence**: `marked@12.0.0` 无 integrity；`mathjax@3` 未钉小版本。CSP 只有 `frame-ancestors *`。
- **Fix Recommendation**: vendor 进 dist，或钉版本 + SRI；AI/习题打开时再加载。

#### H8. 工具箱写“6V”，默认电源是 12V

- **Location**: `index.html:65-68`, `src/v2/infra/components/ComponentDefinitionRegistry.js:47`
- **Severity**: High（教学产品）
- **Category**: Z5
- **Impact**: 高中实验台常见 6V 电源，学生按标签搭电路，数值全偏。
- **Fix Recommendation**: 默认改为 6V，或改快捷标签为 12V。

#### H9. 元件库不可键盘操作

- **Location**: `index.html` `.tool-item` 为 `div[draggable]`, `ToolboxBindingsController.js:67-97`
- **Severity**: High
- **Category**: Z7 / A11y
- **Standard**: WCAG 2.1.1
- **Fix Recommendation**: 改为 `<button>`，Enter/Space 进入待放置。

#### H10. README 指向 CI 禁止的 `src/engine/`

- **Location**: `README.md:79`, `docs/releases/v0.9-rc1-release-notes.md`
- **Severity**: High（onboarding）
- **Category**: Docs
- **Actual path**: `src/core/scenarios/ClassroomScenarioPack.js`
- **Also**: `AGENTS.md` 仍写改 `Solver.js` / `stampComponent`；`test_simple_circuit.json` 不存在。

#### H11. quality job 的 `check:full` 会跑 Playwright，但该 job 不安装浏览器

- **Location**: `.github/workflows/ci.yml` quality vs dedicated e2e jobs
- **Severity**: High（CI 真实性）
- **Category**: Tests
- **Impact**: quality 最后一步在干净 runner 上会因缺 Chromium 失败，或与独立 e2e job 重复并逼近 20 分钟超时。`test:e2e:ai-mobile` 没有带 `--with-deps` 的独立 job。
- **Fix Recommendation**: quality 只跑 `check` + baselines；e2e 留在现有 job。给 ai-mobile 补安装步骤。

#### H12. 两套求解/渲染核未在运行时合一

- **Location**: `src/core/simulation/MNASolver.js` vs `src/v2/simulation/SolveCircuitV2.js`（664 行）；`src/v2/ui/renderers/RendererRegistryV2.js` 无运行时引用
- **Severity**: High（架构）
- **Category**: Z0 / Z2
- **Impact**: coverage 脚本只查 “unsupported component type” 字符串，v2 默认分支静默成功，二极管模型绿假阳性。
- **Fix Recommendation**: v2 solver 做成 `MNASolver` 门面，或从运行时包删除。预算脚本把 `CircuitSolverV2.js` 改成真实文件名。

---

### Medium

| ID | Title | Location | Notes |
|---|---|---|---|
| M1 | 两个接地符号不会并成同一参考点 | `NodeBuilder.js:107-137` | 与课本“地线相连”直觉不符；多 Ground 测试刻意断言孤立 Ground 不是 node 0 |
| M2 | 生产电容默认 `integrationMethod: auto`（先 BE 后梯形），缺字段加载被写成 BE | `ComponentRegistry.js:462+`, `CircuitDeserializer.js:109-112` | 新电路与旧存档瞬态不一致 |
| M3 | 保险丝 I²t 用最后一个子步电流 × 整个 outer dt | `CircuitResultProjectionService.js:71-88` | 交流熔断实验不可靠 |
| M4 | 浮空子电路警告在求解成功时被跳过 | `Circuit.js:801-809` | 两个独立回路都能“工作”却无提示 |
| M5 | 灯泡按线性电阻 stamp | `ComponentRegistry.js:55` | AGENTS.md 已写明；灯丝温度实验做不成 |
| M6 | 属性对话框 schema 只覆盖 6/21 类型 | `ComponentPropertySchema.js:14-45` | Motor 文档有惯量/反电势常数，对话框只有 R 和负载转矩 |
| M7 | 端点编辑双状态：root 标志 + store context | `InteractionStateInitializer.js`, `InteractionModeStore.js` | ADR 说 store 是唯一 SOT |
| M8 | 只读嵌入可用 `setOptions` 解冻；`addComponent` 不看 capability | `EmbedRuntimeRequestRouter.js`, `ComponentActions.js` | CSS `pointer-events:none` 不是安全边界 |
| M9 | 习题板 `min-width: 320px` 与 `max-width: calc(100vw - 32px)` 冲突 | `css/style.css` | 320px 手机横向溢出 |
| M10 | 仿真 `setInterval(10ms)` ≈ 100 Hz UI | `Circuit.js:43` | 远高于刷新率；交流最多 200 子步 |
| M11 | 无暗色主题、无 `prefers-reduced-motion` | `css/style.css` | 投屏/夜间教室、动效无减速 |
| M12 | 热点预算漏掉最大 UI 文件 | ExerciseBoard 964、AIPanel 751、ChatController 750 | 拆分可把行数挪出预算仍过 CI |

---

### Low

| ID | Title |
|---|---|
| L1 | `StampDispatcher` 只映射 Resistor/Bulb，生产路径先走 registry，调度器是死代码 |
| L2 | `InteractionModeStore.legacyFlags` 仍投影旧字段名 |
| L3 | 吸附阈值三套（10 / 15 / 8 px） |
| L4 | ESLint 8 EOL；`.eslintrc.cjs` 仍声明 `src/engine` 层 |
| L5 | `debtDashboard.spec.js` 依赖是否已 build（非隔离） |

## 6. Patterns

1. **`safeInvoke` / 先 clear 后校验** 把本该失败的操作变成静默空电路。
2. **合同测试测替身不测真 `Circuit`**：history、部分 storage、v2 coverage 字符串。
3. **v2 品牌与 v1 内核并存**：入口、目录、schema V3 文件是 v2；步进、渲染、拓扑仍是 core。
4. **文档与 no-compat 政策互相打架**：README 同时写“无迁移器”和“旧观察存档自动归一化”。
5. **教学默认值与高中课桌不一致**：12V / 0.5Ω 内阻 / 线性灯泡。

## 7. Positive findings

- 270 个 spec、1280 项测试、零 skip；P0 / CircuitJS / AI baseline 脚本存在且进 `check:full`。
- Top30 引用的 57 个测试文件、17 篇审计文档全部仍在。
- 生产路径拓扑批处理、LU cache key（含开关/滑变/熔断）、二极管 Shockley、平行板 `εA/d`、AC 子步进都是认真做的。
- 聊天 Markdown 消毒是真 allowlist，不是摆设。
- API 密钥在 **sessionStorage**（`ai_session_key`），与 localStorage 公共配置分离。
- 手机端抽屉、44px 触控、safe-area、手势仲裁有 CSS 合同测试。
- 无生产 npm 依赖；Docker 多阶段 + nginx 1.27 有 `dockerfile.spec.js`。
- Circuit.js 已从历史 1800+ 收到 1059，六个热点均在 hard budget 内。

## 8. Coverage gaps (electrical)

1. Motor：无电路级反电动势/转矩/惯性测试。
2. ParallelPlateCapacitor：无几何参数改变 C 后的 MNA 断言。
3. P0 20 场景不含半导体、继电器、保险丝、SPDT、交流、热敏/光敏、电机、黑箱。
4. `scripts/e2e/mobile-core-learning-flow.mjs` 不是 npm script，CI 不跑。
5. `test:e2e:compat` 写在浏览器矩阵里，不在 CI。
6. 无 Vitest coverage reporter，97 个 interaction 文件的缺口看不见。

## 9. Action plan

| Priority | Issues | Suggested commands | Timeline |
|----------|--------|-------------------|----------|
| Immediate | C1 C2 C3 | `/harden`（存档/撤销/XSS） | 今天 |
| Short-term | H1 H2 H3 H4 H5 | 拓扑 ref、电压表哨兵、电机印记、交流门闩、开关电流 | 本周 |
| Short-term | H6 H7 H11 | 嵌入 origin、SRI/vendor、拆 quality/e2e | 本周 |
| Medium | H8 H9 H10 H12, M* | 默认 6V、键盘托盘、文档、合并 v2 solver | 下个迭代 |
| Backlog | L*, 真机回归 BKL-01, 暗色主题 | `/adapt` `/normalize` `/polish` | 之后 |

建议新开 Top30 候选（不要改写已闭环的 `top30.md` 状态列）：

| id | area | title | status |
|---|---|---|---|
| PRJ-031 | Z3/Z6 | app save meta 被 schema 拒绝 | seed-hypothesis → 本轮已 confirmed |
| PRJ-032 | Z5 | HistoryManager 快照缺 meta，undo 清空 | confirmed |
| PRJ-033 | Z6 | ExerciseBoard 未消毒 innerHTML | confirmed |
| PRJ-034 | Z2 | Motor 并联反电势印记 | confirmed |
| PRJ-035 | Z0 | 启动模拟忽略 ACVoltageSource | confirmed |

## 10. What was not verified in a browser this round

未启动 GUI 做点击走查（无可用 browser MCP）。移动端手势、只读嵌入点击、课堂投屏对比依赖既有 Playwright 脚本与 2026-03 截图。数据完整性四条（C1/C2/H1/H2）用 Node 实机脚本复现。
