# AI Image-to-Circuit Quality Improvement Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 显著提升“图片转电路”质量，使结果从“可解析 JSON”升级为“可解、可用、少人工修正”的教学电路。

**Architecture:** 采用“模型前置约束 + 结构归一化 + 电气有效性验证 + 失败自修复”四层流水线。先提高模型输出正确率，再在本地进行拓扑/端子修复，最后以求解器有效性作为硬门槛。

**Tech Stack:** Vanilla JS, OpenAI-compatible API, existing `CircuitAIAgent` skills pipeline, Vitest.

---

### Task 1: Prompt 统一与过时规则清理

**Files:**
- Modify: `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/电路图转JSON-Prompt.md`
- Modify: `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/src/ai/agent/CircuitAIAgent.js`

**Step 1: 统一导线规范为 v2**
- 删除文档中 `start/end/controlPoints` 作为主格式的描述。
- 明确仅允许 `wires[].a/b`，可选 `aRef/bRef`。

**Step 2: 同步当前支持元件全集**
- Prompt 中列出当前代码支持类型（含 `Diode/LED/Thermistor/Photoresistor/Relay/Fuse/SPDTSwitch/BlackBox/Inductor/ParallelPlateCapacitor/ACVoltageSource/Ground`）。

**Step 3: 缩短高噪音说明**
- 把“布局模板大段说明”压缩为 8~12 条强约束规则，减少模型跑偏。

**Acceptance:**
- Prompt 中不再出现“主输出使用 start/end”的指导。
- Prompt 类型列表与 `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/src/components/Component.js` 一致。

---

### Task 2: 模型选择与调用策略修复

**Files:**
- Modify: `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/src/ui/AIPanel.js`
- Modify: `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/src/ai/OpenAIClient.js`

**Step 1: 视觉模型列表过滤**
- `vision-model-select` 只显示多模态模型，不再把所有模型都放入视觉下拉。

**Step 2: 转图场景低温度**
- 在 `callAPI` 支持按 source 指定温度；`ai_agent.convert_image` 使用更保守温度（0 或 0.1）。

**Step 3: 更稳妥的 endpoint 路由**
- 对多模态优先走更稳定的 API 路径，确保 `responses/chat-completions` 的模型能力匹配。

**Acceptance:**
- UI 无法误选纯文本模型用于图片转图。
- 转图请求具备独立 temperature 策略，不复用聊天温度。

---

### Task 3: JSON 归一化增强（结构到拓扑）

**Files:**
- Modify: `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/src/ai/skills/CircuitJsonNormalizationSkill.js`
- Add: `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/src/ai/skills/CircuitTopologyRepairSkill.js`
- Modify: `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/src/ai/agent/CircuitAIAgent.js`

**Step 1: 类型与字段修复**
- 处理常见别名映射（如 `VoltageSource -> PowerSource`，`Lamp -> Bulb`），未知类型标记为错误而非静默放行。

**Step 2: 端子绑定补全**
- 若 `aRef/bRef` 缺失，基于端点坐标近邻匹配端子并补全引用。

**Step 3: 近邻端点吸附**
- 对距离阈值内的“几乎接上”导线端点进行吸附，减少视觉连通但电气断路。

**Step 4: 历史折线修复保留**
- 保留现有 legacy wire 兼容逻辑，但统一输出 v2。

**Acceptance:**
- 输出 wire 的可绑定率显著提升（`aRef/bRef` 覆盖率提升）。
- 近邻误差不再导致大面积断路。

---

### Task 4: 电气有效性验证升级（硬门槛）

**Files:**
- Modify: `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/src/utils/circuitSchema.js`
- Modify: `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/src/ai/skills/CircuitJsonValidationSkill.js`

**Step 1: 组件类型白名单校验**
- 使用当前组件定义作为白名单，拒绝未知 type。

**Step 2: 端子索引按元件类型校验**
- 不再固定 `0..2`；按实际端子数校验（例如 `Relay` 支持 4 端）。

**Step 3: 基础连通性校验**
- 检查孤立元件、悬空导线、无电源等关键错误并返回机器可读错误码。

**Step 4: 试运行验证**
- 在验证阶段调用 `Circuit.fromJSON -> rebuildNodes -> solve`，无效则返回可修复错误。

**Acceptance:**
- 能明确拒绝“结构合法但电气无效”的结果。
- 错误报告可用于后续自动修复提示。

---

### Task 5: 失败自动修复回路（最多 N 次）

**Files:**
- Modify: `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/src/ai/agent/CircuitAIAgent.js`

**Step 1: 增加 repair loop**
- 初次结果失败后，把校验错误摘要回传模型请求“最小改动修复 JSON”。

**Step 2: 限制重试次数**
- 最多 2 次修复；防止死循环和延迟失控。

**Step 3: 修复优先级**
- 先修 `type/terminal/ref/坐标`，后修参数。

**Acceptance:**
- 转图成功率提高，且失败时错误更可解释。

---

### Task 6: UX 与可观测性

**Files:**
- Modify: `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/src/ui/AIPanel.js`
- Modify: `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/src/ai/AILogService.js`

**Step 1: 展示质量摘要**
- 在“转换成功”旁显示：元件数、导线数、未绑定端子数、修复轮次、求解有效性。

**Step 2: 失败提示分级**
- 区分“模型识别失败 / 拓扑修复失败 / 求解失败”，给可操作建议。

**Step 3: 可导出诊断包**
- 日志内包含 raw response、normalized JSON、validation errors（注意隐藏 key）。

**Acceptance:**
- 用户能知道“差在哪里”，不是只看到笼统失败。

---

### Task 7: 测试与回归基线

**Files:**
- Modify: `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/tests/circuitAIAgent.spec.js`
- Modify: `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/tests/circuitJsonNormalizationSkill.spec.js`
- Modify: `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/tests/circuitSchema.spec.js`
- Add: `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/tests/aiImagePipeline.repair.spec.js`

**Step 1: 新增失败-修复链路测试**
- Mock 首次错误 JSON，验证 repair loop 可收敛。

**Step 2: 端子索引类型化校验测试**
- 覆盖 `Relay/SPDTSwitch/Rheostat/Ground`。

**Step 3: 端到端契约测试（mock）**
- 验证输出至少满足：可加载、可 rebuildNodes、至少一次 solve valid。

**Step 4: 回归门槛**
- 把转图质量关键指标纳入 baseline（可先 mock 场景）。

**Acceptance:**
- 新增测试在 CI 稳定通过，能拦截明显回归。

---

### Task 8: 发布策略与灰度

**Files:**
- Modify: `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/src/ai/OpenAIClient.js`
- Modify: `/Users/lvxiaoer/Documents/HighSchoolCircuitSimulation/src/ui/AIPanel.js`

**Step 1: Feature flag**
- 增加 `imagePipelineVersion`（v1/v2）开关，保留回滚能力。

**Step 2: 灰度启用**
- 默认内部开启 v2；出现异常可一键回退。

**Acceptance:**
- 发布后出现问题可无损回滚。

---

## Milestones

1. **M1（1-2 天）**：Task 1 + Task 2（快速止损，先减少明显误识别）
2. **M2（2-4 天）**：Task 3 + Task 4（结构与电气双重提升）
3. **M3（1-2 天）**：Task 5 + Task 6（稳定性与可解释性）
4. **M4（1-2 天）**：Task 7 + Task 8（可持续维护与上线安全）

## Success Metrics

- 首次转换可导入成功率 ≥ 85%
- 可求解（`solve.valid=true`）比例 ≥ 75%
- 人工修线次数中位数下降 50%+
- 严重失败（完全不可用）比例 < 10%

