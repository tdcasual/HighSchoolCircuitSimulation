/**
 * Renderer.js - SVG渲染器
 * 负责将电路数据渲染到SVG画布
 */

import { SVGRenderer, ComponentNames } from '../components/Component.js';

export class Renderer {
    constructor(svgCanvas, circuit) {
        this.svg = svgCanvas;
        this.circuit = circuit;
        
        // 获取各个图层
        this.gridLayer = this.svg.querySelector('#layer-grid');
        this.wireLayer = this.svg.querySelector('#layer-wires');
        this.componentLayer = this.svg.querySelector('#layer-components');
        this.uiLayer = this.svg.querySelector('#layer-ui');
        
        // 显示设置
        this.showCurrent = true;
        this.showVoltage = true;
        this.showPower = false;
        
        // 元器件SVG元素映射
        this.componentElements = new Map();
        this.wireElements = new Map();
    }

    /**
     * 渲染整个电路
     */
    render() {
        this.renderComponents();
        this.renderWires();
    }

    /**
     * 渲染所有元器件
     */
    renderComponents() {
        // 清空图层
        this.componentLayer.innerHTML = '';
        this.componentElements.clear();
        
        // 渲染每个元器件
        for (const comp of this.circuit.getAllComponents()) {
            const g = SVGRenderer.createComponentGroup(comp);
            this.componentLayer.appendChild(g);
            this.componentElements.set(comp.id, g);
        }
    }

    /**
     * 渲染所有导线
     */
    renderWires() {
        // 清空导线层
        this.wireLayer.innerHTML = '';
        this.wireElements.clear();
        
        // 渲染每条导线
        for (const wire of this.circuit.getAllWires()) {
            const path = SVGRenderer.createWire(wire, this.getTerminalPosition.bind(this));
            this.wireLayer.appendChild(path);
            this.wireElements.set(wire.id, path);
        }
    }

    /**
     * 添加单个元器件
     */
    addComponent(comp) {
        const g = SVGRenderer.createComponentGroup(comp);
        this.componentLayer.appendChild(g);
        this.componentElements.set(comp.id, g);
        return g;
    }

    /**
     * 移除元器件
     */
    removeComponent(id) {
        const g = this.componentElements.get(id);
        if (g) {
            g.remove();
            this.componentElements.delete(id);
        }
    }

    /**
     * 添加导线
     */
    addWire(wire) {
        const path = SVGRenderer.createWire(wire, this.getTerminalPosition.bind(this));
        this.wireLayer.appendChild(path);
        this.wireElements.set(wire.id, path);
        return path;
    }

    /**
     * 移除导线
     */
    removeWire(id) {
        const path = this.wireElements.get(id);
        if (path) {
            path.remove();
            this.wireElements.delete(id);
        }
    }

    /**
     * 更新元器件位置
     */
    updateComponentPosition(comp) {
        const g = this.componentElements.get(comp.id);
        if (g) {
            g.setAttribute('transform', `translate(${comp.x}, ${comp.y}) rotate(${comp.rotation || 0})`);
        }
        
        // 更新相关导线
        this.updateConnectedWires(comp.id);
    }

    /**
     * 更新连接到指定元器件的所有导线
     */
    updateConnectedWires(componentId) {
        for (const wire of this.circuit.getAllWires()) {
            if (wire.startComponentId === componentId || wire.endComponentId === componentId) {
                const path = this.wireElements.get(wire.id);
                if (path) {
                    SVGRenderer.updateWirePath(path, wire, this.getTerminalPosition.bind(this));
                }
            }
        }
    }

