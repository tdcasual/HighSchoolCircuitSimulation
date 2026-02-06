/**
 * HighSchoolCircuitKnowledge.js
 * Local teaching resources used by the AI agent (MCP-ready provider fallback).
 */

export const HIGH_SCHOOL_CIRCUIT_KNOWLEDGE_VERSION = 'HS-CIRCUIT-RULES-2026.02';

export const HIGH_SCHOOL_CIRCUIT_KNOWLEDGE = Object.freeze([
    {
        id: 'ohm-law',
        title: '欧姆定律',
        category: 'formula',
        keywords: ['欧姆', '电流', '电压', '电阻', 'u=ir', 'i=u/r'],
        appliesTo: ['Resistor', 'Bulb', 'PowerSource', 'Rheostat'],
        content: '纯电阻支路优先使用 I=U/R。已知两量可求第三量，并保持单位一致（V、A、Ω）。'
    },
    {
        id: 'series-parallel',
        title: '串并联识别',
        category: 'topology',
        keywords: ['串联', '并联', '分压', '分流', '等效电阻'],
        appliesTo: ['Resistor', 'Bulb', 'Rheostat'],
        content: '串联电流相等、并联电压相等。先按节点关系判拓扑，再做等效化简，避免误判。'
    },
    {
        id: 'power-relation',
        title: '功率关系',
        category: 'formula',
        keywords: ['功率', '发热', 'p=ui', 'p=i2r', 'p=u2/r'],
        appliesTo: ['Resistor', 'Bulb', 'Motor'],
        content: '电阻类元件常用 P=UI、P=I²R、P=U²/R 交叉校验，结论应能互相一致。'
    },
    {
        id: 'voltmeter-rule',
        title: '电压表连接规则',
        category: 'instrument',
        keywords: ['电压表', '并联', '读数', '量程'],
        appliesTo: ['Voltmeter'],
        content: '电压表应并联在被测两端；理想电压表内阻近似无穷大，理论上不分流。'
    },
    {
        id: 'ammeter-rule',
        title: '电流表连接规则',
        category: 'instrument',
        keywords: ['电流表', '串联', '读数', '量程'],
        appliesTo: ['Ammeter'],
        content: '电流表应串联在支路中；理想电流表内阻近似为零，压降应接近 0。'
    },
    {
        id: 'rheostat-modes',
        title: '滑动变阻器接法',
        category: 'topology',
        keywords: ['滑动变阻器', '滑片', '接法', '阻值变化'],
        appliesTo: ['Rheostat'],
        content: '常用“固定端+滑片”接法。滑片移动会改变接入电阻，进而改变支路电流和分压。'
    },
    {
        id: 'source-internal-r',
        title: '电源内阻影响',
        category: 'misconception',
        keywords: ['内阻', '端电压', '外电路', '电源'],
        appliesTo: ['PowerSource', 'ACVoltageSource'],
        content: '有内阻时端电压会随电流变化。负载增大通常导致端电压下降，需区分电动势与端电压。'
    },
    {
        id: 'capacitor-dc',
        title: '电容直流特性',
        category: 'dynamic',
        keywords: ['电容', '充电', '放电', '稳态', '瞬态'],
        appliesTo: ['Capacitor', 'ParallelPlateCapacitor'],
        content: '直流稳态下电容等效开路；在暂态阶段会出现充放电电流，电压连续变化。'
    },
    {
        id: 'inductor-dc',
        title: '电感直流特性',
        category: 'dynamic',
        keywords: ['电感', '感抗', '电流连续', '稳态'],
        appliesTo: ['Inductor'],
        content: '理想电感在直流稳态下近似短路，电感电流不能突变，暂态分析需结合时间过程。'
    },
    {
        id: 'switch-topology',
        title: '开关拓扑变化',
        category: 'topology',
        keywords: ['开关', '断开', '闭合', '回路'],
        appliesTo: ['Switch'],
        content: '开关闭合近似短接，断开近似开路。状态变化会直接改变回路拓扑与测量值。'
    },
    {
        id: 'motor-back-emf',
        title: '电机反电动势',
        category: 'dynamic',
        keywords: ['电机', '反电动势', '转速', '负载'],
        appliesTo: ['Motor'],
        content: '电机转速升高时反电动势增大，通常会抑制电流；负载变化会影响稳态转速与电流。'
    },
    {
        id: 'kcl-kvl',
        title: '节点与回路守恒',
        category: 'formula',
        keywords: ['节点', '回路', '基尔霍夫', 'kcl', 'kvl', '守恒'],
        appliesTo: ['PowerSource', 'Resistor', 'Rheostat', 'Bulb', 'Capacitor', 'Inductor', 'Motor', 'Switch'],
        content: '节点电流代数和为 0，回路电压代数和为 0。用于检验推导和数值是否自洽。'
    }
]);
