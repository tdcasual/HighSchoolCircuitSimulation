# 电路图转JSON格式转换 Prompt

## 任务描述
请将图片中的电路图转换为可以直接导入电学模拟工具的JSON格式。

---

## JSON格式规范

### 整体结构
```json
{
  "meta": {
    "version": "1.0",
    "timestamp": <当前时间戳毫秒>,
    "name": "电路设计"
  },
  "components": [ /* 元器件数组 */ ],
  "wires": [ /* 导线数组 */ ]
}
```

### 元器件通用结构
```json
{
  "id": "<类型>_<序号>",
  "type": "<元器件类型>",
  "x": <中心X坐标>,
  "y": <中心Y坐标>,
  "rotation": <旋转角度>,
  "properties": { /* 类型特定属性 */ },
  "terminalExtensions": { /* 可选：端子延长 */ }
}
```

---

## 元器件类型及属性

### 1. 电源 (PowerSource)
```json
{
  "id": "PowerSource_1",
  "type": "PowerSource",
  "x": 200,
  "y": 400,
  "rotation": 270,
  "properties": {
    "voltage": 12,
    "internalResistance": 0.5
  }
}
```
- **符号**：长短线（长线为正极），或标注 E、r
- **默认值**：voltage=12V, internalResistance=0.5Ω
- **端子相对坐标**：端子0(-30,0)，端子1(+30,0)
- **端子位置**（根据rotation）：
  - rotation=0: 端子0在左(负极)，端子1在右(正极)
  - rotation=90: 端子0在上(负极)，端子1在下(正极)
  - rotation=180: 端子0在右(负极)，端子1在左(正极)
  - **rotation=270**: 端子0在下(负极)，端子1在上(正极) ← **最常用，电源竖直放置，正极在上**

### 2. 定值电阻 (Resistor)
```json
{
  "id": "Resistor_R1",
  "type": "Resistor",
  "x": 400,
  "y": 100,
  "rotation": 0,
  "properties": {
    "resistance": 10
  }
}
```
- **符号**：矩形框，标注 R₁、R₂ 等
- **默认值**：resistance=100Ω
- **端子相对坐标**：端子0(-30,0)，端子1(+30,0)
- **端子位置**（根据rotation）：
  - **rotation=0**: 端子0在左，端子1在右 ← **水平放置**
  - **rotation=90**: 端子0在上，端子1在下 ← **垂直放置**

### 3. 滑动变阻器 (Rheostat) ⚠️重要
```json
{
  "id": "Rheostat_R4",
  "type": "Rheostat",
  "x": 800,
  "y": 350,
  "rotation": 90,
  "properties": {
    "minResistance": 0,
    "maxResistance": 20,
    "position": 0.5
  }
}
```
- **符号**：矩形框带箭头滑块，标注如 R₄ 或带 a、b 标记
- **默认值**：minResistance=0Ω, maxResistance=100Ω, position=0.5
- **有3个端子！**
  - 端子0 = a端（左/上固定端），相对坐标(-35,0)
  - 端子1 = b端（右/下固定端），相对坐标(+35,0)
  - 端子2 = P端（滑动触点），相对坐标(滑块位置,-28)
- **端子位置**（根据rotation）：
  - rotation=0: 端子0在左，端子1在右，端子2在上方中间
  - **rotation=90**: 端子0在上，端子1在下，端子2在右侧中间 ← **垂直放置**
- **连接模式**（系统自动检测）：
  - `left-slider`：使用端子0(a)和端子2(P)，接入R₁ = position × maxResistance
  - `right-slider`：使用端子1(b)和端子2(P)，接入R₂ = (1-position) × maxResistance
  - `left-right`：使用端子0(a)和端子1(b)，接入全部电阻 = maxResistance
  - `all`：三个端子全部接入电路，显示两段电压(U₁/U₂)，只显示R₁阻值

### 4. 电容 (Capacitor)
```json
{
  "id": "Capacitor_1",
  "type": "Capacitor",
  "x": 600,
  "y": 400,
  "rotation": 90,
  "properties": {
    "capacitance": 0.001
  }
}
```
- **符号**：两条平行线，标注 C
- **默认值**：capacitance=0.001F (1000μF)
- **端子相对坐标**：端子0(-30,0)，端子1(+30,0)
- **端子位置**：rotation=90时，端子0在上，端子1在下
- **注意**：在直流稳态分析中，电容相当于开路

