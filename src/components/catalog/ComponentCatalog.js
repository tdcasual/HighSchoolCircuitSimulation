/**
 * ComponentCatalog.js - 组件元数据目录
 * 定义默认参数、显示名和端子数量映射。
 */

/**
 * 元器件默认属性
 */
export const ComponentDefaults = {
    Ground: {
        isReference: true      // 参考地
    },
    PowerSource: {
        voltage: 12,           // 电动势 (V)
        internalResistance: 0.5 // 内阻 (Ω)
    },
    ACVoltageSource: {
        rmsVoltage: 12,        // 有效值 (V)
        frequency: 50,         // 频率 (Hz)
        phase: 0,              // 初相 (deg)
        offset: 0,             // 直流偏置 (V)
        internalResistance: 0.5 // 内阻 (Ω)
    },
    Resistor: {
        resistance: 100        // 电阻值 (Ω)
    },
    Diode: {
        forwardVoltage: 0.7,   // 导通压降 (V)
        onResistance: 1,       // 导通等效电阻 (Ω)
        offResistance: 1e9,    // 截止等效电阻 (Ω)
        conducting: false      // 当前导通状态（求解过程会更新）
    },
    LED: {
        forwardVoltage: 2.0,   // 正向导通电压 (V)
        onResistance: 2,       // 导通等效电阻 (Ω)
        offResistance: 1e9,    // 截止等效电阻 (Ω)
        ratedCurrent: 0.02,    // 额定工作电流 (A)
        color: '#ff4d6d',      // 发光颜色
        conducting: false,     // 当前导通状态（求解过程会更新）
        brightness: 0          // 当前亮度（0-1）
    },
    Thermistor: {
        resistanceAt25: 1000,  // 25°C 时电阻值 (Ω)
        beta: 3950,            // Beta 常数 (K)
        temperatureC: 25       // 当前温度 (°C)
    },
    Photoresistor: {
        resistanceDark: 100000, // 暗态电阻 (Ω)
        resistanceLight: 500,   // 亮态电阻 (Ω)
        lightLevel: 0.5         // 光照强度 0..1
    },
    Relay: {
        coilResistance: 200,        // 线圈电阻 (Ω)
        pullInCurrent: 0.02,        // 吸合电流阈值 (A)
        dropOutCurrent: 0.01,       // 释放电流阈值 (A)
        contactOnResistance: 1e-3,  // 触点导通电阻 (Ω)
        contactOffResistance: 1e12, // 触点断开电阻 (Ω)
        energized: false            // 是否吸合
    },
    Rheostat: {
        minResistance: 0,      // 最小电阻 (Ω)
        maxResistance: 100,    // 最大电阻 (Ω)
        position: 0.5,         // 滑块位置 (0-1)
        connectionMode: 'none', // 连接模式
        activeResistance: 0,   // 接入电路的实际电阻
        resistanceDirection: 'disconnected' // 电阻变化方向
    },
    Bulb: {
        resistance: 50,        // 灯丝电阻 (Ω)
        ratedPower: 5          // 额定功率 (W)
    },
    Capacitor: {
        capacitance: 0.001,    // 电容值 (F) = 1000μF
        integrationMethod: 'auto', // 积分方法：auto/trapezoidal/backward-euler
        prevCurrent: 0         // 上一时刻电流 (A)，用于梯形法历史项
    },
    Inductor: {
        inductance: 0.1,       // 电感值 (H)
        initialCurrent: 0,     // 初始电流 (A)
        prevCurrent: 0,        // 上一时刻电流 (A)
        prevVoltage: 0,        // 上一时刻两端电压 (V)，用于梯形法历史项
        integrationMethod: 'auto' // 积分方法：auto/trapezoidal/backward-euler
    },
    ParallelPlateCapacitor: {
        // 平行板电容（用于演示 C 的决定因素）
        plateArea: 0.01,           // 极板面积 A (m²) = 100 cm²
        plateDistance: 0.001,      // 极板间距 d (m) = 1 mm
        dielectricConstant: 1,     // 相对介电常数 εr
        plateOffsetYPx: 0,         // 单极板纵向偏移（用于演示重叠面积），单位：局部像素
        explorationMode: true,     // 是否开启探索模式（允许拖动极板）
        capacitance: 8.854e-11,    // 由默认 A/d 估算得到的电容（F）
        integrationMethod: 'auto', // 积分方法：auto/trapezoidal/backward-euler
        prevCurrent: 0             // 上一时刻电流 (A)，用于梯形法历史项
    },
    Motor: {
        resistance: 5,         // 电枢电阻 (Ω)
        torqueConstant: 0.1,   // 转矩常数 (N·m/A)
        emfConstant: 0.1,      // 反电动势常数 (V·s/rad)
        inertia: 0.01,         // 转动惯量 (kg·m²)
        loadTorque: 0.01       // 负载转矩 (N·m)
    },
    Switch: {
        closed: false          // 开关状态：false=断开，true=闭合
    },
    SPDTSwitch: {
        position: 'a',         // 拨到 a(上掷) / b(下掷)
        onResistance: 1e-9,    // 导通电阻
        offResistance: 1e12    // 断开支路电阻
    },
    Fuse: {
        ratedCurrent: 3,       // 额定电流 (A)
        i2tThreshold: 1,       // 熔断阈值 I²t (A²·s)
        i2tAccum: 0,           // 当前累计 I²t
        coldResistance: 0.05,  // 正常导通电阻 (Ω)
        blownResistance: 1e12, // 熔断后等效电阻 (Ω)
        blown: false           // 是否已熔断
    },
    Ammeter: {
        resistance: 0,         // 内阻 (Ω)，0表示理想电流表
        range: 3,              // 量程 (A)
        selfReading: false     // 自主读数模式（右侧指针表盘）
    },
    Voltmeter: {
        resistance: Infinity,  // 内阻 (Ω)，Infinity表示理想电压表
        range: 15,             // 量程 (V)
        selfReading: false     // 自主读数模式（右侧指针表盘）
    },
    BlackBox: {
        // 黑箱/组合容器：用于遮挡或透明观察内部电路
        boxWidth: 180,         // 盒子宽度（局部坐标 px）
        boxHeight: 110,        // 盒子高度（局部坐标 px）
        viewMode: 'transparent' // 'transparent' | 'opaque'
    }
};

/**
 * 元器件显示名称
 */
export const ComponentNames = {
    Ground: '接地',
    PowerSource: '电源',
    ACVoltageSource: '交流电源',
    Resistor: '定值电阻',
    Diode: '二极管',
    LED: '发光二极管',
    Thermistor: '热敏电阻',
    Photoresistor: '光敏电阻',
    Relay: '继电器',
    Rheostat: '滑动变阻器',
    Bulb: '灯泡',
    Capacitor: '电容',
    Inductor: '电感',
    ParallelPlateCapacitor: '平行板电容',
    Motor: '电动机',
    Switch: '开关',
    SPDTSwitch: '单刀双掷开关',
    Fuse: '保险丝',
    Ammeter: '电流表',
    Voltmeter: '电压表',
    BlackBox: '黑箱'
};

const COMPONENT_TERMINAL_COUNT = Object.freeze({
    Ground: 1,
    Rheostat: 3,
    SPDTSwitch: 3,
    Relay: 4
});

export function getComponentTerminalCount(type) {
    return COMPONENT_TERMINAL_COUNT[type] || 2;
}
