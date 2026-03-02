import { describe, expect, it, vi } from 'vitest';
import { Circuit } from '../src/engine/Circuit.js';
import { InteractionManager } from '../src/ui/Interaction.js';

describe('Interaction wire segment snap/split helpers', () => {
    it('enables wire segment snapping when starting wiring from a point', () => {
        const snapPoint = vi.fn(() => ({ x: 20, y: 30, snap: { type: 'wire-segment', wireId: 'W1' } }));
        const updateTempWire = vi.fn();
        const createTempWire = vi.fn(() => 'TEMP');
        const ctx = {
            hideAlignmentGuides: vi.fn(),
            renderer: {
                clearTerminalHighlight: vi.fn(),
                createTempWire,
                updateTempWire
            },
            snapPoint,
            resolvePointerType: vi.fn(() => 'mouse'),
            screenToCanvas: vi.fn(() => ({ x: 40, y: 30 }))
        };

        InteractionManager.prototype.startWiringFromPoint.call(ctx, { x: 21, y: 29 }, { clientX: 40, clientY: 30 });

        expect(snapPoint).toHaveBeenCalledWith(21, 29, {
            allowWireSegmentSnap: true,
            pointerType: 'mouse'
        });
        expect(ctx.wireStart).toEqual({ x: 20, y: 30, snap: { type: 'wire-segment', wireId: 'W1' } });
        expect(createTempWire).toHaveBeenCalledTimes(1);
        expect(updateTempWire).toHaveBeenCalledWith('TEMP', 20, 30, 40, 30);
    });

    it('syncs interaction mode store when starting wiring', () => {
        const ctx = {
            hideAlignmentGuides: vi.fn(),
            renderer: {
                clearTerminalHighlight: vi.fn(),
                createTempWire: vi.fn(() => 'TEMP'),
                updateTempWire: vi.fn()
            },
            snapPoint: vi.fn(() => ({ x: 30, y: 30, snap: { type: 'grid' } })),
            resolvePointerType: vi.fn(() => 'touch'),
            screenToCanvas: vi.fn(() => ({ x: 31, y: 33 })),
            syncInteractionModeStore: vi.fn()
        };

        InteractionManager.prototype.startWiringFromPoint.call(ctx, { x: 30, y: 30 }, { clientX: 31, clientY: 33 });

        expect(ctx.syncInteractionModeStore).toHaveBeenCalledWith(expect.objectContaining({
            mode: 'wire'
        }));
    });

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

    it('finds projected snap point on non-orthogonal wire segment', () => {
        const ctx = {
            circuit: {
                getAllWires() {
                    return [
                        { id: 'W1', a: { x: 0, y: 0 }, b: { x: 100, y: 100 } }
                    ];
                }
            }
        };

        const found = InteractionManager.prototype.findNearbyWireSegment.call(ctx, 40, 50, 20);
        expect(found).toEqual({ wireId: 'W1', x: 45, y: 45 });
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

    it('splits non-orthogonal wires using projected split point', () => {
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

        expect(result?.created).toBe(true);
        expect(result?.point).toEqual({ x: 50, y: 30 });
        expect(circuit.getAllWires().length).toBe(2);
        expect(circuit.getWire('W1')?.b).toEqual({ x: 50, y: 30 });
        expect(circuit.getWire('W2')?.a).toEqual({ x: 50, y: 30 });
        expect(circuit.getWire('W2')?.b).toEqual({ x: 100, y: 60 });
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

    it('auto-splits target wire when endpoint drag ends on wire segment', () => {
        const clearTerminalHighlight = vi.fn();
        const rebuildNodes = vi.fn();
        const commitHistoryTransaction = vi.fn();
        const compactWiresAndRefresh = vi.fn();
        const splitWireAtPointInternal = vi.fn(() => ({ created: true, newWireId: 'W3' }));
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

        expect(splitWireAtPointInternal).toHaveBeenCalledWith('W2', 30, 40);
        expect(clearTerminalHighlight).toHaveBeenCalledTimes(1);
        expect(compactWiresAndRefresh).toHaveBeenCalledWith({
            preferredWireId: 'W1',
            scopeWireIds: expect.arrayContaining(['W1', 'W2', 'W3'])
        });
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

    it('clears suspended pinch wiring session when wiring is canceled explicitly', () => {
        const removeTempWire = vi.fn();
        const clearTerminalHighlight = vi.fn();
        const hideAlignmentGuides = vi.fn();
        const ctx = {
            isWiring: true,
            wireStart: { x: 20, y: 30, snap: { type: 'terminal', componentId: 'R1', terminalIndex: 0 } },
            tempWire: 'TEMP-2',
            ignoreNextWireMouseUp: true,
            suspendedWiringSession: {
                wireStart: { x: 11, y: 22, snap: { type: 'terminal', componentId: 'R2', terminalIndex: 1 } },
                pendingToolType: 'Wire',
                pendingToolItem: null,
                mobileInteractionMode: 'wire',
                stickyWireTool: true
            },
            renderer: {
                removeTempWire,
                clearTerminalHighlight
            },
            hideAlignmentGuides
        };

        InteractionManager.prototype.cancelWiring.call(ctx);

        expect(ctx.isWiring).toBe(false);
        expect(ctx.wireStart).toBeNull();
        expect(ctx.tempWire).toBeNull();
        expect(ctx.ignoreNextWireMouseUp).toBe(false);
        expect(ctx.suspendedWiringSession).toBeNull();
        expect(removeTempWire).toHaveBeenCalledWith('TEMP-2');
        expect(clearTerminalHighlight).toHaveBeenCalledTimes(1);
        expect(hideAlignmentGuides).toHaveBeenCalledTimes(1);
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
            clientX: 140,
            clientY: 160,
            timeStamp: 12,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn()
        };

        InteractionManager.prototype.startWireEndpointDrag.call(ctx, 'W1', 'a', event);

        expect(beginHistoryTransaction).toHaveBeenCalledWith('移动导线端点');
        expect(ctx.isDraggingWireEndpoint).toBe(true);
        expect(ctx.wireEndpointDrag.affected).toEqual([{ wireId: 'W1', end: 'a' }]);
        expect(ctx.wireEndpointDrag.axisLock).toBe(null);
        expect(ctx.wireEndpointDrag.axisLockWindowMs).toBe(80);
        expect(ctx.wireEndpointDrag.startClient).toEqual({ x: 140, y: 160 });
        expect(ctx.wireEndpointDrag.lastMoveTimeStamp).toBe(12);
        expect(event.preventDefault).toHaveBeenCalledTimes(1);
        expect(event.stopPropagation).toHaveBeenCalledTimes(1);
        expect(selectWire).toHaveBeenCalledWith('W1');
    });

    it('does not open endpoint-drag history transaction when target endpoint is missing', () => {
        const beginHistoryTransaction = vi.fn();
        const selectWire = vi.fn();
        const wire = { id: 'W1', a: null, b: { x: 100, y: 20 } };
        const ctx = {
            beginHistoryTransaction,
            circuit: {
                getWire: (id) => (id === 'W1' ? wire : null),
                getAllWires: () => [wire]
            },
            selectWire
        };

        const event = {
            shiftKey: false,
            clientX: 140,
            clientY: 160,
            timeStamp: 12,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn()
        };

        InteractionManager.prototype.startWireEndpointDrag.call(ctx, 'W1', 'a', event);

        expect(beginHistoryTransaction).not.toHaveBeenCalled();
        expect(ctx.isDraggingWireEndpoint).not.toBe(true);
        expect(ctx.wireEndpointDrag).toBeUndefined();
        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(event.stopPropagation).not.toHaveBeenCalled();
        expect(selectWire).not.toHaveBeenCalled();
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

    it('cancels wiring when mouseup lands on blank area', () => {
        const snapPoint = vi.fn(() => ({ x: 16, y: 32, snap: { type: 'grid' } }));
        const finishWiringToPoint = vi.fn();
        const cancelWiring = vi.fn();
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
            cancelWiring,
            resolvePointerType: () => 'mouse',
            updateStatus: vi.fn()
        };

        InteractionManager.prototype.onMouseUp.call(ctx, {
            target: { classList: { contains: () => false } },
            clientX: 100,
            clientY: 50
        });

        expect(screenToCanvas).toHaveBeenCalledWith(100, 50);
        expect(snapPoint).toHaveBeenCalledWith(15, 31, {
            allowWireSegmentSnap: true,
            pointerType: 'mouse'
        });
        expect(finishWiringToPoint).not.toHaveBeenCalled();
        expect(cancelWiring).toHaveBeenCalledTimes(1);
        expect(ctx.updateStatus).toHaveBeenCalledWith('未连接到端子/端点，已取消连线');
    });

    it('splits wire segments snapped by wiring start/end before creating new wire', () => {
        const splitWireAtPointInternal = vi.fn((wireId) => {
            if (wireId === 'WS') return { created: true, point: { x: 20, y: 20 }, newWireId: 'WS_SPLIT' };
            if (wireId === 'WE') return { created: true, point: { x: 80, y: 20 }, newWireId: 'WE_SPLIT' };
            return null;
        });
        const addWire = vi.fn();
        const addWireRender = vi.fn();
        const compactWiresAndRefresh = vi.fn(() => ({ resolvedWireId: null }));
        const cancelWiring = vi.fn();
        const endTopologyBatch = vi.fn();
        const ctx = {
            wireStart: { x: 10, y: 20, snap: { type: 'wire-segment', wireId: 'WS' } },
            snapPoint: vi.fn(() => ({ x: 90, y: 20, snap: { type: 'wire-segment', wireId: 'WE' } })),
            runWithHistory: (_label, action) => action(),
            circuit: {
                beginTopologyBatch: vi.fn(),
                endTopologyBatch,
                getWire: vi.fn(() => null),
                addWire
            },
            renderer: {
                addWire: addWireRender
            },
            splitWireAtPointInternal,
            compactWiresAndRefresh,
            cancelWiring,
            selectWire: vi.fn(),
            updateStatus: vi.fn()
        };

        InteractionManager.prototype.finishWiringToPoint.call(ctx, { x: 90, y: 20 }, { pointerType: 'mouse' });

        expect(splitWireAtPointInternal).toHaveBeenCalledWith('WS', 10, 20, expect.any(Object));
        expect(splitWireAtPointInternal).toHaveBeenCalledWith('WE', 90, 20, expect.any(Object));
        expect(addWire).toHaveBeenCalledTimes(1);
        expect(addWireRender).toHaveBeenCalledTimes(1);
        expect(compactWiresAndRefresh).toHaveBeenCalledTimes(1);
        expect(cancelWiring).toHaveBeenCalledTimes(1);
        expect(endTopologyBatch).toHaveBeenCalledTimes(1);
    });

    it('uses live terminal position as wiring start when finish is invoked', () => {
        const addWire = vi.fn();
        const ctx = {
            wireStart: {
                x: 10,
                y: 20,
                snap: { type: 'terminal', componentId: 'R1', terminalIndex: 1 }
            },
            runWithHistory: (_label, action) => action(),
            circuit: {
                beginTopologyBatch: vi.fn(),
                endTopologyBatch: vi.fn(),
                getWire: vi.fn(() => null),
                addWire
            },
            renderer: {
                getTerminalPosition: vi.fn(() => ({ x: 42, y: 20 })),
                addWire: vi.fn()
            },
            compactWiresAndRefresh: vi.fn(() => ({ resolvedWireId: null })),
            cancelWiring: vi.fn(),
            selectWire: vi.fn(),
            updateStatus: vi.fn()
        };

        InteractionManager.prototype.finishWiringToPoint.call(ctx, {
            x: 90,
            y: 20,
            snap: { type: 'grid' }
        }, { pointerType: 'touch' });

        expect(addWire).toHaveBeenCalledTimes(1);
        const createdWire = addWire.mock.calls[0][0];
        expect(createdWire.a).toEqual({ x: 42, y: 20 });
        expect(createdWire.b).toEqual({ x: 90, y: 20 });
        expect(createdWire.aRef).toEqual({ componentId: 'R1', terminalIndex: 1 });
        expect(ctx.wireStart.x).toBe(42);
        expect(ctx.wireStart.y).toBe(20);
    });

    it('uses live endpoint position as wiring start when finish is invoked', () => {
        const addWire = vi.fn();
        const anchorWire = {
            id: 'W_ANCHOR',
            a: { x: 20, y: 65 },
            b: { x: 55, y: 65 }
        };
        const ctx = {
            wireStart: {
                x: 10,
                y: 20,
                snap: { type: 'wire-endpoint', wireId: 'W_ANCHOR', end: 'b' }
            },
            runWithHistory: (_label, action) => action(),
            circuit: {
                beginTopologyBatch: vi.fn(),
                endTopologyBatch: vi.fn(),
                getWire: vi.fn((wireId) => (wireId === 'W_ANCHOR' ? anchorWire : null)),
                addWire
            },
            renderer: {
                addWire: vi.fn()
            },
            compactWiresAndRefresh: vi.fn(() => ({ resolvedWireId: null })),
            cancelWiring: vi.fn(),
            selectWire: vi.fn(),
            updateStatus: vi.fn()
        };

        InteractionManager.prototype.finishWiringToPoint.call(ctx, {
            x: 120,
            y: 65,
            snap: { type: 'grid' }
        }, { pointerType: 'touch' });

        expect(addWire).toHaveBeenCalledTimes(1);
        const createdWire = addWire.mock.calls[0][0];
        expect(createdWire.a).toEqual({ x: 55, y: 65 });
        expect(createdWire.b).toEqual({ x: 120, y: 65 });
        expect(createdWire.aRef).toBeUndefined();
        expect(ctx.wireStart.x).toBe(55);
        expect(ctx.wireStart.y).toBe(65);
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
