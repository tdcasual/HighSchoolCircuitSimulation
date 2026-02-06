import { describe, expect, it, vi } from 'vitest';
import { Circuit } from '../src/engine/Circuit.js';
import { InteractionManager } from '../src/ui/Interaction.js';

describe('Interaction wire segment snap/split helpers', () => {
    it('finds projected snap point on nearby wire segment', () => {
        const ctx = {
            circuit: {
                getAllWires() {
                    return [
                        { id: 'W1', a: { x: 0, y: 0 }, b: { x: 100, y: 0 } }
                    ];
                }
            }
        };

        const found = InteractionManager.prototype.findNearbyWireSegment.call(ctx, 47, 6, 15);
        expect(found).toEqual({ wireId: 'W1', x: 47, y: 0 });
    });

    it('ignores points too close to segment endpoints', () => {
        const ctx = {
            circuit: {
                getAllWires() {
                    return [
                        { id: 'W1', a: { x: 0, y: 0 }, b: { x: 100, y: 0 } }
                    ];
                }
            }
        };

        const nearStart = InteractionManager.prototype.findNearbyWireSegment.call(ctx, 1, 0, 15);
        expect(nearStart).toBeNull();
    });

    it('splits wire at projected point and preserves far-end terminal binding', () => {
        const circuit = new Circuit();
        circuit.addWire({
            id: 'W1',
            a: { x: 0, y: 0 },
            b: { x: 100, y: 0 },
            bRef: { componentId: 'R1', terminalIndex: 1 }
        });

        const ctx = {
            circuit,
            renderer: {
                refreshWire: vi.fn(),
                addWire: vi.fn()
            }
        };

        const result = InteractionManager.prototype.splitWireAtPointInternal.call(
            ctx,
            'W1',
            40,
            12,
            { ensureUniqueWireId: () => 'W2' }
        );

        expect(result?.created).toBe(true);
        expect(result?.point).toEqual({ x: 40, y: 0 });

        const oldWire = circuit.getWire('W1');
        const newWire = circuit.getWire('W2');
        expect(oldWire.b).toEqual({ x: 40, y: 0 });
        expect(oldWire.bRef).toBeUndefined();
        expect(newWire.a).toEqual({ x: 40, y: 0 });
        expect(newWire.b).toEqual({ x: 100, y: 0 });
        expect(newWire.bRef).toEqual({ componentId: 'R1', terminalIndex: 1 });
    });

    it('does not split when point is too close to endpoint', () => {
        const circuit = new Circuit();
        circuit.addWire({
            id: 'W1',
            a: { x: 0, y: 0 },
            b: { x: 100, y: 0 }
        });

        const ctx = {
            circuit,
            renderer: {
                refreshWire: vi.fn(),
                addWire: vi.fn()
            }
        };

        const result = InteractionManager.prototype.splitWireAtPointInternal.call(
            ctx,
            'W1',
            2,
            0,
            { ensureUniqueWireId: () => 'W2' }
        );

        expect(result?.created).toBe(false);
        expect(circuit.getWire('W2')).toBeUndefined();
        expect(circuit.getAllWires().length).toBe(1);
    });

    it('does not split non-orthogonal wires', () => {
        const circuit = new Circuit();
        circuit.addWire({
            id: 'W1',
            a: { x: 0, y: 0 },
            b: { x: 100, y: 60 }
        });

        const ctx = {
            circuit,
            renderer: {
                refreshWire: vi.fn(),
                addWire: vi.fn()
            }
        };

        const result = InteractionManager.prototype.splitWireAtPointInternal.call(
            ctx,
            'W1',
            50,
            30,
            { ensureUniqueWireId: () => 'W2' }
        );

        expect(result).toBeNull();
        expect(circuit.getWire('W2')).toBeUndefined();
        expect(circuit.getAllWires().length).toBe(1);
    });

    it('clears terminal highlight when endpoint drag ends on mouseup', () => {
        const clearTerminalHighlight = vi.fn();
        const rebuildNodes = vi.fn();
        const commitHistoryTransaction = vi.fn();
        const compactWiresAndRefresh = vi.fn();
        const ctx = {
            isPanning: false,
            isDraggingWireEndpoint: true,
            wireEndpointDrag: { wireId: 'W1', end: 'a' },
            circuit: { rebuildNodes },
            renderer: { clearTerminalHighlight },
            compactWiresAndRefresh,
            commitHistoryTransaction
        };

        InteractionManager.prototype.onMouseUp.call(ctx, {
            target: { classList: { contains: () => false } }
        });

        expect(ctx.isDraggingWireEndpoint).toBe(false);
        expect(ctx.wireEndpointDrag).toBeNull();
        expect(clearTerminalHighlight).toHaveBeenCalledTimes(1);
        expect(compactWiresAndRefresh).toHaveBeenCalledTimes(1);
        expect(rebuildNodes).toHaveBeenCalledTimes(1);
        expect(commitHistoryTransaction).toHaveBeenCalledTimes(1);
    });

    it('does not auto-split when endpoint drag ends on wire segment', () => {
        const clearTerminalHighlight = vi.fn();
        const rebuildNodes = vi.fn();
        const commitHistoryTransaction = vi.fn();
        const compactWiresAndRefresh = vi.fn();
        const splitWireAtPointInternal = vi.fn();
        const ctx = {
            isPanning: false,
            isDraggingWireEndpoint: true,
            wireEndpointDrag: {
                wireId: 'W1',
                end: 'a',
                lastSnap: { type: 'wire-segment', wireId: 'W2' },
                lastPoint: { x: 30, y: 40 }
            },
            circuit: { rebuildNodes },
            renderer: { clearTerminalHighlight },
            compactWiresAndRefresh,
            commitHistoryTransaction,
            splitWireAtPointInternal
        };

        InteractionManager.prototype.onMouseUp.call(ctx, {
            target: { classList: { contains: () => false } }
        });

        expect(splitWireAtPointInternal).not.toHaveBeenCalled();
        expect(clearTerminalHighlight).toHaveBeenCalledTimes(1);
        expect(compactWiresAndRefresh).toHaveBeenCalledTimes(1);
        expect(rebuildNodes).toHaveBeenCalledTimes(1);
        expect(commitHistoryTransaction).toHaveBeenCalledTimes(1);
    });

    it('clears terminal highlight when endpoint drag ends on mouseleave', () => {
        const clearTerminalHighlight = vi.fn();
        const rebuildNodes = vi.fn();
        const commitHistoryTransaction = vi.fn();
        const compactWiresAndRefresh = vi.fn();
        const ctx = {
            isPanning: false,
            isDraggingWireEndpoint: true,
            wireEndpointDrag: { wireId: 'W1', end: 'a' },
            isDraggingWire: false,
            isDragging: false,
            circuit: { rebuildNodes },
            renderer: { clearTerminalHighlight },
            compactWiresAndRefresh,
            commitHistoryTransaction
        };

        InteractionManager.prototype.onMouseLeave.call(ctx, {});

        expect(ctx.isDraggingWireEndpoint).toBe(false);
        expect(ctx.wireEndpointDrag).toBeNull();
        expect(clearTerminalHighlight).toHaveBeenCalledTimes(1);
        expect(compactWiresAndRefresh).toHaveBeenCalledTimes(1);
        expect(rebuildNodes).toHaveBeenCalledTimes(1);
        expect(commitHistoryTransaction).toHaveBeenCalledTimes(1);
    });

    it('renames observation probe and refreshes wire/probe views', () => {
        const circuit = new Circuit();
        circuit.addWire({ id: 'W1', a: { x: 0, y: 0 }, b: { x: 40, y: 0 } });
        circuit.addObservationProbe({ id: 'P1', type: 'NodeVoltageProbe', wireId: 'W1', label: '旧名称' });

        const ctx = {
            circuit,
            runWithHistory: (_label, action) => action(),
            renderer: { renderWires: vi.fn() },
            app: {
                observationPanel: {
                    refreshComponentOptions: vi.fn(),
                    requestRender: vi.fn()
                }
            },
            updateStatus: vi.fn()
        };

        const result = InteractionManager.prototype.renameObservationProbe.call(ctx, 'P1', '新名称');

        expect(result).toBe(true);
        expect(circuit.getObservationProbe('P1')?.label).toBe('新名称');
        expect(ctx.renderer.renderWires).toHaveBeenCalledTimes(1);
        expect(ctx.app.observationPanel.refreshComponentOptions).toHaveBeenCalledTimes(1);
        expect(ctx.updateStatus).toHaveBeenCalledTimes(1);
    });

    it('deletes observation probe and refreshes observation source list', () => {
        const circuit = new Circuit();
        circuit.addWire({ id: 'W1', a: { x: 0, y: 0 }, b: { x: 40, y: 0 } });
        circuit.addObservationProbe({ id: 'P1', type: 'WireCurrentProbe', wireId: 'W1' });

        const ctx = {
            circuit,
            runWithHistory: (_label, action) => action(),
            renderer: { renderWires: vi.fn() },
            app: {
                observationPanel: {
                    refreshComponentOptions: vi.fn(),
                    requestRender: vi.fn()
                }
            },
            updateStatus: vi.fn()
        };

        const result = InteractionManager.prototype.deleteObservationProbe.call(ctx, 'P1');

        expect(result).toBe(true);
        expect(circuit.getObservationProbe('P1')).toBeUndefined();
        expect(ctx.renderer.renderWires).toHaveBeenCalledTimes(1);
        expect(ctx.app.observationPanel.refreshComponentOptions).toHaveBeenCalledTimes(1);
        expect(ctx.updateStatus).toHaveBeenCalledTimes(1);
    });

    it('adds probe plot in observation panel and activates observation tab', () => {
        const circuit = new Circuit();
        circuit.addWire({ id: 'W1', a: { x: 0, y: 0 }, b: { x: 40, y: 0 } });
        circuit.addObservationProbe({ id: 'P1', type: 'NodeVoltageProbe', wireId: 'W1' });

        const addPlotForSource = vi.fn();
        const requestRender = vi.fn();
        const activateSidePanelTab = vi.fn();
        const ctx = {
            circuit,
            app: {
                observationPanel: { addPlotForSource, requestRender }
            },
            activateSidePanelTab,
            isObservationTabActive: () => false,
            updateStatus: vi.fn()
        };

        const result = InteractionManager.prototype.addProbePlot.call(ctx, 'P1');

        expect(result).toBe(true);
        expect(activateSidePanelTab).toHaveBeenCalledWith('observation');
        expect(addPlotForSource).toHaveBeenCalledWith('P1');
        expect(requestRender).toHaveBeenCalledTimes(1);
        expect(ctx.updateStatus).toHaveBeenCalledTimes(1);
    });

    it('drags a single wire endpoint by default', () => {
        const beginHistoryTransaction = vi.fn();
        const selectWire = vi.fn();
        const wire = { id: 'W1', a: { x: 10, y: 20 }, b: { x: 100, y: 20 } };
        const ctx = {
            beginHistoryTransaction,
            circuit: {
                getWire: (id) => (id === 'W1' ? wire : null),
                getAllWires: () => [
                    wire,
                    { id: 'W2', a: { x: 10, y: 20 }, b: { x: 40, y: 20 } }
                ]
            },
            selectWire
        };

        const event = {
            shiftKey: false,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn()
        };

        InteractionManager.prototype.startWireEndpointDrag.call(ctx, 'W1', 'a', event);

        expect(beginHistoryTransaction).toHaveBeenCalledWith('移动导线端点');
        expect(ctx.isDraggingWireEndpoint).toBe(true);
        expect(ctx.wireEndpointDrag.affected).toEqual([{ wireId: 'W1', end: 'a' }]);
        expect(event.preventDefault).toHaveBeenCalledTimes(1);
        expect(event.stopPropagation).toHaveBeenCalledTimes(1);
        expect(selectWire).toHaveBeenCalledWith('W1');
    });

    it('splits wire on ctrl/cmd click instead of dragging', () => {
        const splitWireAtPoint = vi.fn();
        const startWireDrag = vi.fn();
        const selectWire = vi.fn();
        const screenToCanvas = vi.fn(() => ({ x: 88, y: 44 }));
        const target = {
            classList: {
                contains: (cls) => cls === 'wire'
            },
            closest: (selector) => {
                if (selector === '.component') return null;
                if (selector === '.wire-group') return { dataset: { id: 'W1' } };
                return null;
            }
        };
        const ctx = {
            pendingToolType: null,
            isWiring: false,
            resolvePointerType: () => 'mouse',
            resolveProbeMarkerTarget: () => null,
            resolveTerminalTarget: () => null,
            isWireEndpointTarget: () => false,
            startPanning: vi.fn(),
            startDragging: vi.fn(),
            startWireEndpointDrag: vi.fn(),
            screenToCanvas,
            selectWire,
            splitWireAtPoint,
            startWireDrag,
            clearSelection: vi.fn()
        };
        const event = {
            button: 0,
            ctrlKey: true,
            metaKey: false,
            shiftKey: false,
            clientX: 100,
            clientY: 100,
            target,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn()
        };

        InteractionManager.prototype.onMouseDown.call(ctx, event);

        expect(selectWire).toHaveBeenCalledWith('W1');
        expect(splitWireAtPoint).toHaveBeenCalledWith('W1', 88, 44);
        expect(startWireDrag).not.toHaveBeenCalled();
    });

    it('does not split wire on double click', () => {
        const splitWireAtPoint = vi.fn();
        const showPropertyDialog = vi.fn();
        const target = {
            classList: {
                contains: (cls) => cls === 'wire'
            },
            closest: () => null
        };
        const ctx = {
            resolveProbeMarkerTarget: () => null,
            splitWireAtPoint,
            showPropertyDialog
        };

        InteractionManager.prototype.onDoubleClick.call(ctx, { target });

        expect(splitWireAtPoint).not.toHaveBeenCalled();
        expect(showPropertyDialog).not.toHaveBeenCalled();
    });

    it('finishes wiring without segment snapping', () => {
        const snapPoint = vi.fn(() => ({ x: 16, y: 32, snap: { type: 'grid' } }));
        const finishWiringToPoint = vi.fn();
        const screenToCanvas = vi.fn(() => ({ x: 15, y: 31 }));
        const ctx = {
            isPanning: false,
            isDraggingWireEndpoint: false,
            isDraggingWire: false,
            isDragging: false,
            isWiring: true,
            ignoreNextWireMouseUp: false,
            resolveTerminalTarget: () => null,
            isWireEndpointTarget: () => false,
            screenToCanvas,
            snapPoint,
            finishWiringToPoint,
            resolvePointerType: () => 'mouse'
        };

        InteractionManager.prototype.onMouseUp.call(ctx, {
            target: { classList: { contains: () => false } },
            clientX: 100,
            clientY: 50
        });

        expect(snapPoint).toHaveBeenCalledWith(15, 31, {
            allowWireSegmentSnap: false,
            pointerType: 'mouse'
        });
        expect(finishWiringToPoint).toHaveBeenCalledWith(
            { x: 16, y: 32, snap: { type: 'grid' } },
            { pointerType: 'mouse' }
        );
    });

    it('drags full junction when Shift is held', () => {
        const wire1 = { id: 'W1', a: { x: 10, y: 20 }, b: { x: 100, y: 20 } };
        const wire2 = { id: 'W2', a: { x: 10, y: 20 }, b: { x: 30, y: 40 } };
        const wire3 = { id: 'W3', a: { x: 60, y: 20 }, b: { x: 10, y: 20 } };
        const ctx = {
            beginHistoryTransaction: vi.fn(),
            circuit: {
                getWire: (id) => (id === 'W1' ? wire1 : id === 'W2' ? wire2 : id === 'W3' ? wire3 : null),
                getAllWires: () => [wire1, wire2, wire3]
            },
            selectWire: vi.fn()
        };
        const event = {
            shiftKey: true,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn()
        };

        InteractionManager.prototype.startWireEndpointDrag.call(ctx, 'W1', 'a', event);

        const affectedSet = new Set(ctx.wireEndpointDrag.affected.map((item) => `${item.wireId}:${item.end}`));
        expect(affectedSet).toEqual(new Set(['W1:a', 'W2:a', 'W3:b']));
    });

    it('uses larger snap threshold for touch pointers', () => {
        const ctx = {
            lastPrimaryPointerType: 'mouse',
            getAdaptiveSnapThreshold: InteractionManager.prototype.getAdaptiveSnapThreshold,
            findNearbyTerminal: () => null,
            findNearbyWireSegment: () => null,
            findNearbyWireEndpoint: (_x, _y, threshold) => {
                if (threshold >= 20) return { wireId: 'W1', end: 'a', x: 20, y: 0 };
                return null;
            }
        };

        const mouseSnap = InteractionManager.prototype.snapPoint.call(ctx, 0, 0, { pointerType: 'mouse' });
        expect(mouseSnap.snap?.type).toBe('grid');

        const touchSnap = InteractionManager.prototype.snapPoint.call(ctx, 0, 0, { pointerType: 'touch' });
        expect(touchSnap.snap).toEqual({ type: 'wire-endpoint', wireId: 'W1', end: 'a' });
        expect(touchSnap.x).toBe(20);
        expect(touchSnap.y).toBe(0);
    });
});
