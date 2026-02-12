/**
 * Renderer.js - SVG渲染器
 * 负责将电路数据渲染到SVG画布
 */

import { SVGRenderer } from '../components/Component.js';
import { getTerminalWorldPosition } from '../utils/TerminalGeometry.js';
import { normalizeCanvasPoint } from '../utils/CanvasCoords.js';

export class Renderer {
    constructor(svgCanvas, circuit) {
        this.svg = svgCanvas;
        this.circuit = circuit;
        
        // 获取各个图层
        this.gridLayer = this.svg.querySelector('#layer-grid');
        this.wireLayer = this.svg.querySelector('#layer-wires');
        this.componentLayer = this.svg.querySelector('#layer-components');
        this.uiLayer = this.svg.querySelector('#layer-ui');
        
        // 数值显示默认设置（单个元器件可覆盖）
        this.defaultDisplay = {
            current: true,
            voltage: false,
            power: false
        };
        
        // 元器件SVG元素映射
        this.componentElements = new Map();
        this.wireElements = new Map();
        this.valueDisplaySnapshot = new Map();
    }

    /**
     * 渲染整个电路
     */
    render() {
        this.renderComponents();
        this.renderWires();
        // Ensure value displays are populated even before the simulation starts.
        this.updateValues(true);
    }

    getOpaqueBlackBoxes() {
        return this.circuit.getAllComponents().filter((c) => c.type === 'BlackBox' && c.viewMode === 'opaque');
    }

    isPointInsideBlackBox(point, box) {
        if (!point || !box) return false;
        const w = Math.max(80, box.boxWidth || 180);
        const h = Math.max(60, box.boxHeight || 110);
        const left = (box.x || 0) - w / 2;
        const right = (box.x || 0) + w / 2;
        const top = (box.y || 0) - h / 2;
        const bottom = (box.y || 0) + h / 2;
        return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom;
    }

    computeHiddenComponentIds(opaqueBoxes) {
        const hidden = new Set();
        if (!opaqueBoxes || opaqueBoxes.length === 0) return hidden;
        for (const comp of this.circuit.getAllComponents()) {
            for (const box of opaqueBoxes) {
                if (comp.id === box.id) continue;
                const inside = this.isPointInsideBlackBox({ x: comp.x || 0, y: comp.y || 0 }, box);
                if (inside) {
                    hidden.add(comp.id);
                    break;
                }
            }
        }
        return hidden;
    }