### 5. 灯泡 (Bulb)
```json
{
  "id": "Bulb_1",
  "type": "Bulb",
  "x": 500,
  "y": 350,
  "rotation": 90,
  "properties": {
    "resistance": 50,
    "ratedPower": 5
  }
}
```
- **符号**：圆圈内带×或螺旋线
- **默认值**：resistance=50Ω, ratedPower=5W
- **端子相对坐标**：端子0(-30,0)，端子1(+30,0)
- **视觉效果**：功率越接近额定功率，灯泡越亮（通过SVG滤镜实现）

### 6. 开关 (Switch)
```json
{
  "id": "Switch_1",
  "type": "Switch",
  "x": 450,
  "y": 300,
  "rotation": 0,
  "properties": {
    "closed": false
  }
}
```
- **符号**：断开的触点
- **默认值**：closed=false（断开状态）
- **端子相对坐标**：端子0(-30,0)，端子1(+30,0)
- **状态**：closed=true时闭合，电流可以通过；closed=false时断开，电路断路

### 7. 电流表 (Ammeter)
```json
{
  "id": "Ammeter_1",
  "type": "Ammeter",
  "x": 250,
  "y": 550,
  "rotation": 0,
  "properties": {
    "resistance": 0,
    "range": 3
  }
}
```
- **符号**：圆圈内标 A
- **默认值**：resistance=0Ω（理想电流表），range=3A
- **连接方式**：必须串联在电路中
- **端子相对坐标**：端子0(-30,0)，端子1(+30,0)
- **端子位置**：rotation=0时，端子0在左，端子1在右

### 8. 电压表 (Voltmeter)
```json
{
  "id": "Voltmeter_1",
  "type": "Voltmeter",
  "x": 500,
  "y": 350,
  "rotation": 90,
  "properties": {
    "resistance": null,
    "range": 15
  }
}
```
- **符号**：圆圈内标 V 或 V₁、V₂
- **默认值**：resistance=Infinity（理想电压表），range=15V
- **resistance属性**：
  - `null` 或省略：理想电压表，内阻无穷大，不影响电路
  - 数值（如3000）：非理想电压表，有限内阻，会分流
- **连接方式**：必须并联在被测元件两端
- **端子相对坐标**：端子0(-30,0)，端子1(+30,0)
- **端子位置**：rotation=90时，端子0在上(接高电位)，端子1在下(接低电位)

### 9. 电动机 (Motor)
```json
{
  "id": "Motor_1",
  "type": "Motor",
  "x": 500,
  "y": 400,
  "rotation": 90,
  "properties": {
    "resistance": 5,
    "torqueConstant": 0.1,
    "emfConstant": 0.1,
    "inertia": 0.01,
    "loadTorque": 0.01
  }
}
```
- **符号**：圆圈内标 M
- **默认值**：resistance=5Ω, torqueConstant=0.1, emfConstant=0.1, inertia=0.01, loadTorque=0.01
- **端子相对坐标**：端子0(-30,0)，端子1(+30,0)
- **特性**：电动机有反电动势，实际消耗功率=机械功率+热功率

---

## 端子延伸功能

当元器件需要更长的引线时，可以使用 `terminalExtensions` 属性延长端子：

```json
{
  "id": "Resistor_R1",
  "type": "Resistor",
  "x": 400,
  "y": 100,
  "rotation": 0,
  "properties": { "resistance": 10 },
  "terminalExtensions": {
    "0": { "x": -20, "y": 0 },
    "1": { "x": 20, "y": 0 }
  }
}
```

- **格式**：`{ "端子索引": { "x": 偏移量, "y": 偏移量 } }`
- **偏移量**：相对于默认端子位置的增量，正值向外延伸
- **应用场景**：元器件间距较大时，避免导线过长
- **注意**：偏移量是在元器件本地坐标系中的，会随rotation旋转

---

## 导线格式

```json
{
  "id": "wire_1",
  "start": { "componentId": "PowerSource_1", "terminalIndex": 1 },
  "end": { "componentId": "Resistor_R1", "terminalIndex": 0 },
  "controlPoints": []
}
```

**重要规则**：
- 每条导线连接两个元器件的端子
- 如果多个元器件连接到同一个节点（如并联分支点），需要分别创建导线从该节点连接到各个元器件
- controlPoints 用于导线需要转折的路径点，格式：`[{"x": 300, "y": 200}, ...]`

---

## 布局规则 ⚠️关键

### 坐标系统
- 画布左上角为原点 (0, 0)
- x 向右增加，y 向下增加
- **建议画布范围**：x: 100-1000, y: 100-600

### 标准布局模板（矩形电路）

对于典型的矩形电路布局：

