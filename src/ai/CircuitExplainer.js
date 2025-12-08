/**
 * CircuitExplainer.js - 电路状态提取和解释
 */

export class CircuitExplainer {
    constructor(circuit) {
        this.circuit = circuit;
    }

    /**
     * 提取当前电路状态为可读文本
     */
    extractCircuitState() {
        const components = Array.from(this.circuit.components.values());
        const wires = Array.from(this.circuit.wires.values());
        
        if (components.length === 0) {
            return '当前电路为空。';
        }

        let state = '电路元件状态：\n\n';

        // 按类型分组
        const componentsByType = new Map();
        for (const comp of components) {
            if (!componentsByType.has(comp.type)) {
                componentsByType.set(comp.type, []);
            }
            componentsByType.get(comp.type).push(comp);
        }

        // 电源
        if (componentsByType.has('PowerSource')) {
            state += '【电源】\n';
            for (const comp of componentsByType.get('PowerSource')) {
                const label = comp.label || comp.id;
                state += `  ${label}: 电动势 ${comp.voltage}V, 内阻 ${comp.internalResistance}Ω\n`;
                if (comp.voltageValue !== undefined) {
                    state += `    → 端电压 ${comp.voltageValue.toFixed(3)}V, 电流 ${comp.currentValue.toFixed(3)}A, 功率 ${comp.powerValue.toFixed(3)}W\n`;
                }
            }
            state += '\n';
        }

        // 电阻
        if (componentsByType.has('Resistor')) {
            state += '【定值电阻】\n';
            for (const comp of componentsByType.get('Resistor')) {
                const label = comp.label || comp.id;
                state += `  ${label}: 阻值 ${comp.resistance}Ω\n`;
                if (comp.voltageValue !== undefined) {
                    state += `    → 电压 ${comp.voltageValue.toFixed(3)}V, 电流 ${comp.currentValue.toFixed(3)}A, 功率 ${comp.powerValue.toFixed(3)}W\n`;
                }
            }
            state += '\n';
        }

        // 滑动变阻器
        if (componentsByType.has('Rheostat')) {
            state += '【滑动变阻器】\n';
            for (const comp of componentsByType.get('Rheostat')) {
                const label = comp.label || comp.id;
                state += `  ${label}: 最大阻值 ${comp.maxResistance}Ω, 滑块位置 ${(comp.position * 100).toFixed(0)}%\n`;
                state += `    → 接入电阻 ${(comp.activeResistance || 0).toFixed(1)}Ω (${comp.connectionMode || 'none'})\n`;
                if (comp.voltageValue !== undefined) {
                    state += `    → 电压 ${comp.voltageValue.toFixed(3)}V, 电流 ${comp.currentValue.toFixed(3)}A, 功率 ${comp.powerValue.toFixed(3)}W\n`;
                }
            }
            state += '\n';
        }

        // 灯泡
        if (componentsByType.has('Bulb')) {
            state += '【灯泡】\n';
            for (const comp of componentsByType.get('Bulb')) {
                const label = comp.label || comp.id;
                state += `  ${label}: 额定功率 ${comp.ratedPower}W, 电阻 ${comp.resistance}Ω\n`;
                if (comp.voltageValue !== undefined) {
                    const brightness = comp.brightness ? `${(comp.brightness * 100).toFixed(0)}%亮度` : '未发光';
                    state += `    → 电压 ${comp.voltageValue.toFixed(3)}V, 电流 ${comp.currentValue.toFixed(3)}A, 实际功率 ${comp.powerValue.toFixed(3)}W (${brightness})\n`;
                }
            }
            state += '\n';
        }

        // 电流表
        if (componentsByType.has('Ammeter')) {
            state += '【电流表】\n';
            for (const comp of componentsByType.get('Ammeter')) {
                const label = comp.label || comp.id;
                state += `  ${label}: 量程 ${comp.range}A\n`;
                if (comp.currentValue !== undefined) {
                    state += `    → 读数 ${comp.currentValue.toFixed(3)}A\n`;
                }
            }
            state += '\n';
        }

        // 电压表
        if (componentsByType.has('Voltmeter')) {
            state += '【电压表】\n';
            for (const comp of componentsByType.get('Voltmeter')) {
                const label = comp.label || comp.id;
                state += `  ${label}: 量程 ${comp.range}V\n`;
                if (comp.voltageValue !== undefined) {
                    state += `    → 读数 ${comp.voltageValue.toFixed(3)}V\n`;
                }
            }
            state += '\n';
        }

        // 开关
        if (componentsByType.has('Switch')) {
            state += '【开关】\n';
            for (const comp of componentsByType.get('Switch')) {
                const label = comp.label || comp.id;
                state += `  ${label}: ${comp.closed ? '闭合' : '断开'}\n`;
            }
            state += '\n';
        }

        // 连接关系（简化）
        state += `电路共有 ${wires.length} 条导线连接。\n`;

        return state;
    }

    /**
     * 生成常见问题的快速回答
     */
    getQuickAnswer(questionType) {
        const state = this.extractCircuitState();
        
        switch (questionType) {
            case 'current_change':
                return `问题：某个电阻的电流为什么变化了？

${state}

请根据上述电路状态，解释电流变化的原因。`;
            case 'rheostat_effect':
                return `问题：滑动变阻器如何影响电路？

${state}

请解释滑动变阻器位置变化对电路的影响。`;
            case 'voltmeter_reading':
                return `问题：电压表读数为什么变化？

${state}

请解释电压表读数变化的原因。`;
            default:
                return state;
        }
    }
}