    /**
     * 渲染所有元器件
     */
    renderComponents() {
        // 清空图层
        this.componentLayer.innerHTML = '';
        this.componentElements.clear();
        this.valueDisplaySnapshot.clear();

        const opaqueBoxes = this.getOpaqueBlackBoxes();
        const hiddenComponentIds = this.computeHiddenComponentIds(opaqueBoxes);
        
        // 渲染每个元器件
        for (const comp of this.circuit.getAllComponents()) {
            if (hiddenComponentIds.has(comp.id)) continue;
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

        const opaqueBoxes = this.getOpaqueBlackBoxes();
        
        // 渲染每条导线
        for (const wire of this.circuit.getAllWires()) {
            if (opaqueBoxes.length > 0) {
                const startPos = this.getWireEndpointPosition(wire, 'a');
                const endPos = this.getWireEndpointPosition(wire, 'b');
                if (startPos && endPos) {
                    const hiddenByAnyBox = opaqueBoxes.some((box) =>
                        this.isPointInsideBlackBox(startPos, box) && this.isPointInsideBlackBox(endPos, box)
                    );
                    if (hiddenByAnyBox) continue;
                }
            }
            const path = SVGRenderer.createWire(wire, this.getWireEndpointPosition.bind(this));
            this.wireLayer.appendChild(path);
            this.wireElements.set(wire.id, path);
            this.renderWireProbeMarkers(wire, path);
        }
    }

    /**
     * 添加单个元器件
     */
    addComponent(comp) {
        const g = SVGRenderer.createComponentGroup(comp);
        this.componentLayer.appendChild(g);
        this.componentElements.set(comp.id, g);
        const display = comp.display || {};
        const showCurrent = display.current ?? this.defaultDisplay.current;
        const showVoltage = display.voltage ?? this.defaultDisplay.voltage;
        const showPower = display.power ?? this.defaultDisplay.power;
        SVGRenderer.updateValueDisplay(g, comp, showCurrent, showVoltage, showPower);
        this.valueDisplaySnapshot.set(
            comp.id,
            this.buildValueDisplaySnapshot(comp, showCurrent, showVoltage, showPower)
        );
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
        this.valueDisplaySnapshot.delete(id);
    }

    /**
     * 添加导线
     */
    addWire(wire) {
        const path = SVGRenderer.createWire(wire, this.getWireEndpointPosition.bind(this));
        this.wireLayer.appendChild(path);
        this.wireElements.set(wire.id, path);
        this.renderWireProbeMarkers(wire, path);
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

        // If wire endpoints are bound to this component's terminals, keep them attached visually.
        this.updateConnectedWires(comp.id);
    }

    /**
     * 仅更新元器件的 transform（不扫描更新导线），用于批量移动/组合拖动的性能优化
     */
    updateComponentTransform(comp) {
        const g = this.componentElements.get(comp.id);
        if (g) {
            g.setAttribute('transform', `translate(${comp.x}, ${comp.y}) rotate(${comp.rotation || 0})`);
        }
    }

    /**
     * 更新连接到指定元器件的所有导线
     */
    updateConnectedWires(componentId) {
        const comp = this.circuit.getComponent(componentId);
        if (!comp) return;

        const updateEndpoint = (wire, endKey, ref) => {
            if (!ref || ref.componentId !== componentId) return false;
            const terminalIndex = ref.terminalIndex;
            if (!Number.isInteger(terminalIndex) || terminalIndex < 0) return false;
            const pos = getTerminalWorldPosition(comp, terminalIndex);
            if (!pos) return false;
            const normalizedPos = normalizeCanvasPoint(pos);
            if (!normalizedPos) return false;
            const current = wire[endKey];
            if (current && current.x === normalizedPos.x && current.y === normalizedPos.y) return false;
            wire[endKey] = normalizedPos;
            return true;
        };

        for (const wire of this.circuit.getAllWires()) {
            if (!wire) continue;
            const changedA = updateEndpoint(wire, 'a', wire.aRef);
            const changedB = updateEndpoint(wire, 'b', wire.bRef);
            if (changedA || changedB) {
                this.refreshWire(wire.id);
            }
        }
    }

    /**
     * 获取导线端点的绝对位置（Model C）
     * @param {Object} wire
     * @param {'a'|'b'} which
     * @returns {{x:number,y:number}|null}
     */
    getWireEndpointPosition(wire, which) {
        if (!wire) return null;
        const pt = which === 'a' ? wire.a : wire.b;
        return normalizeCanvasPoint(pt);
    }

    /**
     * 获取端子的绝对位置
     */
    getTerminalPosition(componentId, terminalIndex) {
        const comp = this.circuit.getComponent(componentId);
        if (!comp) return null;
        return normalizeCanvasPoint(getTerminalWorldPosition(comp, terminalIndex));
    }

    formatValueSnapshotNumber(value) {
        if (typeof value === 'number') {
            if (Number.isNaN(value)) return 'NaN';
            if (!Number.isFinite(value)) return value > 0 ? 'Infinity' : '-Infinity';
            if (Object.is(value, -0)) return '0';
            return value.toPrecision(12);
        }
        if (value === undefined) return 'undefined';
        if (value === null) return 'null';
        return String(value);
    }

    buildValueDisplaySnapshot(comp, showCurrent, showVoltage, showPower) {
        return [
            comp?.type || 'Unknown',
            showCurrent ? '1' : '0',
            showVoltage ? '1' : '0',
            showPower ? '1' : '0',
            this.formatValueSnapshotNumber(comp?.currentValue),
            this.formatValueSnapshotNumber(comp?.voltageValue),
            this.formatValueSnapshotNumber(comp?.powerValue),
            this.formatValueSnapshotNumber(comp?.voltageSegLeft),
            this.formatValueSnapshotNumber(comp?.voltageSegRight),
            this.formatValueSnapshotNumber(comp?.ratedPower),
            this.formatValueSnapshotNumber(comp?.boxHeight)
        ].join('|');
    }

    /**
     * 更新数值显示
     */
    updateValues(force = false) {
        if (!(this.valueDisplaySnapshot instanceof Map)) {
            this.valueDisplaySnapshot = new Map();
        }
        const staleIds = new Set(this.valueDisplaySnapshot.keys());
        for (const [id, g] of this.componentElements) {
            const comp = this.circuit.getComponent(id);
            if (comp) {
                staleIds.delete(id);
                const display = comp.display || {};
                const showCurrent = display.current ?? this.defaultDisplay.current;
                const showVoltage = display.voltage ?? this.defaultDisplay.voltage;
                const showPower = display.power ?? this.defaultDisplay.power;
                const snapshot = this.buildValueDisplaySnapshot(comp, showCurrent, showVoltage, showPower);
                if (!force && this.valueDisplaySnapshot.get(id) === snapshot) {
                    continue;
                }
                SVGRenderer.updateValueDisplay(g, comp, showCurrent, showVoltage, showPower);
                this.valueDisplaySnapshot.set(id, snapshot);
            }
        }
        for (const staleId of staleIds) {
            this.valueDisplaySnapshot.delete(staleId);
        }
    }

    /**
     * 设置显示选项
     */
    setDisplayOptions(showCurrent, showVoltage, showPower) {
        // 兼容旧逻辑：设置默认显示（不强制覆盖每个元器件的单独配置）
        this.defaultDisplay = {
            current: !!showCurrent,
            voltage: !!showVoltage,
            power: !!showPower
        };
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
        for (const [wireId, wireGroup] of this.wireElements.entries()) {
            wireGroup.classList.remove('selected');
            const wire = this.circuit.getWire(wireId);
            if (wire) {
                SVGRenderer.updateWirePath(wireGroup, wire, this.getWireEndpointPosition.bind(this));
            }
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
            // 刷新导线以显示/隐藏端点
            SVGRenderer.updateWirePath(wireGroup, wire, this.getWireEndpointPosition.bind(this));
        }
    }

    /**
     * 刷新导线显示
     */
    refreshWire(wireId) {
        const wireGroup = this.wireElements.get(wireId);
        const wire = this.circuit.getWire(wireId);
        if (wireGroup && wire) {
            SVGRenderer.updateWirePath(wireGroup, wire, this.getWireEndpointPosition.bind(this));
            this.renderWireProbeMarkers(wire, wireGroup);
        }
    }

    getWireObservationProbes(wireId) {
        if (!wireId || typeof this.circuit?.getAllObservationProbes !== 'function') return [];
        return this.circuit.getAllObservationProbes()
            .filter((probe) => probe?.wireId === wireId);
    }

    getProbeTypeGlyph(type) {
        if (type === 'NodeVoltageProbe') return 'U';
        if (type === 'WireCurrentProbe') return 'I';
        return '?';
    }

    getWireProbeOffset(index) {
        const level = Math.floor(index / 2) + 1;
        const sign = index % 2 === 0 ? 1 : -1;
        return sign * level * 14;
    }

    renderWireProbeMarkers(wire, wireGroup) {
        if (!wireGroup || !wire) return;
        wireGroup.querySelectorAll('.wire-probe-marker').forEach((el) => el.remove());

        const probes = this.getWireObservationProbes(wire.id);
        if (!Array.isArray(probes) || probes.length === 0) return;

        const a = this.getWireEndpointPosition(wire, 'a');
        const b = this.getWireEndpointPosition(wire, 'b');
        if (!a || !b) return;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy);
        const nx = len > 1e-9 ? -dy / len : 0;
        const ny = len > 1e-9 ? dx / len : -1;
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;

        probes.forEach((probe, index) => {
            if (!probe?.id || !probe?.type) return;
            const offset = this.getWireProbeOffset(index);
            const x = midX + nx * offset;
            const y = midY + ny * offset;

            const marker = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            marker.setAttribute('class', `wire-probe-marker probe-${probe.type}`);
            marker.setAttribute('data-probe-id', probe.id);
            marker.setAttribute('data-wire-id', wire.id);
            marker.setAttribute('data-probe-type', probe.type);
            marker.setAttribute('transform', `translate(${x}, ${y})`);

            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('class', 'wire-probe-body');
            circle.setAttribute('r', 8);
            marker.appendChild(circle);

            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('class', 'wire-probe-glyph');
            text.setAttribute('x', 0);
            text.setAttribute('y', 3);
            text.setAttribute('text-anchor', 'middle');
            text.textContent = this.getProbeTypeGlyph(probe.type);
            marker.appendChild(text);

            const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
            const displayName = probe.label && String(probe.label).trim() ? String(probe.label).trim() : probe.id;
            title.textContent = `${displayName} (${probe.type === 'NodeVoltageProbe' ? '节点电压' : '支路电流'})`;
            marker.appendChild(title);

            wireGroup.appendChild(marker);
        });
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
            const display = comp.display || {};
            const showCurrent = display.current ?? this.defaultDisplay.current;
            const showVoltage = display.voltage ?? this.defaultDisplay.voltage;
            const showPower = display.power ?? this.defaultDisplay.power;
            SVGRenderer.updateValueDisplay(newG, comp, showCurrent, showVoltage, showPower);
            this.valueDisplaySnapshot.set(
                comp.id,
                this.buildValueDisplaySnapshot(comp, showCurrent, showVoltage, showPower)
            );
        }
    }

    /**
     * 更新导线电流动画
     * @param {boolean} isRunning - 模拟是否运行中
     * @param {Object} results - 求解结果（包含电压信息）
     */
    updateWireAnimations(isRunning, results = null) {
        for (const [id, wireGroup] of this.wireElements) {
            const wire = this.circuit.getWire(id);
            const wirePath = wireGroup.querySelector('path.wire');
            if (!wirePath) continue;
            
            // 清除所有动画类
            wirePath.classList.remove('flowing', 'flowing-forward', 'flowing-reverse', 
                'current-low', 'current-medium', 'current-high', 'short-circuit');
            
            if (!isRunning || !wire) {
                continue;
            }

            // Short-circuit warning should still show even if the solver cannot provide a valid solution.
            if (this.circuit.isWireInShortCircuit(wire)) {
                wirePath.classList.add('short-circuit');
                continue;
            }

            if (!results || !results.valid) {
                continue;
            }
            
            // 获取导线两端的电势
            const wireInfo = this.circuit.getWireCurrentInfo(wire, results);
            if (!wireInfo) continue;
            
            const { current, isShorted, flowDirection } = wireInfo;
            
            // 如果是短路
            if (isShorted) {
                wirePath.classList.add('short-circuit');
                continue;
            }
            
            // 如果有电流流过
            if (Math.abs(current) > 1e-9 && flowDirection !== 0) {
                wirePath.classList.add('flowing');
                
                // 根据电流强度设置样式
                const absCurrent = Math.abs(current);
                if (absCurrent < 0.1) {
                    wirePath.classList.add('current-low');
                } else if (absCurrent < 0.5) {
                    wirePath.classList.add('current-medium');
                } else {
                    wirePath.classList.add('current-high');
                }
                
                // 根据 flowDirection 决定动画方向
                // flowDirection > 0: 从导线起点流向终点
                // flowDirection < 0: 从导线终点流向起点
                if (flowDirection > 0) {
                    wirePath.classList.add('flowing-forward');
                } else {
                    wirePath.classList.add('flowing-reverse');
                }
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
     * 高亮端点（用于连接预览）
     */
    highlightTerminal(componentId, terminalIndex) {
        this.clearTerminalHighlight();
        
        const pos = this.getTerminalPosition(componentId, terminalIndex);
        if (!pos) return;
        
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', pos.x);
        circle.setAttribute('cy', pos.y);
        circle.setAttribute('r', 12);
        circle.setAttribute('class', 'terminal-highlight');
        circle.setAttribute('id', 'terminal-highlight');
        this.uiLayer.appendChild(circle);
    }

    /**
     * 高亮导线节点（用于连接预览）
     */
    highlightWireNode(x, y) {
        this.clearTerminalHighlight();
        
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', x);
        circle.setAttribute('cy', y);
        circle.setAttribute('r', 10);
        circle.setAttribute('class', 'wire-node-highlight');
        circle.setAttribute('id', 'terminal-highlight');
        this.uiLayer.appendChild(circle);
    }

    /**
     * 清除端点高亮
     */
    clearTerminalHighlight() {
        this.uiLayer
            .querySelectorAll('#terminal-highlight, .terminal-highlight, .wire-node-highlight')
            .forEach((el) => el.remove());
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
