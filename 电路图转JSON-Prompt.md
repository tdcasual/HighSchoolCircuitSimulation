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
    "internalResistance": 1
  }
}
```
- **符号**：长短线（长线为正极），或标注 E、r
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
- **有3个端子！**
  - 端子0 = a端（左/上固定端）
  - 端子1 = b端（右/下固定端）
  - 端子2 = P端（滑动触点）
- **端子位置**（根据rotation）：
  - rotation=0: 端子0在左，端子1在右，端子2在上方中间
  - **rotation=90**: 端子0在上，端子1在下，端子2在右侧中间 ← **垂直放置**
- **常见连接方式**：
  - 使用a-b两端（端子0和端子1）：接入全部电阻
  - 使用a-P两端（端子0和端子2）：接入部分电阻，滑块位置决定阻值
  - 使用P-b两端（端子2和端子1）：接入部分电阻

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
- **端子位置**：rotation=90时，端子0在上，端子1在下

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
- **连接方式**：必须串联在电路中
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
- **连接方式**：必须并联在被测元件两端
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
    "torqueConstant": 0.1
  }
}
```
- **符号**：圆圈内标 M

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

| 图中符号 | 元器件类型 | type值 | 常用rotation |
|---------|-----------|--------|-------------|
| 长短线（E, r） | 电源 | PowerSource | 270 |
| 矩形框（R₁, R₂...） | 定值电阻 | Resistor | 0或90 |
| 矩形框+箭头+a,b标记 | 滑动变阻器 | Rheostat | 90 |
| 两平行线（C） | 电容 | Capacitor | 90 |
| 圆圈+×或螺旋 | 灯泡 | Bulb | 90 |
| 断开触点 | 开关 | Switch | 0 |
| 圆圈+A | 电流表 | Ammeter | 0 |
| 圆圈+V | 电压表 | Voltmeter | 90 |
| 圆圈+M | 电动机 | Motor | 90 |

---

## ⚠️ 常见错误提醒

1. **电压表连接错误**：电压表必须并联！两个端子分别连接到被测元件的两端
2. **电流表连接错误**：电流表必须串联！电流要流过电流表
3. **滑动变阻器端子混淆**：注意区分端子0(a端)、端子1(b端)、端子2(滑动端P)
4. **并联节点遗漏导线**：多个元器件并联时，每个元器件都需要单独的导线连接到公共节点
5. **电源极性错误**：rotation=270时，端子1(正极)在上，端子0(负极)在下
6. **坐标超出范围**：保持坐标在合理范围内(100-1000, 100-600)

---

## 输出要求

请直接输出完整的JSON代码，确保：
1. JSON格式正确，可以直接解析
2. 所有元器件ID唯一
3. 所有导线的端子引用正确
4. 电路拓扑与原图一致