```
        y=100 ----[R1]----[R2]----     （顶部水平主干）
                  |       |      |
        y=250     |      [V]    [R3]   （中间垂直支路）
                  |       |      |
        y=400   [E/r]     |     [R4]   （电源和其他元件）
                  |       |      |
        y=550 ---[A]-------------      （底部水平主干）
              x=200    x=500   x=800
```

### 元器件间距建议
- 水平方向：相邻元器件 x 间距约 150-200 像素
- 垂直方向：相邻元器件 y 间距约 100-150 像素
- 并联支路：各支路 x 坐标间距约 150-200 像素

### 旋转方向选择
- **水平导线上的元器件**：rotation = 0
- **垂直导线上的元器件**：rotation = 90
- **电源通常竖直放置**：rotation = 270（正极在上）

---

## 转换步骤

### 第1步：识别电路拓扑
1. 找到电源，确定正负极
2. 从正极出发，跟踪电流路径
3. 识别串联部分和并联分支点
4. 标记所有并联的元器件组

### 第2步：规划坐标布局
1. 确定电路的整体形状（通常是矩形）
2. 分配水平主干的 y 坐标（上边和下边）
3. 分配垂直支路的 x 坐标
4. 为每个元器件分配具体坐标

### 第3步：确定元器件方向
1. 水平放置的元器件用 rotation=0
2. 垂直放置的元器件用 rotation=90
3. 电源通常用 rotation=270

### 第4步：创建导线连接
1. 按电流方向依次连接元器件
2. 并联分支点需要多条导线
3. 复杂路径使用 controlPoints 指定转折点

---

## 完整示例：典型物理实验电路

电路描述：电源E(内阻r)串联R₁和电流表A，R₁后分出三条并联支路：电压表V、电阻R₃、以及R₂串联滑动变阻器R₄(a-b端)

```json
{
  "meta": {
    "version": "1.0",
    "timestamp": 1733400000000,
    "name": "物理实验电路"
  },
  "components": [
    {
      "id": "PowerSource_1",
      "type": "PowerSource",
      "x": 200,
      "y": 350,
      "rotation": 270,
      "properties": { "voltage": 12, "internalResistance": 1 }
    },
    {
      "id": "Resistor_R1",
      "type": "Resistor",
      "x": 350,
      "y": 100,
      "rotation": 0,
      "properties": { "resistance": 10 }
    },
    {
      "id": "Ammeter_1",
      "type": "Ammeter",
      "x": 250,
      "y": 550,
      "rotation": 0,
      "properties": { "resistance": 0, "range": 3 }
    },
    {
      "id": "Voltmeter_1",
      "type": "Voltmeter",
      "x": 500,
      "y": 350,
      "rotation": 90,
      "properties": { "resistance": null, "range": 15 }
    },
    {
      "id": "Resistor_R3",
      "type": "Resistor",
      "x": 620,
      "y": 350,
      "rotation": 90,
      "properties": { "resistance": 20 }
    },
    {
      "id": "Resistor_R2",
      "type": "Resistor",
      "x": 800,
      "y": 100,
      "rotation": 0,
      "properties": { "resistance": 15 }
    },
    {
      "id": "Rheostat_R4",
      "type": "Rheostat",
      "x": 900,
      "y": 350,
      "rotation": 90,
      "properties": { "minResistance": 0, "maxResistance": 20, "position": 0.5 }
    }
  ],
  "wires": [
    {
      "id": "wire_1",
      "start": { "componentId": "PowerSource_1", "terminalIndex": 1 },
      "end": { "componentId": "Resistor_R1", "terminalIndex": 0 },
      "controlPoints": [{ "x": 200, "y": 100 }]
    },
    {
      "id": "wire_2",
      "start": { "componentId": "Resistor_R1", "terminalIndex": 1 },
      "end": { "componentId": "Voltmeter_1", "terminalIndex": 0 },
      "controlPoints": [{ "x": 500, "y": 100 }]
    },
    {
      "id": "wire_3",
      "start": { "componentId": "Resistor_R1", "terminalIndex": 1 },
      "end": { "componentId": "Resistor_R3", "terminalIndex": 0 },
      "controlPoints": [{ "x": 620, "y": 100 }]
    },
    {
      "id": "wire_4",
      "start": { "componentId": "Resistor_R1", "terminalIndex": 1 },
      "end": { "componentId": "Resistor_R2", "terminalIndex": 0 },
      "controlPoints": []
    },
    {
      "id": "wire_5",
      "start": { "componentId": "Resistor_R2", "terminalIndex": 1 },
      "end": { "componentId": "Rheostat_R4", "terminalIndex": 0 },
      "controlPoints": [{ "x": 900, "y": 100 }]
    },
    {
      "id": "wire_6",
      "start": { "componentId": "PowerSource_1", "terminalIndex": 0 },
      "end": { "componentId": "Ammeter_1", "terminalIndex": 0 },
      "controlPoints": []
    },
    {
      "id": "wire_7",
      "start": { "componentId": "Ammeter_1", "terminalIndex": 1 },
      "end": { "componentId": "Voltmeter_1", "terminalIndex": 1 },
      "controlPoints": [{ "x": 500, "y": 550 }]
    },
    {
      "id": "wire_8",
      "start": { "componentId": "Ammeter_1", "terminalIndex": 1 },
      "end": { "componentId": "Resistor_R3", "terminalIndex": 1 },
      "controlPoints": [{ "x": 620, "y": 550 }]
    },
    {
      "id": "wire_9",
      "start": { "componentId": "Ammeter_1", "terminalIndex": 1 },
      "end": { "componentId": "Rheostat_R4", "terminalIndex": 1 },
      "controlPoints": [{ "x": 900, "y": 550 }]
    }
  ]
}
```