    /**
     * 获取端子的绝对位置
     */
    getTerminalPosition(componentId, terminalIndex) {
        const comp = this.circuit.getComponent(componentId);
        if (!comp) return null;
        
        // 根据元器件类型获取端子相对位置
        let relX, relY;
        
        switch (comp.type) {
            case 'PowerSource':
            case 'Bulb':
            case 'Motor':
                relX = terminalIndex === 0 ? -30 : 30;
                relY = 0;
                break;
            case 'Resistor':
                relX = terminalIndex === 0 ? -30 : 30;
                relY = 0;
                break;
            case 'Rheostat':
                // 滑动变阻器有三个端子：0=左端, 1=右端, 2=滑动触点
                if (terminalIndex === 0) {
                    relX = -35;
                    relY = 0;
                } else if (terminalIndex === 1) {
                    relX = 35;
                    relY = 0;
                } else if (terminalIndex === 2) {
                    // 滑动触点位置随滑块移动（与Component.js中的sliderX计算一致）
                    // 注意：position可能为0，不能用 || 0.5
                    const pos = comp.position !== undefined ? comp.position : 0.5;
                    relX = -20 + 40 * pos;
                    relY = -28;
                } else {
                    relX = 0;
                    relY = 0;
                }
                break;
            case 'Capacitor':
                relX = terminalIndex === 0 ? -30 : 30;
                relY = 0;
                break;
            default:
                relX = terminalIndex === 0 ? -30 : 30;
                relY = 0;
        }
        
        // 应用端子延长偏移
        if (comp.terminalExtensions && comp.terminalExtensions[terminalIndex]) {
            relX += comp.terminalExtensions[terminalIndex].x || 0;
            relY += comp.terminalExtensions[terminalIndex].y || 0;
        }
        
        // 应用旋转
        const rotation = (comp.rotation || 0) * Math.PI / 180;
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        
        return {
            x: comp.x + relX * cos - relY * sin,
            y: comp.y + relX * sin + relY * cos
        };
    }

    /**
     * 更新数值显示
     */
    updateValues() {
        for (const [id, g] of this.componentElements) {
            const comp = this.circuit.getComponent(id);
            if (comp) {
                SVGRenderer.updateValueDisplay(g, comp, this.showCurrent, this.showVoltage, this.showPower);
            }
        }
    }

    /**
     * 设置显示选项
     */
    setDisplayOptions(showCurrent, showVoltage, showPower) {
        this.showCurrent = showCurrent;
        this.showVoltage = showVoltage;
        this.showPower = showPower;
        this.updateValues();
    }

    /**
     * 设置元器件选中状态
     */
    setSelected(id, selected) {
        const g = this.componentElements.get(id);
        if (g) {
            if (selected) {
                g.classList.add('selected');
            } else {
                g.classList.remove('selected');
            }
        }
    }

    /**
     * 清除所有选中状态
     */
    clearSelection() {
        for (const g of this.componentElements.values()) {
            g.classList.remove('selected');
        }
        for (const path of this.wireElements.values()) {
            path.classList.remove('selected');
        }
    }

    /**
     * 设置导线选中状态
     */
    setWireSelected(id, selected) {
        const wireGroup = this.wireElements.get(id);
        const wire = this.circuit.getWire(id);
        if (wireGroup && wire) {
            if (selected) {
                wireGroup.classList.add('selected');
            } else {
                wireGroup.classList.remove('selected');
            }
            // 刷新导线以显示/隐藏控制点
            SVGRenderer.updateWirePath(wireGroup, wire, this.getTerminalPosition.bind(this));
        }
    }

    /**
     * 刷新导线显示
     */
    refreshWire(wireId) {
        const wireGroup = this.wireElements.get(wireId);
        const wire = this.circuit.getWire(wireId);
        if (wireGroup && wire) {
            SVGRenderer.updateWirePath(wireGroup, wire, this.getTerminalPosition.bind(this));
        }
    }

    /**
     * 重新渲染单个元器件
     */
    refreshComponent(comp) {
        const oldG = this.componentElements.get(comp.id);
        if (oldG) {
            // 在替换前保存选中状态
            const wasSelected = oldG.classList.contains('selected');
            
            const newG = SVGRenderer.createComponentGroup(comp);
            oldG.replaceWith(newG);
            this.componentElements.set(comp.id, newG);
            
            // 如果之前是选中状态，保持选中
            if (wasSelected) {
                newG.classList.add('selected');
            }
        }
    }

    /**
     * 更新导线电流动画
     */
    updateWireAnimations(isRunning) {
        for (const [id, path] of this.wireElements) {
            if (isRunning) {
                path.classList.add('flowing');
            } else {
                path.classList.remove('flowing');
            }
        }
    }

    /**
     * 创建临时导线（用于连线时的预览）
     */
    createTempWire() {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('class', 'wire-temp');
        this.uiLayer.appendChild(line);
        return line;
    }

    /**
     * 更新临时导线
     */
    updateTempWire(line, x1, y1, x2, y2) {
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
    }

    /**
     * 移除临时导线
     */
    removeTempWire(line) {
        if (line && line.parentNode) {
            line.remove();
        }
    }

    /**
     * 清空所有渲染
     */
    clear() {
        this.componentLayer.innerHTML = '';
        this.wireLayer.innerHTML = '';
        this.uiLayer.innerHTML = '';
        this.componentElements.clear();
        this.wireElements.clear();
    }
}
