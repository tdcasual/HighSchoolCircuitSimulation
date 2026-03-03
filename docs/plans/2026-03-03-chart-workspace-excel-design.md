# Chart Workspace Excel 化重构设计（v2）

日期：2026-03-03  
状态：已评审（用户确认）  
范围：`ChartWorkspace` 运行时与 UI 重构（允许破坏旧图表兼容）

## 1. 背景与目标

当前图表区采用“内置工具条 + 默认一张悬浮窗”模式，不符合“按需添加、多图并行、围绕图表对象编辑”的目标。  
本次重构目标：

1. 图表通过全局按钮创建，默认 `0` 图表。
2. 单图表支持多系列（series），交互逻辑接近 Excel 图表对象编辑。
3. 保持仿真核心解耦：图表层只消费电路结果，不反向耦合求解器。
4. 强化触控与移动端：在手机上可稳定完成“加图-配系列-运行观察”流程。
5. 代码结构可扩展到后续功能（双Y轴、模板、公式系列等）。

## 2. 方案对比与结论

### 方案A（采用）
- 保留运行时契约 `window.app.chartWorkspace`，内部重构为文档模型与命令式架构。
- 优点：对外契约稳定、与现有 CI 守卫兼容、复用现有 `ObservationSources/ObservationMath`。
- 成本：需要替换当前 `ChartWindowController` 的 UI 结构，并更新 E2E 断言。

### 方案B（不采用）
- 新建独立 `ChartStudio` 主工作台。
- 问题：迁移成本大，移动端与现有画布叠层逻辑冲突更高。

### 方案C（不采用）
- 在现有窗口模型上增量补丁。
- 问题：继续积累耦合，无法满足长期可扩展要求。

## 3. 架构设计

### 3.1 模块拆分

1. `ChartWorkspaceController`（编排层）
- 生命周期、渲染调度、layout mode 响应。
- 不直接承载复杂业务规则。

2. `ChartDocumentStore`（状态层）
- 图表文档单一真相（SoT）。
- 提供读写接口与状态归一化。

3. `ChartCommandService`（命令层）
- `addChart/removeChart/addSeries/updateSeriesBinding/...`
- 所有 UI 行为走命令，避免控制器直接改状态。

4. `ChartSamplingService`（采样层）
- 仅依赖 `circuit.lastResults/simTime` + `ObservationSources`。
- 输出图表/系列采样点，不依赖 DOM。

5. `ChartProjectionService`（投影层）
- 自动量程、ticks、共享轴窗口计算。
- 为渲染层提供 frame 数据。

6. `ChartObjectController`（视图对象层）
- 单图表对象的拖拽、缩放、焦点态、局部重绘。
- 消费投影结果绘制 Canvas。

### 3.2 低耦合边界

- 仿真核心（`Circuit`/`Solver`）不感知图表对象与 UI。
- 图表层通过 `onCircuitUpdate(results)` 被动消费数据。
- 交互层通过 `ChartCommandService` 调用图表能力，不跨层读写内部结构。

## 4. 数据模型（Schema v2）

```js
{
  schemaVersion: 2,
  sampleIntervalMs: 50,
  selection: {
    activeChartId: null,
    activeSeriesId: null
  },
  charts: [
    {
      id: "chart_xxx",
      title: "图表 1",
      frame: { x: 80, y: 80, width: 460, height: 300 },
      zIndex: 1,
      axis: {
        xBinding: { sourceId: "__time__", quantityId: "t", transformId: "identity" },
        xRangeMode: "auto",
        yRangeMode: "auto"
      },
      series: [
        {
          id: "series_xxx",
          name: "系列 1",
          sourceId: "R1",
          quantityId: "I",
          transformId: "identity",
          visible: true,
          color: "#1d4ed8",
          xMode: "shared-x", // shared-x | scatter-override
          scatterXBinding: null
        }
      ],
      ui: {
        legendCollapsed: false
      }
    }
  ]
}
```