---

## 常见电路符号对照表

| 图中符号 | 元器件类型 | type值 | 常用rotation | 端子数 |
|---------|-----------|--------|-------------|-------|
| 长短线（E, r） | 电源 | PowerSource | 270 | 2 |
| 矩形框（R₁, R₂...） | 定值电阻 | Resistor | 0或90 | 2 |
| 矩形框+箭头+a,b,P标记 | 滑动变阻器 | Rheostat | 90 | 3 |
| 两平行线（C） | 电容 | Capacitor | 90 | 2 |
| 圆圈+×或螺旋 | 灯泡 | Bulb | 90 | 2 |
| 断开触点 | 开关 | Switch | 0 | 2 |
| 圆圈+A | 电流表 | Ammeter | 0 | 2 |
| 圆圈+V | 电压表 | Voltmeter | 90 | 2 |
| 圆圈+M | 电动机 | Motor | 90 | 2 |

---

## 元器件属性默认值速查

| 类型 | 属性 | 默认值 | 单位 |
|-----|------|-------|-----|
| PowerSource | voltage | 12 | V |
| PowerSource | internalResistance | 0.5 | Ω |
| Resistor | resistance | 100 | Ω |
| Rheostat | minResistance | 0 | Ω |
| Rheostat | maxResistance | 100 | Ω |
| Rheostat | position | 0.5 | 0-1 |
| Bulb | resistance | 50 | Ω |
| Bulb | ratedPower | 5 | W |
| Capacitor | capacitance | 0.001 | F |
| Motor | resistance | 5 | Ω |
| Switch | closed | false | - |
| Ammeter | resistance | 0 | Ω |
| Ammeter | range | 3 | A |
| Voltmeter | resistance | Infinity | Ω |
| Voltmeter | range | 15 | V |

---

## ⚠️ 常见错误提醒

1. **电压表连接错误**：电压表必须并联！两个端子分别连接到被测元件的两端
2. **电流表连接错误**：电流表必须串联！电流要流过电流表
3. **滑动变阻器端子混淆**：注意区分端子0(a端)、端子1(b端)、端子2(滑动端P)
4. **并联节点遗漏导线**：多个元器件并联时，每个元器件都需要单独的导线连接到公共节点
5. **电源极性错误**：rotation=270时，端子1(正极)在上，端子0(负极)在下
6. **坐标超出范围**：保持坐标在合理范围内(100-1000, 100-600)
7. **电压表内阻设置**：如需理想电压表，resistance设为null或省略；如需非理想电压表，设置具体阻值
8. **开关状态**：默认closed=false为断开，需要闭合电路时设为true
9. **滑动变阻器position**：值范围0-1，0表示滑块在最左/上，1表示最右/下
10. **ID命名规则**：建议使用`<类型>_<标识>`格式，如`Resistor_R1`、`PowerSource_E1`

---

## 电路分析特性

### 求解器说明
- 使用修正节点分析法(MNA)求解电路
- 电源内阻使用Norton等效处理
- 理想电压表(内阻无穷大)不参与电路计算，只测量两端电压
- 断开的开关相当于开路
- 电容在直流稳态下相当于开路

### 电流方向约定
- 系统显示的是**正电荷方向**（传统电流方向）
- 电流从电源正极流出，经外电路流向负极
- 电流动画使用CSS stroke-dasharray实现流动效果

### 短路检测
- 系统会自动检测短路情况
- 短路时会显示警告信息，电流显示可能出现异常值

---

## 输出要求