关键规则：
- 默认 `charts=[]`（零图表）。
- 图表级共享 X 轴；系列默认 `shared-x`。
- 系列可切换 `scatter-override`，为该系列单独定义 X 数据绑定。

## 5. UI/交互设计（Excel 风格）

### 5.1 全局创建入口

- 桌面顶栏新增：`btn-add-chart`（“添加图表”）。
- 手机更多菜单新增：`btn-mobile-add-chart`。
- 创建行为：插入图表对象并聚焦该图表。

### 5.2 图表编辑流

1. 选中图表进入焦点态（边框高亮 + 图例区显示）。
2. 图例区作为系列管理入口：
- 单击：显示/隐藏系列；
- 双击：重命名系列；
- `+ 系列`：新增系列；
- 菜单：删除、复制、切换散点 X 覆盖。
3. 轴设置是图表级设置（共享轴），避免多系列配置分裂。

### 5.3 触控与移动端

- `desktop/tablet`：支持拖拽与缩放图表对象。
- `phone`：禁自由拖拽，图表停靠画布安全区；系列编辑走底部抽屉，避免遮挡与误触。
- 所有关键操作触点不小于 `44px`。
- 长按图例项弹出系列菜单（替代右键）。

## 6. 与现有代码的集成点

1. `src/ui/charts/ChartWorkspaceController.js`
- 移除内置工具条入口与默认图表注入逻辑。
- 迁移到 v2 文档模型。

2. `src/ui/interaction/PanelBindingsController.js`
- 绑定 `btn-add-chart` / `btn-mobile-add-chart` 到 `chartWorkspace.addChart()`.

3. `index.html` + `src/ui/TopActionMenuController.js`
- 增加全局按钮与手机菜单项。

4. `src/ui/interaction/ProbeActions.js`
- `addProbePlot` 改为“优先加到当前焦点图表；无图表时先建图再加系列”。

5. `src/ui/interaction/MeasurementReadoutController.js`
- “打开图表”行为改为聚焦图表编辑入口，而非仅刷新渲染。

6. `src/app/AppSerialization.js`
- `meta.chartWorkspace` 持久化改写为 schema v2。

## 7. 容错与异常策略

- 求解无效：暂停采样，保留历史点，提示“采样暂停”。
- 数据源失效（元件/探针删除）：系列标记 `orphaned`，图例标红并提供重绑操作。
- 反序列化失败：回退为 `schemaVersion:2 + charts=[]`，并写状态栏提示。
- 不再兼容旧图表行为细节；仅提供一次性 `v1 -> v2` 结构迁移。

## 8. 测试与验收

### 8.1 单元测试

- `chartWorkspace.state.v2.spec.js`：默认零图表、schema 归一化、迁移行为。
- `chartCommandService.spec.js`：加图、加系列、共享轴/散点模式切换。
- `chartSamplingService.spec.js`：有效解采样/无效解暂停。
- `chartProjectionService.spec.js`：自动量程与共享轴稳定性。

### 8.2 交互与E2E

- 桌面：全局按钮加图、多系列增删改、焦点态切换。
- 手机：更多菜单加图、底部抽屉配系列、运行采样。
- 更新 `scripts/e2e/observation-touch-regression.mjs`：默认图表数量断言从 `>=1` 改为 `0`。

### 8.3 契约守卫

- 继续保持 `window.app.chartWorkspace` 作为唯一运行时契约。
- `assert-observation-runtime-contract` 仅校验 `chartWorkspace`，不引入旧路径。

## 9. 实施阶段建议

1. Phase 1：状态层与命令层（无 UI）  
2. Phase 2：全局按钮入口 + 默认零图表  
3. Phase 3：多系列 UI 与共享轴/散点模式  
4. Phase 4：移动端抽屉化与触控细化  
5. Phase 5：E2E/CI 收口

## 10. 非目标

- 本轮不实现双Y轴。
- 本轮不实现跨图表联动光标。
- 本轮不实现图表模板市场或云同步。