请直接输出完整的JSON代码，确保：
1. JSON格式正确，可以直接解析
2. 所有元器件ID唯一
3. 所有导线的端子引用正确
4. 电路拓扑与原图一致
5. 属性值类型正确（数值不加引号，布尔值用true/false）

---

## 附录：JSON格式兼容性

系统同时支持两种导线格式：

**新格式（推荐）**：
```json
{
  "id": "wire_1",
  "start": { "componentId": "PowerSource_1", "terminalIndex": 1 },
  "end": { "componentId": "Resistor_R1", "terminalIndex": 0 },
  "controlPoints": []
}
```

**旧格式（兼容）**：
```json
{
  "id": "wire_1",
  "startComponentId": "PowerSource_1",
  "startTerminalIndex": 1,
  "endComponentId": "Resistor_R1",
  "endTerminalIndex": 0,
  "controlPoints": []
}
```

---

## 附录：简单电路示例

### 示例1：简单串联电路
电源串联一个电阻和电流表

```json
{
  "meta": { "version": "1.0", "name": "简单串联电路" },
  "components": [
    {
      "id": "PowerSource_1",
      "type": "PowerSource",
      "x": 200, "y": 300,
      "rotation": 270,
      "properties": { "voltage": 6, "internalResistance": 0 }
    },
    {
      "id": "Resistor_R1",
      "type": "Resistor",
      "x": 400, "y": 150,
      "rotation": 0,
      "properties": { "resistance": 10 }
    },
    {
      "id": "Ammeter_A",
      "type": "Ammeter",
      "x": 400, "y": 450,
      "rotation": 0,
      "properties": { "resistance": 0, "range": 3 }
    }
  ],
  "wires": [
    {
      "id": "wire_1",
      "start": { "componentId": "PowerSource_1", "terminalIndex": 1 },
      "end": { "componentId": "Resistor_R1", "terminalIndex": 0 },
      "controlPoints": [{ "x": 200, "y": 150 }]
    },
    {
      "id": "wire_2",
      "start": { "componentId": "Resistor_R1", "terminalIndex": 1 },
      "end": { "componentId": "Ammeter_A", "terminalIndex": 1 },
      "controlPoints": [{ "x": 600, "y": 150 }, { "x": 600, "y": 450 }]
    },
    {
      "id": "wire_3",
      "start": { "componentId": "PowerSource_1", "terminalIndex": 0 },
      "end": { "componentId": "Ammeter_A", "terminalIndex": 0 },
      "controlPoints": [{ "x": 200, "y": 450 }]
    }
  ]
}
```

### 示例2：滑动变阻器电路（使用端子0和端子2）
```json
{
  "meta": { "version": "1.0", "name": "滑动变阻器分压电路" },
  "components": [
    {
      "id": "PowerSource_1",
      "type": "PowerSource",
      "x": 150, "y": 300,
      "rotation": 270,
      "properties": { "voltage": 12, "internalResistance": 0.5 }
    },
    {
      "id": "Rheostat_R",
      "type": "Rheostat",
      "x": 400, "y": 300,
      "rotation": 90,
      "properties": { "minResistance": 0, "maxResistance": 50, "position": 0.3 }
    },
    {
      "id": "Voltmeter_V",
      "type": "Voltmeter",
      "x": 550, "y": 300,
      "rotation": 90,
      "properties": { "resistance": null, "range": 15 }
    }
  ],
  "wires": [
    {
      "id": "wire_1",
      "start": { "componentId": "PowerSource_1", "terminalIndex": 1 },
      "end": { "componentId": "Rheostat_R", "terminalIndex": 0 },
      "controlPoints": [{ "x": 150, "y": 150 }, { "x": 400, "y": 150 }]
    },
    {
      "id": "wire_2",
      "start": { "componentId": "PowerSource_1", "terminalIndex": 0 },
      "end": { "componentId": "Rheostat_R", "terminalIndex": 2 },
      "controlPoints": [{ "x": 150, "y": 450 }, { "x": 450, "y": 450 }, { "x": 450, "y": 300 }]
    },
    {
      "id": "wire_3",
      "start": { "componentId": "Rheostat_R", "terminalIndex": 0 },
      "end": { "componentId": "Voltmeter_V", "terminalIndex": 0 },
      "controlPoints": [{ "x": 550, "y": 150 }]
    },
    {
      "id": "wire_4",
      "start": { "componentId": "Rheostat_R", "terminalIndex": 2 },
      "end": { "componentId": "Voltmeter_V", "terminalIndex": 1 },
      "controlPoints": [{ "x": 550, "y": 450 }]
    }
  ]
}
```
